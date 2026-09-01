
const fs = require('fs');

function u16(b,o){return b[o]|(b[o+1]<<8);}
function u32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}

async function main(){
const buffer = fs.readFileSync('C:/Users/LOGO/Desktop/octopus/marketing/test_items.xlsx');
const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset+buffer.byteLength);
const b = new Uint8Array(ab);
let eocd=-1;
for(let i=b.length-22;i>=0&&i>b.length-22-65536;i--){if(u32(b,i)===0x06054b50){eocd=i;break;}}
if(eocd<0) throw new Error("not xlsx");
const count=u16(b,eocd+10); let p=u32(b,eocd+16);
const files={};
for(let i=0;i<count;i++){
  if(u32(b,p)!==0x02014b50) break;
  const method=u16(b,p+10), compSize=u32(b,p+20), nameLen=u16(b,p+28), extraLen=u16(b,p+30), commentLen=u16(b,p+32), localOff=u32(b,p+42);
  const name=new TextDecoder().decode(b.subarray(p+46,p+46+nameLen));
  const lNameLen=u16(b,localOff+26), lExtraLen=u16(b,localOff+28);
  const dataStart=localOff+30+lNameLen+lExtraLen;
  const raw=b.subarray(dataStart,dataStart+compSize);
  files[name]=method===0?raw:"INFLATED:"+raw.length;
  p+=46+nameLen+extraLen+commentLen;
}
console.log("ZIP parts found:", Object.keys(files).join(", "));

// now actually inflate using node zlib raw
const zlib=require('zlib');
function inflate(raw){return zlib.inflateRawSync(Buffer.from(raw));}
const dec=(u)=>u?new TextDecoder().decode(u):"";
function xml(name){const f=files[name]; if(!f||typeof f==="string")return ""; return dec(inflate(f));}

const sheet = xml('xl/worksheets/sheet1.xml');
const ssXml = xml('xl/sharedStrings.xml');
// shared strings
const out=[]; const siRe=/<si\b[^>]*>([\s\S]*?)<\/si>/g; let m;
while((m=siRe.exec(ssXml))){let text=""; const tRe=/<t\b[^>]*>([\s\S]*?)<\/t>/g; let t; while((t=tRe.exec(m[1])))text+=t[1]; out.push(text);}
console.log("sharedStrings:", JSON.stringify(out));
// rows
const rowRe=/<row\b[^>]*>([\s\S]*?)<\/row>/g; let r; const rows=[];
while((r=rowRe.exec(sheet))){
  const cellsArr=[]; const cellRe=/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g; let c;
  while((c=cellRe.exec(r[1]))){
    const attrs=c[1]||""; const inner=c[2]||"";
    const refM=/r="([A-Z]+\d+)"/.exec(attrs); 
    function colToIndex(ref){const letters=ref.replace(/\d+/g,"");let n=0;for(const ch of letters)n=n*26+(ch.charCodeAt(0)-64);return n-1;}
    const idx=refM?colToIndex(refM[1]):cellsArr.length;
    const type=/t="([^"]+)"/.exec(attrs)?.[1];
    let value=null;
    if(type==="inlineStr"){let text="";const tRe=/<t\b[^>]*>([\s\S]*?)<\/t>/g;let t;while((t=tRe.exec(inner)))text+=t[1];value=text;}
    else{const vM=/<v>([\s\S]*?)<\/v>/.exec(inner);if(vM){const raw=vM[1];if(type==="s")value=out[Number(raw)]??"";else if(type==="str"||type==="e")value=raw;else value=raw===""?null:Number(raw);}}
    while(cellsArr.length<idx)cellsArr.push(null);
    cellsArr[idx]=value;
  }
  rows.push(cellsArr);
}
console.log("PARSED ROWS:", JSON.stringify(rows,null,1));
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
