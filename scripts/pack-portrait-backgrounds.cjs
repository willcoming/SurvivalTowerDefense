const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('sharp');

// Generated source art is archived separately; this step only resizes and compresses it.
async function main(){
  const input=JSON.parse(fs.readFileSync('artifacts/portrait-background-sources/generated.json','utf8'));
  fs.mkdirSync('public/assets/portrait-backgrounds',{recursive:true});
  const entries=[];
  for(const asset of input.assets){
    if(!/^[a-z]+$/.test(asset.id)||! /^[a-z]+-v\d+\.webp$/.test(asset.filename))throw Error('Invalid background ID or filename');
    const source=path.resolve(asset.source);
    const output=`public/assets/portrait-backgrounds/${asset.filename}`;
    await sharp(source).resize(512,768,{fit:'cover'}).webp({quality:90,effort:6}).toFile(output);
    const bytes=fs.readFileSync(output),meta=await sharp(bytes).metadata();
    entries.push({assetId:`${asset.id}-portrait-background`,path:output.replace('public',''),width:meta.width,height:meta.height,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),source:asset.source,prompt:asset.prompt,reference:asset.reference,tool:'imagegen built-in',backgroundMode:'opaque',loadGroup:'portrait-background'});
  }
  const ids=new Set(entries.map(a=>a.assetId));
  const manifest=JSON.parse(fs.readFileSync('public/assets/manifest.json','utf8')).filter(a=>!ids.has(a.assetId));
  fs.writeFileSync('public/assets/manifest.json',JSON.stringify([...manifest,...entries],null,2));
  console.log(JSON.stringify(entries.map(({assetId,width,height,bytes})=>({assetId,width,height,bytes})),null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
