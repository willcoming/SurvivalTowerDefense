import { createRun } from '../tests/helpers/previous-tree-run';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SKILL_TREES } from '../src/data/skill-trees';
import { command, stepRun } from '../src/sim/engine';
import { openDraft } from '../src/sim/draft';
import { createEnemy } from '../src/sim/combat';
import type { EnemyId } from '../src/sim/types';
const scenarios: {id:string;enemy:EnemyId;positions:number[][]}[]=[
  {id:'relay',enemy:'E01',positions:[[45,240],[145,240],[245,240],[345,240],[45,340],[145,340],[245,340],[345,340]]},
  {id:'armor-zone',enemy:'E03',positions:[[145,270],[170,275],[195,280],[220,275],[245,270]]},
  {id:'long-line',enemy:'E03',positions:[[195,190],[195,225],[195,260],[195,295],[195,330],[195,365]]},
  {id:'boss',enemy:'B03',positions:[[195,150]]},
  {id:'shield',enemy:'E04',positions:[[150,265],[195,290],[240,265]]},
];
const rows=[];
for(const tree of SKILL_TREES)for(const scene of scenarios) {
  const s=createRun({stageId:'S03',squadIds:[tree.ownerId],captainId:tree.ownerId,seed:101});s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;
  s.choicesEarned=4;s.xp=160;openDraft(s);
  for(const index of tree.id==='C01-A'?[0,1,3,4]:[0,1,2,4]){const nodeId=`${tree.id}:${index}`;if(!command(s,{type:'custom-node',nodeId})||!command(s,{type:'choose',offerId:s.draft!.id,nodeId}))throw new Error('Probe choice rejected');}
  for(const [x,y] of scene.positions){const e=createEnemy(s,scene.enemy,x,y,0);e.hp=e.maxHp=1e8;e.speed=0;e.attackAt=e.abilityAt=e.summonAt=999999;if(scene.id==='shield')e.shield=1e8;}
  s.tacticalReadyAt=999999;stepRun(s,1200);
  rows.push({tree:tree.id,scenario:scene.id,damage:s.stats.damageByCharacter[tree.ownerId],shieldDamage:s.stats.shieldDamageByCharacter[tree.ownerId],controlSeconds:s.stats.controlTicks[tree.ownerId]/30,attacks:s.weapons[0].attacks});
}
const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/skill-trees/probes';mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}/matchups.json`,JSON.stringify({limitation:'Synthetic 40-second stationary high-HP matchup probes, four legally acquired nodes and captain disabled; not a legal-stage victory test. Targets use actual armor and shield formulas. Distinct layouts isolate weapon specialization.',rows},null,2));
for(const id of ['C01','C02','C03','C04','C05','C06'])console.log(id,rows.filter(r=>r.tree.startsWith(id)).map(r=>`${r.tree}/${r.scenario}=${Math.round(r.damage+r.shieldDamage)}`).join(' '));
