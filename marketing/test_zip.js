const fs=require('fs'), zlib=require('zlib');
const buffer=fs.readFileSync('C:/Users/LOGO/Desktop/octopus/marketing/test_items.xlsx');
const b=new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
function u16(b,o){return b[o]|(b[o+1]<<8);}
function u32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
let eocd=-1;
for(let i=b.length-22;i>=0;i--){if(u32(b,i)===0x06054b50){eocd=i;break;}}
console.log("eocd",eocd,"len",b.length);
const count=u16(b,eocd+10); let p=u32(b,eocd+16);
console.log("count",count);
for(let i=0;i<count;i++){
  const method=u16(b,p+10), compSize=u32(b,p+20), uncompSize=u32(b,p+24), nameLen=u16(b,p+28), extraLen=u16(b,p+30), commentLen=u16(b,p+32), localOff=u32(b,p+42);
  const name=new TextDecoder().decode(b.subarray(p+46,p+46+nameLen));
  console.log(name,"method",method,"comp",compSize,"uncomp",uncompSize);
  if(method!==0){
    const lNameLen=u16(b,localOff+26), lExtraLen=u16(b,localOff+28);
    const dataStart=localOff+30+lNameLen+lExtraLen;
    try{
      const out=zlib.inflateRawSync(Buffer.from(b.slice(dataStart,dataStart+compSize)));
      console.log("  inflated OK:",out.length,"first60:",new TextDecoder().decode(out).slice(0,60).replace(/\n/g," "));
    }catch(e){console.log("  INFLATE FAIL:",e.message);}
  }
  p+=46+nameLen+extraLen+commentLen;
}
