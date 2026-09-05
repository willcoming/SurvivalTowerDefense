const fs=require('node:fs');
const crypto=require('node:crypto');
const sharp=require(process.env.SHARP_MODULE||'sharp');
const source=JSON.parse(fs.readFileSync('artifacts/collection-sources/generated.json'));
const selected=new Set(process.argv.slice(2));
for(const id of selected)if(!source.assets.some(asset=>asset.id===id))throw Error('Unknown collection asset: '+id);
(async()=>{
  const entries=[];
  for(const asset of source.assets){
    if(selected.size&&!selected.has(asset.id))continue;
    const dir=asset.kind==='form'?'forms':'campaign';fs.mkdirSync('public/assets/'+dir,{recursive:true});
    const filename=asset.filename||asset.id+'.webp';
    if(!/^[A-Za-z0-9-]+\.webp$/.test(filename))throw Error('Invalid asset filename: '+filename);
    const target='public/assets/'+dir+'/'+filename;
    await sharp(asset.source).resize(asset.kind==='form'?512:768,asset.kind==='form'?768:1152,{fit:'inside'}).webp({quality:88,effort:6}).toFile(target);
    const bytes=fs.readFileSync(target),meta=await sharp(bytes).metadata();
    entries.push({assetId:asset.id+(asset.kind==='form'?'-form':'-campaign'),path:target.replace('public',''),width:meta.width,height:meta.height,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),tool:source.mode,source:asset.source,promptBrief:asset.subject,backgroundMode:asset.kind==='form'?'runtime-magenta-key':'opaque',loadGroup:asset.kind});
  }
  const ids=new Set(entries.map(a=>a.assetId));
  const previous=JSON.parse(fs.readFileSync('public/assets/manifest.json')).filter(a=>!ids.has(a.assetId));
  fs.writeFileSync('public/assets/manifest.json',JSON.stringify([...previous,...entries],null,2));
  console.log(entries.map(({assetId,bytes,width,height})=>({assetId,bytes,width,height})));
})();
