import {spawn} from 'node:child_process';
import {mkdirSync,readdirSync,unlinkSync} from 'node:fs';
const workers=Number(process.argv.find(a=>a.startsWith('--workers='))?.split('=')[1]??4);
if(!Number.isInteger(workers)||workers<1||workers>16)throw Error('workers must be 1–16');
const directory='artifacts/validation/tactical-rework';mkdirSync(directory,{recursive:true});
// Only regenerate this validator's final shards. Archived iterations and browser evidence stay intact.
for(const folder of [directory,`${directory}/rescue`]){mkdirSync(folder,{recursive:true});for(const f of readdirSync(folder))if(/^(matrix|probes)-\d+\.json$/.test(f))unlinkSync(`${folder}/${f}`);}
function run(script,args=[]){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',script,...args],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${script}: exit ${code}`)));});}
for(const script of ['scripts/validate-tactical-balance.ts','scripts/validate-tactical-probes.ts'])await Promise.all(Array.from({length:workers},(_,i)=>run(script,[`--shard=${i}`,`--shards=${workers}`])));
await Promise.all(Array.from({length:workers},(_,i)=>run('scripts/validate-tactical-balance.ts',[`--shard=${i}`,`--shards=${workers}`,'--rescue',`--output=${directory}/rescue`])));
await run('scripts/report-tactical-balance.ts');
