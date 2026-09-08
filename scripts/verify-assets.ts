import { readFileSync, statSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { CONTENT_VERSION, ENEMIES } from '../src/data/content';
import { STARTER_IDS as CHARACTER_IDS, POOL, FORMS, formPortrait, formMotion, formBackdrop } from '../src/data/forms';

const portraitBackgrounds=[...new Set(FORMS.map(f=>formBackdrop(f.id)).filter((path):path is string=>!!path))];

const expected = [
  ...CHARACTER_IDS.flatMap(id => [`characters/${id}-portrait.webp`, `characters/${id}-chibi.webp`, `weapons/${id}.webp`, `evolutions/${id}-A.webp`, `evolutions/${id}-B.webp`]),
  ...ENEMIES.map(e => `enemies/${e.id}.webp`), ...['S01','S02','S03'].map(id => `stages/${id}.webp`), ...POOL.map(f=>formPortrait(f.id).replace('/assets/','')), ...['coast','resonance','hive','summer'].map(id=>`campaign/${id}.webp`),
  ...FORMS.map(form => formMotion(form.id).replace('/assets/', '')),
  ...portraitBackgrounds.map(path=>path.replace('/assets/','')),
  ...ENEMIES.map(e => `enemy-animations/${e.id}-motion.webp`),
];
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as {assetId:string;path:string;width:number;height:number;bytes:number}[];
const missing = expected.filter(path => !existsSync(`public/assets/${path}`));
const invalidManifest = manifest.filter(asset => !existsSync(`public${asset.path}`) || statSync(`public${asset.path}`).size !== asset.bytes || asset.width > 2048 || asset.height > 2048);
const walk=(path:string):string[]=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${path}/${entry.name}`):[`${path}/${entry.name}`]);
const files=walk('public/assets');
const runtimeBytes=files.reduce((n,path)=>n+statSync(path).size,0);
const bundles=walk('dist').filter(path=>/\.(js|css|html)$/.test(path)).map(path=>({path,rawBytes:statSync(path).size,gzipBytes:gzipSync(readFileSync(path)).length}));
const bundleGzip=bundles.reduce((n,x)=>n+x.gzipBytes,0);
const portraitBackgroundBytes=manifest.filter(a=>portraitBackgrounds.includes(a.path)).reduce((n,a)=>n+a.bytes,0);
const homeImages=manifest.filter(a=>a.assetId.endsWith('-portrait')).reduce((n,a)=>n+a.bytes,0)+portraitBackgroundBytes;
const largestMotionByOwner = [...new Set(FORMS.map(f=>f.ownerId))].map(owner=>Math.max(...FORMS.filter(f=>f.ownerId===owner).map(f=>manifest.find(a=>a.path===formMotion(f.id))?.bytes??0))).sort((a,b)=>b-a);
const maxCaptainPortrait = Math.max(...FORMS.map(f=>manifest.find(a=>a.path===formPortrait(f.id))?.bytes??0));
const battleAssetBytes=largestMotionByOwner.slice(0,5).reduce((n,bytes)=>n+bytes,0)+manifest.filter(a=>a.path.includes('/enemy-animations/')).reduce((n,a)=>n+a.bytes,0)+maxCaptainPortrait+portraitBackgroundBytes+Math.max(...manifest.filter(a=>a.path.includes('/stages/')||a.path.includes('/campaign/')).map(a=>a.bytes));
const decodedAllBytes=manifest.reduce((n,a)=>n+a.width*a.height*4,0);
// Ally/enemy sheets now ship alpha. Only the current captain portrait needs a keyed copy.
const keyedCopies=Math.max(...FORMS.map(f=>{const a=manifest.find(a=>a.path===formPortrait(f.id));return a?a.width*a.height*4:0;}));
const result={contentVersion:CONTENT_VERSION,measuredAt:new Date().toISOString(),requiredAssets:expected.length,manifestAssets:manifest.length,missing,invalidManifest:invalidManifest.map(a=>a.assetId),runtimeBytes,bundles,
  conservativeHomeTransferBytes:bundleGzip+homeImages,
  conservativeFirstBattleBytes:bundleGzip+battleAssetBytes,
  conservativeDecodedBytesIncludingKeyedCopies:decodedAllBytes+keyedCopies+390*520*4,
  notes:'Static upper bounds: home includes six starter portraits and all portrait backgrounds. Battle includes the five largest per-owner motion sheets (maximum squad size), all enemy motion, the largest captain portrait and stage, plus all portrait backgrounds for UI. Each form has its own sheet loaded on demand. Legacy static weapon/enemy/evolution art and other stages are not requested by BattleScene. WebP uses stored bytes; code uses measured gzip. Decoded bound includes every manifest texture plus the largest keyed captain copy and world RenderTexture; it excludes browser/GPU overhead. Network timing measured separately.',
  passed:missing.length===0&&invalidManifest.length===0&&runtimeBytes<=20*1024**2&&bundleGzip+homeImages<=4*1024**2&&bundleGzip+battleAssetBytes<=8*1024**2&&decodedAllBytes+keyedCopies+390*520*4<=128*1024**2,
  sha256:files.map(path=>({path,hash:createHash('sha256').update(readFileSync(path)).digest('hex')})),
};
const outputDir=process.env.VALIDATION_OUTPUT_DIR??`artifacts/validation/${CONTENT_VERSION}`;
mkdirSync(outputDir,{recursive:true});writeFileSync(`${outputDir}/asset-budget.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,sha256:undefined},null,2));
if(!result.passed)process.exitCode=1;
