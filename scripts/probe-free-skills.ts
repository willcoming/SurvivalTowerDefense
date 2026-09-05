import { mkdirSync,writeFileSync } from 'node:fs';
import { ALL_TERMINALS,pathTo } from '../tests/helpers/deep-build';
import { createRun,command,stepRun } from '../src/sim/engine';
import { openDraft } from '../src/sim/draft';
import { createEnemy } from '../src/sim/combat';
import type { CharacterId } from '../src/sim/types';
const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/free-skills';mkdirSync(dir,{recursive:true});
const rows=[];
for(const terminal of ALL_TERMINALS)for(const scenario of ['relay','armor','line','boss','shield','boss-armor','wounded','team']){
  const owner=terminal.ownerId as CharacterId,s=createRun({stageId:'S03',squadIds:scenario==='team'?[owner,...(['C01','C03','C05'] as CharacterId[]).filter(id=>id!==owner).slice(0,2)]:[owner],captainId:owner,seed:101});s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.xp=720;s.choicesEarned=24;openDraft(s);
  for(const id of pathTo(terminal.id))if(!command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:id}))throw new Error('Invalid probe investment');
  s.draft=null;s.pauseReasons=[];s.phase='running';s.choicesEarned=s.choicesSpent;
  const boss=scenario==='boss'||scenario==='boss-armor';
  const count=boss?1:scenario==='relay'?8:10;
  for(let i=0;i<count;i++){
    const e=createEnemy(s,boss?'B01':'E03',scenario==='line'||boss?195:scenario==='relay'?55+i*40:145+i%4*32,scenario==='line'?80+i*30:boss?290:scenario==='relay'?270+(i%2)*70:270+Math.floor(i/4)*30,0,0);
    e.hp=e.maxHp=1e8;if(scenario==='wounded')e.hp=e.maxHp*.2;e.shield=scenario==='shield'?1e8:0;e.armor=scenario==='armor'||scenario==='boss-armor'?.55:0;e.speed=0;e.abilityAt=e.summonAt=1e9;e.spawnedAt=0;
  }
  stepRun(s,1200);
  rows.push({terminal:terminal.id,name:terminal.name,scenario,damage:s.stats.damageByCharacter[owner],shieldDamage:s.stats.shieldDamageByCharacter[owner],controlSeconds:s.stats.controlTicks[owner]/30,attacks:s.weapons[0].attacks,teamDamage:Object.values(s.stats.damageByCharacter).reduce((a,b)=>a+b,0),squad:s.config.squadIds});
}
writeFileSync(`${dir}/matchups.json`,JSON.stringify({limitation:'Synthetic stationary high-HP 40-second targets; five legally purchased ancestor/ultimate nodes, no captain input. Additional diagnostic scenarios: armored Boss, 20%-HP targets and two unupgraded damage allies, to check execution and team-support value. Not legal-stage wins; displacement still moves targets, so control trades damage windows for distance.',rows},null,2));console.log(`${rows.length} matchup probes completed`);
