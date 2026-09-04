import { readFileSync, statSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { CONTENT_VERSION, CHARACTER_IDS, ENEMIES, STAGES } from '../src/data/content';

const expected = [
  ...CHARACTER_IDS.flatMap(id => [`characters/${id}-portrait.webp`, `characters/${id}-chibi.webp`, `weapons/${id}.webp`, `evolutions/${id}-A.webp`, `evolutions/${id}-B.webp`]),
  ...ENEMIES.map(e => `enemies/${e.id}.webp`), ...STAGES.map(s => `stages/${s.id}.webp`),
  ...CHARACTER_IDS.map(id => `animations/${id}-motion.webp`),
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
const homeImages=manifest.filter(a=>a.assetId.endsWith('-portrait')).reduce((n,a)=>n+a.bytes,0);
const decodedAllBytes=manifest.reduce((n,a)=>n+a.width*a.height*4,0);
const keyedCopies=manifest.filter(a=>a.path.includes('/enemies/')||a.assetId.endsWith('-chibi')).reduce((n,a)=>n+a.width*a.height*4,0);
const result={contentVersion:CONTENT_VERSION,measuredAt:new Date().toISOString(),requiredAssets:expected.length,manifestAssets:manifest.length,missing,invalidManifest:invalidManifest.map(a=>a.assetId),runtimeBytes,bundles,
  conservativeHomeTransferBytes:bundleGzip+homeImages,
  conservativeFirstBattleBytes:bundleGzip+runtimeBytes,
  conservativeDecodedBytesIncludingKeyedCopies:decodedAllBytes+keyedCopies+390*520*4,
  notes:'Static upper bounds: home includes all six portraits; first battle includes ALL runtime artwork. WebP is counted as stored; code uses measured gzip. Decoded estimate includes every manifest texture plus extra keyed combat copies and the390×520 world RenderTexture, but excludes browser/GPU allocation overhead. Network timing measured separately in production smoke.',
  passed:missing.length===0&&invalidManifest.length===0&&runtimeBytes<=20*1024**2&&bundleGzip+homeImages<=4*1024**2&&bundleGzip+runtimeBytes<=8*1024**2&&decodedAllBytes+keyedCopies+390*520*4<=128*1024**2,
  sha256:files.map(path=>({path,hash:createHash('sha256').update(readFileSync(path)).digest('hex')})),
};
const outputDir=process.env.VALIDATION_OUTPUT_DIR??`artifacts/validation/${CONTENT_VERSION}`;
mkdirSync(outputDir,{recursive:true});writeFileSync(`${outputDir}/asset-budget.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,sha256:undefined},null,2));
if(!result.passed)process.exitCode=1;
