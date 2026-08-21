import type { CellValue } from "@/lib/xlsx";

// Maps a supplier/price-list spreadsheet onto Octopus items.
//
// Column headers are matched by name, not position, so a shop can
// reorder or add columns without breaking the import. Both the Arabic
// headers real price lists use and plain English equivalents are
// accepted.
//
// Price tiers follow the highest-price-first rule the app uses
// everywhere: tier 1 is the walk-in/tourist price, tier 3 the
// cheapest. In a typical Egyptian price list that is
// قطاعي > نص جملة > جملة, which is exactly how they are mapped here.
const HEADER_ALIASES: Record<string, string[]> = {
  name: ["الاسم", "اسم الصنف", "الصنف", "المنتج", "name", "item", "product"],
  category: ["المجموعة", "الفئة", "التصنيف", "category", "group"],
  code: ["الكود", "كود", "باركود", "الباركود", "code", "barcode", "sku"],
  unit: ["الوحدة الصغرى", "الوحدة", "unit"],
  price1: [
    "سعر قطاعي",
    "قطاعي",
    "سعر البيع",
    "السعر",
    "price",
    "retail",
    "retail price",
  ],
  price2: ["نص جملة", "نصف جملة", "سعر نص جملة", "mid", "half wholesale"],
  price3: ["سعر جملة", "جملة", "wholesale", "wholesale price"],
  buyPrice: ["سعر الشراء", "الشراء", "التكلفة", "cost", "buy price"],
  stock: ["الكمية", "المخزون", "الرصيد", "qty", "quantity", "stock"],
};

export type ImportedItem = {
  name: string;
  category: string | null;
  code: string | null;
  unit: string;
  price1: number;
  price2: number | null;
  price3: number | null;
  buyPrice: number;
  stock: number;
};

export type ParsedCatalog = {
  items: ImportedItem[];
  categories: string[];
  // Rows we could not use, with a reason the owner can act on.
  skipped: { row: number; reason: string }[];
  // Which spreadsheet column ended up feeding each field, so the
  // preview can show the owner what was understood.
  mapping: Record<string, string | null>;
  hasTiers: boolean;
};

function normalizeHeader(value: CellValue): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toNumber(value: CellValue): number | null {
  if (value === null || value === undefined || value === "") return null;

  // Arabic-Indic digits show up in hand-typed sheets.
  const normalized = String(value).replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
  );

  const n = Number(normalized.replace(/[^\d.-]/g, ""));

  return Number.isFinite(n) ? n : null;
}

export function parseCatalog(rows: CellValue[][]): ParsedCatalog {
  const skipped: { row: number; reason: string }[] = [];

  // Find the header row: the first row that matches at least a name
  // column - real files often have a title or blank rows above it.
  let headerIndex = -1;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const headers = rows[i].map(normalizeHeader);

    if (headers.some((h) => HEADER_ALIASES.name.includes(h))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error(
      "مش لاقي صف العناوين - لازم يكون فيه عمود اسمه «الاسم» أو «اسم الصنف»"
    );
  }

  const headers = rows[headerIndex].map(normalizeHeader);

  const columnOf = (field: string): number => {
    const aliases = HEADER_ALIASES[field].map((a) => a.toLowerCase());

    return headers.findIndex((h) => aliases.includes(h));
  };

  const cols = {
    name: columnOf("name"),
    category: columnOf("category"),
    code: columnOf("code"),
    unit: columnOf("unit"),
    price1: columnOf("price1"),
    price2: columnOf("price2"),
    price3: columnOf("price3"),
    buyPrice: columnOf("buyPrice"),
    stock: columnOf("stock"),
  };

  if (cols.price1 === -1) {
    throw new Error("مش لاقي عمود سعر البيع (زي «سعر قطاعي» أو «سعر البيع»)");
  }

  const mapping: Record<string, string | null> = {};

  for (const [field, index] of Object.entries(cols)) {
    mapping[field] =
      index === -1 ? null : String(rows[headerIndex][index] ?? "").trim();
  }

  const items: ImportedItem[] = [];
  const seen = new Set<string>();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    if (!row || row.every((c) => c === null || String(c).trim() === "")) {
      continue;
    }

    const name = String(row[cols.name] ?? "").trim();

    if (!name) {
      skipped.push({ row: rowNumber, reason: "مفيش اسم للصنف" });
      continue;
    }

    // The items table enforces one name per business, so a duplicate
    // inside the file would fail the whole insert - catch it here
    // where we can name the row instead.
    const key = name.toLowerCase();

    if (seen.has(key)) {
      skipped.push({ row: rowNumber, reason: `"${name}" مكرر في الملف` });
      continue;
    }

    const price1 = toNumber(row[cols.price1]);

    if (price1 === null) {
      skipped.push({ row: rowNumber, reason: `"${name}" ملوش سعر بيع` });
      continue;
    }

    seen.add(key);

    items.push({
      name,
      category:
        cols.category === -1
          ? null
          : String(row[cols.category] ?? "").trim() || null,
      code: cols.code === -1 ? null : String(row[cols.code] ?? "").trim() || null,
      unit:
        (cols.unit === -1 ? "" : String(row[cols.unit] ?? "").trim()) || "قطعة",
      price1,
      price2: cols.price2 === -1 ? null : toNumber(row[cols.price2]),
      price3: cols.price3 === -1 ? null : toNumber(row[cols.price3]),
      buyPrice: (cols.buyPrice === -1 ? null : toNumber(row[cols.buyPrice])) ?? 0,
      stock: (cols.stock === -1 ? null : toNumber(row[cols.stock])) ?? 0,
    });
  }

  const categories = Array.from(
    new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))
  );

  return {
    items,
    categories,
    skipped,
    mapping,
    hasTiers: items.some((i) => i.price2 !== null || i.price3 !== null),
  };
}
