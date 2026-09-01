// Full port of lib/xlsx.ts + importCatalog.ts parse, run in Node against a real file
const fs=require('fs'), zlib=require('zlib');
const buffer=fs.readFileSync(process.argv[2]||'C:/Users/LOGO/Desktop/octopus/marketing/test_items.xlsx');
const b=new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
function u16(b,o){return b[o]|(b[o+1]<<8);}
function u32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
let eocd=-1;
for(let i=b.length-22;i>=0&&i>b.length-22-65536;i--){if(u32(b,i)===0x06054b50){eocd=i;break;}}
if(eocd<0){console.error("الملف ده مش ملف Excel سليم");process.exit(1);}
const count=u16(b,eocd+10); let p=u32(b,eocd+16);
const raws={};
for(let i=0;i<count;i++){
  if(u32(b,p)!==0x02014b50)break;
  const method=u16(b,p+10), compSize=u32(b,p+20), nameLen=u16(b,p+28), extraLen=u16(b,p+30), commentLen=u16(b,p+32), localOff=u32(b,p+42);
  const name=new TextDecoder().decode(b.subarray(p+46,p+46+nameLen));
  const lNameLen=u16(b,localOff+26), lExtraLen=u16(b,localOff+28);
  const dataStart=localOff+30+lNameLen+lExtraLen;
  const slice=b.slice(dataStart,dataStart+compSize);
  raws[name]=method===0?slice:zlib.inflateRawSync(Buffer.from(slice));
  p+=46+nameLen+extraLen+commentLen;
}
const dec=(u)=>u?new TextDecoder().decode(u):"";
function decodeEntities(s){return s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(Number(d))).replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/&amp;/g,"&");}
function parseSharedStrings(xml){if(!xml)return[];const out=[];const siRe=/<si\b[^>]*>([\s\S]*?)<\/si>/g;let m;while((m=siRe.exec(xml))){let text="";const tRe=/<t\b[^>]*>([\s\S]*?)<\/t>/g;let t;while((t=tRe.exec(m[1])))text+=decodeEntities(t[1]);out.push(text);}return out;}
function colToIndex(ref){const letters=ref.replace(/\d+/g,"");let n=0;for(const ch of letters)n=n*26+(ch.charCodeAt(0)-64);return n-1;}
function parseSheet(xml,shared){const rows=[];const rowRe=/<row\b[^>]*>([\s\S]*?)<\/row>/g;let r;while((r=rowRe.exec(xml))){const cells=[];const cellRe=/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;let c;while((c=cellRe.exec(r[1]))){const attrs=c[1]||"";const inner=c[2]||"";const refM=/r="([A-Z]+\d+)"/.exec(attrs);const idx=refM?colToIndex(refM[1]):cells.length;const type=/t="([^"]+)"/.exec(attrs)?.[1];let value=null;if(type==="inlineStr"){let text="";const tRe=/<t\b[^>]*>([\s\S]*?)<\/t>/g;let t;while((t=tRe.exec(inner)))text+=decodeEntities(t[1]);value=text;}else{const vM=/<v>([\s\S]*?)<\/v>/.exec(inner);if(vM){const raw=decodeEntities(vM[1]);if(type==="s")value=shared[Number(raw)]??"";else if(type==="str"||type==="e")value=raw;else value=raw===""?null:Number(raw);}}while(cells.length<idx)cells.push(null);cells[idx]=value;}rows.push(cells);}return rows;}
const sheetName=Object.keys(raws).find(n=>/^xl\/worksheets\/sheet1\.xml$/i.test(n))??Object.keys(raws).find(n=>/^xl\/worksheets\/.*\.xml$/i.test(n));
if(!sheetName){console.error("مفيش أي شيت جوه الملف");process.exit(1);}
console.log("sheet:",sheetName);
const shared=parseSharedStrings(dec(raws["xl/sharedStrings.xml"]));
console.log("shared strings:",JSON.stringify(shared));
const rows=parseSheet(dec(raws[sheetName]),shared);
console.log("ROWS:",JSON.stringify(rows,null,1));

// --- header matching (importCatalog) ---
function normalizeHeader(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ");}
const HEADER_ALIASES={
 name:["الاسم","اسم الصنف","الصنف","المنتج","name","item","product"],
 category:["المجموعة","الفئة","التصنيف","category","group"],
 code:["الكود","كود","باركود","الباركود","code","barcode","sku"],
 unit:["الوحدة الصغرى","الوحدة","unit"],
 price1:["سعر قطاعي","قطاعي","سعر البيع","السعر","price","retail","retail price"],
 price2:["نص جملة","نصف جملة","سعر نص جملة","mid","half wholesale"],
 price3:["سعر جملة","جملة","wholesale","wholesale price"],
 buyPrice:["سعر الشراء","الشراء","التكلفة","cost","buy price"],
 stock:["الكمية","المخزون","الرصيد","qty","quantity","stock"],
};
let headerIndex=-1;
for(let i=0;i<Math.min(rows.length,20);i++){const hs=rows[i].map(normalizeHeader);if(hs.some(h=>HEADER_ALIASES.name.includes(h))){headerIndex=i;break;}}
console.log("headerIndex:",headerIndex);
if(headerIndex===-1){console.error("مش لاقي صف العناوين");process.exit(1);}
const headers=rows[headerIndex].map(normalizeHeader);
console.log("headers normalized:",JSON.stringify(headers));
const columnOf=(f)=>{const al=HEADER_ALIASES[f].map(a=>a.toLowerCase());return headers.findIndex(h=>al.includes(h));};
const cols={name:columnOf("name"),category:columnOf("category"),code:columnOf("code"),unit:columnOf("unit"),price1:columnOf("price1"),price2:columnOf("price2"),price3:columnOf("price3"),buyPrice:columnOf("buyPrice"),stock:columnOf("stock")};
console.log("cols:",JSON.stringify(cols));
