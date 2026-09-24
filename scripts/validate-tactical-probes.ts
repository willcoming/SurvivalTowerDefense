import {mkdirSync,writeFileSync} from 'node:fs';
import {CHARACTER_IDS} from '../src/data/content';
import {deepTreesFor,DEEP_NODE_MAP} from '../src/data/deep-trees';
import {createRun,command,stepRun} from '../src/sim/engine';
import {deepPointCost,deepNodeCost} from '../src/sim/deep-tree';
import {openDraft} from '../src/sim/draft';
import {createEnemy,hitWall} from '../src/sim/combat';
import {pathsTo} from './tactical-policy';
import type {CharacterId,EnemyId} from '../src/sim/types';
const dir=process.argv.find(s=>s.startsWith('--output='))?.split('=')[1]??'artifacts/validation/tactical-rework';mkdirSync(dir,{recursive:true});
const opt=(key:string,fallback:string)=>process.argv.find(s=>s.startsWith(`--${key}=`))?.split('=')[1]??fallback;
const shard=Number(opt('shard','0')),shards=Number(opt('shards','1'));
const scenarios=['dense','spread','line','shield','armor','boss','pressure'] as const;
function plans(owner:CharacterId,budget:number){
 const nodes=deepTreesFor(owner).flatMap(t=>t.nodes),leaves=nodes.filter(n=>!nodes.some(c=>c.parents.includes(n.id)));
 const unique=new Map<string,string[]>();
 for(const leaf of leaves)for(const path of pathsTo(leaf.id)){
  const plan:string[]=[];for(const id of path){if(deepPointCost(plan)+deepNodeCost(id)>budget)break;plan.push(id);}
  while(deepPointCost(plan)<budget){const candidates=nodes.filter(n=>n.kind!=='ultimate'&&!plan.includes(n.id)&&(!n.parents.length||n.parents.some(p=>plan.includes(p))));const next=candidates.sort((a,b)=>(b.treeId===leaf.treeId?1:0)-(a.treeId===leaf.treeId?1:0)||b.layer-a.layer||a.id.localeCompare(b.id))[0];if(!next)break;plan.push(next.id);}
  unique.set([...plan].sort().join(),plan);
 }
 return [...unique.values()];
}
let index=0;const rows:any[]=[];
for(const owner of CHARACTER_IDS)for(const theme of ['original','summer'] as const)for(const budget of [4,6,10,14])for(const plan of plans(owner,budget))for(const scenario of scenarios){
 if(index++%shards!==shard||opt('owner','')&&owner!==opt('owner',''))continue;
 const s=createRun({stageId:'S12',squadIds:[owner],captainId:owner,seed:101,forms:{[owner]:`${owner}-${theme}`}});
 s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.xp=budget*30;s.choicesEarned=budget;openDraft(s);
 for(const nodeId of plan)if(!command(s,{type:'buy-node',offerId:s.draft!.id,nodeId}))throw Error(`Invalid probe ${nodeId}`);
 if(s.draft)throw Error('Unspent budget');
 const spawn=()=>{const count=scenario==='boss'?1:6;for(let i=0;i<count;i++){
  const id:EnemyId=scenario==='boss'?'B03':scenario==='shield'?'E04':scenario==='armor'?'E03':'E01';
  const x=scenario==='line'?195:scenario==='spread'?35+(i%3)*160:160+(i%3)*25,y=scenario==='boss'?230:80+Math.floor(i/3)*25;
  const e=createEnemy(s,id,x,y,0,1);e.hp=e.maxHp=scenario==='boss'?10000:550;e.shield=scenario==='shield'?550:0;e.armor=scenario==='armor'?.5:e.armor;
 }};
 let killedAt:number|null=null;
 for(let tick=0;tick<2700&&!s.outcome;tick++){
  if(tick%720===0&&(scenario!=='boss'||tick===0))spawn();
  if(scenario==='pressure'&&tick%90===0)hitWall(s,30,'E01');
  stepRun(s);if(s.bossKilled&&killedAt===null)killedAt=s.tick/30;if(s.tick%300===0)s.events=[];
 }
 rows.push({owner,form:`${owner}-${theme}`,budget,scenario,plan,ultimate:plan.some(id=>DEEP_NODE_MAP[id].kind==='ultimate'),damage:s.stats.damageByCharacter[owner]+s.stats.shieldDamageByCharacter[owner],wallLoss:1000-s.wallHp,absorbed:s.stats.shieldAbsorbed,control:s.stats.controlTicks[owner]/30,kills:s.stats.kills,casts:s.stats.casts.length,seconds:s.tick/30,killedAt});
 if(rows.length%100===0)console.log(`probe shard ${shard}: ${rows.length}`);
}
writeFileSync(`${dir}/probes-${shard}.json`,JSON.stringify(rows));console.log(`probe shard ${shard}: complete ${rows.length}`);
