import {mkdirSync,writeFileSync} from 'node:fs';
import {CHARACTER_IDS,CHARACTER_MAP} from '../src/data/content';
import {resolveSkillTree,CAPTAIN_BONUSES} from '../src/data/reworked-skills';
import {deepTreesFor,DEEP_NODE_MAP,type DeepNode} from '../src/data/deep-trees';
import {NETWORK_CONTENT_VERSION} from '../src/data/skill-network';
import {createRun,command,stepRun} from '../src/sim/engine';
import {deepLegalNodes,deepNodeCost,deepPointCost} from '../src/sim/deep-tree';
import {openDraft} from '../src/sim/draft';
import {createEnemy,hitWall} from '../src/sim/combat';
import type {CharacterId,FormId,RunState,StageId} from '../src/sim/types';
const out='artifacts/validation/skill-network';mkdirSync(out,{recursive:true});
const routes=(n:DeepNode):string[][]=>n.parents.length?n.parents.flatMap(p=>routes(DEEP_NODE_MAP[p]).map(path=>[...path,n.id])):[[n.id]];
function plansFor(owner:CharacterId,budget:number){
 const nodes=deepTreesFor(owner).flatMap(t=>t.nodes),leaves=nodes.filter(n=>!nodes.some(c=>c.parents.includes(n.id))),plans:string[][]=[];
 for(const leaf of leaves){const paths=routes(leaf);for(const path of [paths[0],paths.at(-1)!]){
  const plan=[...path];while(deepPointCost(plan)<budget){const candidate=nodes.find(n=>n.kind!=='ultimate'&&!plan.includes(n.id)&&(!n.parents.length||n.parents.some(p=>plan.includes(p))));if(!candidate)throw Error('Insufficient legal ordinary skills');plan.push(candidate.id);}
  if(!plans.some(p=>p.join()===plan.join()))plans.push(plan);
 }}return plans;
}
function acquire(s:RunState,plan:string[]){for(const nodeId of plan)if(!s.draft||!command(s,{type:'buy-node',offerId:s.draft.id,nodeId}))throw Error(`Rejected ${nodeId}`);if(s.draft)throw Error('Probe budget did not close draft');}
const scenarios=['dense','line','shield','armor','boss','pressure'] as const;
const probes:{id:CharacterId;form:FormId;budget:number;scenario:string;plan:string[];ultimate:boolean;damage:number;control:number;shield:number;casts:number}[]=[];
for(const id of CHARACTER_IDS)for(const theme of ['original','summer'] as const)for(const budget of [6,10])for(const plan of plansFor(id,budget))for(const scenario of scenarios){
 const form:FormId=`${id}-${theme}`,s=createRun({stageId:'S12',squadIds:[id],captainId:id,seed:101,forms:{[id]:form}});s.xp=budget*30;s.choicesEarned=budget;openDraft(s);acquire(s,plan);
 s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.wallHp=s.wallMaxHp=1e9;
 for(let i=0;i<(['boss','pressure'].includes(scenario)?1:8);i++){const e=createEnemy(s,scenario==='boss'?'B03':scenario==='shield'?'E04':scenario==='armor'?'E03':'E01',scenario==='line'?195:160+(i%4)*25,scenario==='boss'?300:310+Math.floor(i/4)*30+(scenario==='line'?i*8:0),0,0);e.hp=e.maxHp=1e8;e.speed=0;e.shield=scenario==='shield'?1e8:0;e.armor=scenario==='armor'?.5:0;e.abilityAt=e.summonAt=1e9;}
 for(let t=0;t<2160;t++){if(scenario==='pressure'&&t%90===0)hitWall(s,40,'E01');stepRun(s);}
 probes.push({id,form,budget,scenario,plan,ultimate:plan.some(n=>DEEP_NODE_MAP[n].kind==='ultimate'),damage:Math.round(s.stats.damageByCharacter[id]+s.stats.shieldDamageByCharacter[id]),control:Math.round(s.stats.controlTicks[id]/30),shield:Math.round(s.stats.shieldAbsorbed),casts:s.stats.casts.length});
}
writeFileSync(`${out}/probes.json`,JSON.stringify(probes,null,2));
const comparison=[];for(const id of CHARACTER_IDS)for(const theme of ['original','summer'] as const)for(const budget of [6,10]){const rows=probes.filter(r=>r.form===`${id}-${theme}`&&r.budget===budget);comparison.push({form:`${id}-${theme}`,budget,scenarios:scenarios.map(scenario=>{const group=rows.filter(r=>r.scenario===scenario),u=Math.max(...group.filter(r=>r.ultimate).map(r=>r.damage)),n=Math.max(...group.filter(r=>!r.ultimate).map(r=>r.damage));return {scenario,ultimate:u,ordinary:n,damageRatio:n?+(u/n).toFixed(2):null,control:Math.max(...group.map(r=>r.control)),shield:Math.max(...group.map(r=>r.shield))};})});}
writeFileSync(`${out}/comparison.json`,JSON.stringify(comparison,null,2));
console.log(`${probes.length} equal-point probes complete`);
console.log(comparison.filter(x=>x.budget===6).map(x=>`${x.form}: ${x.scenarios.map(s=>`${s.scenario} ${s.damageRatio}`).join(' / ')}`).join('\n'));
const missions=[];
for(const theme of ['original','summer'] as const)for(const stageId of ['S01','S06','S12'] as StageId[])for(const seed of [101,307])for(const captainId of CHARACTER_IDS){const squadIds=[captainId,...CHARACTER_IDS.filter(x=>x!==captainId)].slice(0,5),s=createRun({stageId,difficulty:'easy',squadIds,captainId,seed,forms:Object.fromEntries(squadIds.map(id=>[id,`${id}-${theme}`]))});
 for(let guard=0;guard<30000&&!s.outcome;guard++){
  if(s.bossIntro){command(s,{type:'finish-boss-intro'});continue;}
  if(s.draft){const legal=deepLegalNodes(s).filter(id=>deepNodeCost(id,s)<=s.draft!.pointTarget!-s.choicesSpent),own=(id:string)=>(s.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n].ownerId===id).length;
   const pick=legal.sort((a,b)=>own(DEEP_NODE_MAP[a].ownerId)-own(DEEP_NODE_MAP[b].ownerId)||(DEEP_NODE_MAP[b].kind==='ultimate'?1:0)-(DEEP_NODE_MAP[a].kind==='ultimate'?1:0)||a.localeCompare(b))[0];if(!pick||!command(s,{type:'buy-node',offerId:s.draft.id,nodeId:pick}))throw Error('Mission draft stuck');continue;}
  stepRun(s);
 }
 missions.push({stageId,seed,captainId,theme,outcome:s.outcome,tick:s.tick,hp:Math.round(s.wallHp),points:s.choicesSpent,casts:s.stats.casts.length});
}
writeFileSync(`${out}/missions.json`,JSON.stringify(missions,null,2));console.log(`Campaign smoke: ${missions.length} runs, ${missions.filter(m=>m.outcome==='victory').length} wins; ${missions.filter(m=>!m.outcome).length} unfinished`);
let doc=`# 分岔技能樹 ${NETWORK_CONTENT_VERSION}\n\n每位角色 24 個節點，8 位共 192 個。角色核心免費，向上與兩側延伸；每人的節點位置與跨路線連接不同。三個領域僅用於定位，整棵樹始終保留在畫布。\n\n所有交會都採「任一前置即可」，可跨路線配點；23 個普通技能各 1 點，1 個終極技 2 點，全部取得共 25 點。普通封頂與終極分開，終極沒有後續節點。每條通往終極的路徑皆為 4 個普通技能＋終極，共 6 點。只有 1 點而唯一剩餘技能需要 2 點時，保留餘點並繼續戰鬥，不阻擋結算。\n\n同角色換裝共用圖形與成本，替換三個普通技能與終極，並套用對應攻擊屬性。隊長為開場被動加成；終極仍各自冷卻、有效目標出現時自動施放。技能點預算、敵人及波次未改。\n\n手機可拖曳、雙指縮放；桌面可拖曳與滾輪縮放。另提供放大、縮小、全覽、回到起點及鍵盤操作。選點與換裝後保留縮放；底部顯示技能效果及前置條件。\n\n舊 0.5.0-dev.1 直線樹與更早版本保留，以內容版本分流節點、前置和終極取得狀態，避免修改既有戰局紀錄。\n\n`;
for(const owner of CHARACTER_IDS){doc+=`## ${owner} ${CHARACTER_MAP[owner].name}\n\n隊長：${CAPTAIN_BONUSES[owner].name} — ${CAPTAIN_BONUSES[owner].description}\n\n| 節點 | 技能 | 任一前置 | 夏日差異 |\n|---|---|---|---|\n`;for(const tree of deepTreesFor(owner)){const summer=resolveSkillTree(tree,`${owner}-summer`);for(const [i,n] of tree.nodes.entries())doc+=`| ${n.id} | ${n.name}${n.kind==='ultimate'?'（終極／2 點）':''}：${n.description} | ${n.parents.map(p=>DEEP_NODE_MAP[p].name).join(' 或 ')||'角色核心'} | ${summer.nodes[i].name===n.name?'共用':`${summer.nodes[i].name}：${summer.nodes[i].description}`} |\n`;}doc+='\n';}
doc+=`## 驗證\n\n執行 \`node --import tsx scripts/validate-skill-network.ts\` 可重現 ${probes.length} 組 72 秒等點數試算：16 種形態、6／10 點、密集／縱列／護盾／裝甲／首領／定時防線傷害，從各終點取第一及最後一條路徑，補滿普通技能後比較。記錄實際配點、傷害、控場、吸收傷害和終極次數；此抽樣不涵蓋所有組合，且包含自身隊長加成，不是角色總價值排名。\n\n另有 ${missions.length} 局簡單難度 S01／S06／S12、雙種子、各角色隊長的固定配點測試，${missions.filter(m=>m.outcome==='victory').length} 局通關、${missions.filter(m=>!m.outcome).length} 局未結束。這是流程冒煙測試，不代表玩家通關率；平衡仍需以實際隊伍組合與玩家選擇率持續調整。\n\n結果位於 \`artifacts/validation/skill-network/{probes,comparison,missions}.json\`。\n`;
writeFileSync('docs/SKILL_NETWORK.md',doc);
