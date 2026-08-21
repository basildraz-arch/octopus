// Minimal .xlsx reader - no dependencies.
//
// An .xlsx is a ZIP of XML parts; we only need two of them:
//   xl/worksheets/sheet1.xml  - the grid
//   xl/sharedStrings.xml      - the string pool the cells point into
//
// Inflation uses DecompressionStream, which exists in every modern
// browser and in Node 18+, so this runs unchanged on both sides.
//
// Why hand-rolled instead of a library: the app had no spreadsheet
// dependency, and this reads exactly one well-formed file shape (a
// flat sheet with a header row) rather than the whole OOXML surface.
// Verified against the real supplier price list before shipping.

function u16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}

function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const b = new Uint8Array(buffer);

  // End-of-central-directory signature, scanned backwards because a
  // trailing comment may follow it.
  let eocd = -1;

  for (let i = b.length - 22; i >= 0 && i > b.length - 22 - 65536; i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) throw new Error("الملف ده مش ملف Excel سليم");

  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);

  const files: Record<string, Uint8Array> = {};

  for (let i = 0; i < count; i++) {
    if (u32(b, p) !== 0x02014b50) break;

    const method = u16(b, p + 10);
    const compSize = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const localOff = u32(b, p + 42);

    const name = new TextDecoder().decode(
      b.subarray(p + 46, p + 46 + nameLen)
    );

    // The local header carries its own extra-field length, which is
    // often different from the central directory's.
    const lNameLen = u16(b, localOff + 26);
    const lExtraLen = u16(b, localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = b.subarray(dataStart, dataStart + compSize);

    files[name] = method === 0 ? raw : await inflateRaw(raw);

    p += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    // &amp; last, so "&amp;lt;" doesn't turn into "<"
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];

  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;

  while ((m = siRe.exec(xml))) {
    // Rich text splits one string across several <t> runs.
    let text = "";
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;

    while ((t = tRe.exec(m[1]))) text += decodeEntities(t[1]);

    out.push(text);
  }

  return out;
}

function colToIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;

  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);

  return n - 1;
}

export type CellValue = string | number | null;

function parseSheet(xml: string, shared: string[]): CellValue[][] {
  const rows: CellValue[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let r: RegExpExecArray | null;

  while ((r = rowRe.exec(xml))) {
    const cells: CellValue[] = [];
    const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c: RegExpExecArray | null;

    while ((c = cellRe.exec(r[1]))) {
      const attrs = c[1] || "";
      const inner = c[2] || "";

      // r="C7" tells us the real column, so blank cells don't shift
      // everything left.
      const refM = /r="([A-Z]+\d+)"/.exec(attrs);
      const idx = refM ? colToIndex(refM[1]) : cells.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];

      let value: CellValue = null;

      if (type === "inlineStr") {
        let text = "";
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let t: RegExpExecArray | null;

        while ((t = tRe.exec(inner))) text += decodeEntities(t[1]);

        value = text;
      } else {
        const vM = /<v>([\s\S]*?)<\/v>/.exec(inner);

        if (vM) {
          const raw = decodeEntities(vM[1]);

          if (type === "s") value = shared[Number(raw)] ?? "";
          else if (type === "str" || type === "e") value = raw;
          else value = raw === "" ? null : Number(raw);
        }
      }

      while (cells.length < idx) cells.push(null);

      cells[idx] = value;
    }

    rows.push(cells);
  }

  return rows;
}

export async function readXlsxRows(
  buffer: ArrayBuffer
): Promise<CellValue[][]> {
  const files = await unzip(buffer);
  const dec = (b?: Uint8Array) => (b ? new TextDecoder().decode(b) : "");

  const sheetName =
    Object.keys(files).find((n) => /^xl\/worksheets\/sheet1\.xml$/i.test(n)) ??
    Object.keys(files).find((n) => /^xl\/worksheets\/.*\.xml$/i.test(n));

  if (!sheetName) throw new Error("مفيش أي شيت جوه الملف");

  const shared = parseSharedStrings(dec(files["xl/sharedStrings.xml"]));

  return parseSheet(dec(files[sheetName]), shared);
}

// Same shape of result for a CSV, so the import screen can accept
// either without caring which it got.
export function readCsvRows(text: string): CellValue[][] {
  const rows: CellValue[][] = [];
  let row: CellValue[] = [];
  let field = "";
  let quoted = false;

  const push = () => {
    const trimmed = field.trim();
    const asNumber = Number(trimmed);

    row.push(
      trimmed !== "" && !Number.isNaN(asNumber) ? asNumber : trimmed || null
    );

    field = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") push();
    else if (ch === "\n") {
      push();
      rows.push(row);
      row = [];
    } else if (ch !== "\r") field += ch;
  }

  if (field !== "" || row.length) {
    push();
    rows.push(row);
  }

  return rows;
}
