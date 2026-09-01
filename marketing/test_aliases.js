
const fs=require('fs');
const src=fs.readFileSync('C:/Users/LOGO/Desktop/octopus/lib/importCatalog.ts','utf8');
const m=/const HEADER_ALIASES[\s\S]*?\n\};/.exec(src)[0];
const objSrc=m.replace(/^const HEADER_ALIASES[^=]*=/,'').trim();
eval('globalThis.HA='+objSrc);
function normalizeHeader(v){return String(v??"").trim().toLowerCase().replace(/\s+/g," ");}
const tests=[
 ["اسم الصنف","المجموعة","السعر","كمية"],
 ["الصنف","مجموعة","سعر بيع","رصيد"],
 ["name","category","price","qty"],
 ["المنتج","تصنيف","قطاعي","المخزون","الوحدة"],
];
let pass=0, fail=0;
for(const headers of tests){
  const hs=headers.map(normalizeHeader);
  const columnOf=(f)=>{const al=HA[f].map(a=>a.toLowerCase());return hs.findIndex(h=>al.includes(h));};
  const name=columnOf("name"), price1=columnOf("price1"), stock=columnOf("stock");
  const ok=name!==-1&&price1!==-1;
  console.log(ok?"PASS":"FAIL", JSON.stringify(headers), "=> name:",name,"price:",price1,"stock:",stock);
  ok?pass++:fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
