import {mkdirSync,writeFileSync} from 'node:fs';
import {CHARACTER_IDS,CHARACTER_MAP} from '../src/data/content';
import {LINEAR_REWORKED_TREES as REWORKED_TREES,LINEAR_SKILL_VERSION,resolveSkillTree,ultimateForForm,CAPTAIN_BONUSES} from '../src/data/reworked-skills';
import {deepTreesFor as versionedTrees,DEEP_NODE_MAP} from '../src/data/deep-trees';
import {createRun as versionedRun,command,stepRun} from '../src/sim/engine';
import {deepLegalNodes,deepNodeCost,deepPointCost} from '../src/sim/deep-tree';
import {openDraft} from '../src/sim/draft';
import {createEnemy,hitWall} from '../src/sim/combat';
import type {CharacterId,FormId,RunState,StageId,RunConfig} from '../src/sim/types';
const createRun=(config:RunConfig)=>versionedRun(config,LINEAR_SKILL_VERSION);
const deepTreesFor=(id:CharacterId)=>versionedTrees(id,{contentVersion:LINEAR_SKILL_VERSION});
const out='artifacts/validation/skill-rework';mkdirSync(out,{recursive:true});
function acquire(s:RunState,plan:string[]){for(const nodeId of plan){if(!s.draft)throw Error('Missing offer');if(!command(s,{type:'buy-node',offerId:s.draft.id,nodeId}))throw Error(`Rejected ${nodeId}`);}}
function planFor(id:CharacterId,branch:number,extra:number,budget:number){const trees=deepTreesFor(id),plan:string[]=[];for(const index of [branch,extra,3-branch-extra])for(const n of trees[index].nodes){if(n.kind==='ultimate'&&index!==branch)continue;if(deepPointCost(plan)+deepNodeCost(n.id)<=budget)plan.push(n.id);}return plan;}
const probes:any[]=[];
for(const id of CHARACTER_IDS)for(const theme of ['original','summer'] as const)for(const budget of [6,10])for(const scenario of ['dense','line','shield','armor','boss','pressure'] as const)for(let branch=0;branch<3;branch++)for(let extra=0;extra<3;extra++){
 if(extra===branch)continue;
 const form:FormId=`${id}-${theme}`,plan=planFor(id,branch,extra,budget),s=createRun({stageId:'S12',squadIds:[id],captainId:id,seed:101,forms:{[id]:form}});s.xp=budget*30;s.choicesEarned=budget;openDraft(s);acquire(s,plan);
 s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.wallHp=s.wallMaxHp=1e9;
 const count=['boss','pressure'].includes(scenario)?1:8;
 for(let i=0;i<count;i++){const e=createEnemy(s,scenario==='boss'?'B03':scenario==='shield'?'E04':scenario==='armor'?'E03':'E01',scenario==='line'?195:160+(i%4)*25,scenario==='boss'?300:310+Math.floor(i/4)*30+(scenario==='line'?i*8:0),0,0);e.hp=e.maxHp=1e8;e.speed=0;e.shield=scenario==='shield'?1e8:0;e.armor=scenario==='armor'?.5:0;e.abilityAt=e.summonAt=1e9;}
 for(let t=0;t<2160;t++){if(scenario==='pressure'&&t%90===0)hitWall(s,40,'E01');stepRun(s);}
 probes.push({id,form,budget,scenario,branch,extra,ultimate:plan.some(n=>DEEP_NODE_MAP[n].kind==='ultimate'),damage:Math.round(s.stats.damageByCharacter[id]+s.stats.shieldDamageByCharacter[id]),control:Math.round(s.stats.controlTicks[id]/30),shield:Math.round(s.stats.shieldAbsorbed),casts:s.stats.casts.length});
}
writeFileSync(`${out}/probes.json`,JSON.stringify(probes,null,2));
const comparison=[];for(const id of CHARACTER_IDS)for(const theme of ['original','summer'] as const)for(const budget of [6,10]){const rows=probes.filter(r=>r.form===`${id}-${theme}`&&r.budget===budget);const scenarios=['dense','line','shield','armor','boss'].map(scenario=>{const group=rows.filter(r=>r.scenario===scenario),u=Math.max(...group.filter(r=>r.ultimate).map(r=>r.damage)),n=Math.max(...group.filter(r=>!r.ultimate).map(r=>r.damage));return {scenario,ultimate:u,ordinary:n,ratio:+(u/n).toFixed(2)};});comparison.push({form:`${id}-${theme}`,budget,scenarios});}
writeFileSync(`${out}/comparison.json`,JSON.stringify(comparison,null,2));
console.log(comparison.filter(x=>x.budget===6).map(x=>`${x.form}: ${x.scenarios.map(s=>`${s.scenario} ${s.ratio}`).join(' / ')}`).join('\n'));
const missions:any[]=[];
for(const theme of ['original','summer'] as const)for(const stageId of ['S01','S06','S12'] as StageId[])for(const seed of [101,307])for(const captainId of CHARACTER_IDS){const squadIds=[captainId,...CHARACTER_IDS.filter(x=>x!==captainId)].slice(0,5);const s=createRun({stageId,difficulty:'easy',squadIds,captainId,seed,forms:Object.fromEntries(squadIds.map(id=>[id,`${id}-${theme}`]))});let actions=0;
 for(let guard=0;guard<30000&&!s.outcome;guard++){
  if(s.bossIntro){command(s,{type:'finish-boss-intro'});continue;}
  if(s.draft){const legal=deepLegalNodes(s).filter(id=>deepNodeCost(id,s)<=s.draft!.pointTarget!-s.choicesSpent);const pick=legal.sort((a,b)=>{const na=DEEP_NODE_MAP[a],nb=DEEP_NODE_MAP[b];const own=(id:string)=>(s.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n].ownerId===id).length;return own(na.ownerId)-own(nb.ownerId)||(nb.kind==='ultimate'?1:0)-(na.kind==='ultimate'?1:0)||a.localeCompare(b);})[0];if(!pick||!command(s,{type:'buy-node',offerId:s.draft.id,nodeId:pick}))throw Error('Mission draft stuck');actions++;continue;}
  stepRun(s);
 }
 missions.push({stageId,seed,captainId,theme,outcome:s.outcome,tick:s.tick,hp:Math.round(s.wallHp),points:s.choicesSpent,casts:s.stats.casts.length,actions});
}
writeFileSync(`${out}/missions.json`,JSON.stringify(missions,null,2));console.log(`Campaign smoke: ${missions.length} runs, ${missions.filter(m=>m.outcome==='victory').length} wins; ${missions.filter(m=>!m.outcome).length} unfinished`);
let doc=`# 技能樹重製 0.5.0-dev.1（歷史版本）\n\n目前版本見 [分岔技能樹](SKILL_NETWORK.md)。\n\n每位角色 3 條直線分支，各 5 節點；可跨分支配點。普通節點 1 點，指定分支最後的終極 2 點，每位最多一個，全滿 16 點。夏日換裝替換每條分支第三節點與終極，其餘位置、前置與武器共用。\n\n終極取得後先冷卻；各角色獨立計時，有有效目標時自動施放。C06 另要求缺盾、C07 要求地雷覆蓋敵人、C08 要求熱量 ≥70。暫停時停止計時；無手動施放、過場或時間凍結。隊長加成開場生效且不受換裝影響。\n\n百波總點數 60，前 20 波每波 36 經驗，中 40 波 14，後 40 波 13，共 1800；原波次與敵人未調整。普通關卡預算保持不變。禁止終極挑戰保留 no-skill ID；最多兩終極保留 two-evolutions ID。收藏、獎勵紀錄沿用。舊技能 ID 與版本保留，以版本分流。\n\n`;
for(const id of CHARACTER_IDS){doc+=`## ${id} ${CHARACTER_MAP[id].name}\n\n隊長：${CAPTAIN_BONUSES[id].name} — ${CAPTAIN_BONUSES[id].description}\n\n`;for(const tree of REWORKED_TREES.filter(t=>t.ownerId===id)){const summer=resolveSkillTree(tree,`${id}-summer`);doc+=`### ${tree.name}\n\n| 位置 | 原裝 | 夏日換裝差異 |\n|---|---|---|\n`;for(let i=0;i<5;i++){const n=tree.nodes[i],a=summer.nodes[i];doc+=`| ${i+1}${n.kind==='ultimate'?'（終極／2 點）':''} | ${n.name}：${n.description} | ${a.name===n.name?'共用':`${a.name}：${a.description}`} |\n`;}doc+='\n';}doc+=`終極冷卻：原裝 ${ultimateForForm(id).cooldown} 秒，夏日 ${ultimateForForm(id,`${id}-summer`).cooldown} 秒。\n\n`;}
doc+=`## 驗證方法與限制\n\n執行 \`npx tsx scripts/validate-skill-rework.ts\` 可重現 ${probes.length} 組 72 秒固定敵人試算（16 形態、6／10 點、六情境（密集、縱列、護盾、裝甲、首領、定時防線傷害）、分支配置），另有 ${missions.length} 局 S01／S06／S12、雙種子、各角色隊長的冒煙測試。試算含各角色自身隊長加成，控場／護盾需分別解讀；不是角色總價值排名，也不能證明所有隊伍等強。關卡冒煙測試使用固定自動配點政策，勝率不能視為玩家通關率。\n\n資料：\`artifacts/validation/skill-rework/{probes,comparison,missions}.json\`。需持續觀察真實關卡中的隊伍互補、無終極構築與換裝選擇率。\n`;
mkdirSync('docs',{recursive:true});writeFileSync('docs/SKILL_REWORK.md',doc);
