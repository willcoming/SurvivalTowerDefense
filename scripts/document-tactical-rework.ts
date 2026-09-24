import {mkdirSync,writeFileSync} from 'node:fs';
import {CHARACTER_IDS,CHARACTER_MAP,STAGES,CONTENT_VERSION} from '../src/data/content';
import {deepTreesFor,DEEP_NODE_MAP,type DeepNode} from '../src/data/deep-trees';
import {resolveSkillNode,CAPTAIN_BONUSES} from '../src/data/reworked-skills';
import {deepNodeCost} from '../src/sim/deep-tree';
import {operationProfile} from '../src/data/progression';
import {createRun} from '../src/sim/engine';
import type {RunConfig} from '../src/sim/types';
const scope=(n:DeepNode)=>n.kind==='ultimate'?'終極（依換裝）；damage、burn 等既有加成依招式套用':Object.keys(n.mods).some(k=>k.startsWith('team')||['autoShield','shieldDuration','shieldInterval','shieldCapacity','shieldReflect','wallReduction'].includes(k))?'全隊／防線（混合節點另含自身武器效果）':n.mods.damage?'武器與終極的基礎傷害加成':n.mods.burn?'自身持續傷害（含終極衍生燃燒）':'自身武器／武器觸發效果';
let skills=`# 八角色戰術技能 ${CONTENT_VERSION}\n\n每角色 24 節點；普通 1 點，終極 2 點。終極兩入口採任一前置、角色先投入 4 點，最短共 6 點。每節點只取得一次；隊長加成開場生效、不占點。條件增傷為武器直擊，與同類加成相加，不強化終極、持續傷害或反擊。條件攻速與其他攻速相加，條件結束後於下一次排程恢復；不回溯已發射的攻擊。\n\n原裝與夏日共用前置、位置和成本，每分支第三個主路節點及終極有換裝差異。隊長加成不隨換裝改變。\n`;
for(const owner of CHARACTER_IDS){skills+=`\n## ${CHARACTER_MAP[owner].name}\n\n隊長：${CAPTAIN_BONUSES[owner].name} — ${CAPTAIN_BONUSES[owner].description}\n\n| ID | 技能／成本 | 原裝效果 | 夏日效果 | 任一前置 | 作用範圍 |\n|---|---|---|---|---|---|\n`;for(const tree of deepTreesFor(owner))for(const base of tree.nodes){const n=resolveSkillNode(base,`${owner}-original`),alt=resolveSkillNode(base,`${owner}-summer`);skills+=`| ${n.id} | ${n.name}／${deepNodeCost(n.id)} | ${n.description} | ${alt.name===n.name&&alt.description===n.description?'共用':`${alt.name}：${alt.description}`} | ${n.parents.map(p=>DEEP_NODE_MAP[p].name).join(' 或 ')||'角色核心'} | ${scope(n)} |\n`;}}
writeFileSync('docs/TACTICAL_SKILLS.md',skills);
let waves='# 全模式戰術波次 v3\n\n沿用關卡、波次數、總敵數與經驗。整備波移出四分之一敵人至前一壓力波；每三個壓力波安排整備。護盾／重裝／修復同時入場，後排延後，突進分两翼兩批。一般敵人第 3 波起生命相對 v2 +8%，首領生命 +8%、傷害 +3%；速度、波次間隔及首領能力週期不另加倍率。這些數值用於修正初輪編隊集中造成的壓力降低，仍須以報告判斷成效。\n\n首領護衛維持總數與經驗，在首領出現後 1／9 秒分批抵達；保留原縱向排列，避免新進場位置額外延遲抵達防線。百波的首領護衛數維持 0。\n';
const tasks=STAGES.flatMap(s=>['easy','hard',...(!s.id.startsWith('X')?['four','no-skill','two-evolutions']:[])].map(mode=>({stage:s.id,mode})));tasks.push({stage:'S03',mode:'hundred'});
const json=[];
for(const task of tasks){const config:RunConfig={stageId:task.stage,difficulty:task.mode==='easy'||task.mode==='hundred'?'easy':'hard',mode:task.mode==='hundred'?'hundred':undefined,challengeId:['four','no-skill','two-evolutions'].includes(task.mode)?task.mode as RunConfig['challengeId']:null,squadIds:['C01'],captainId:'C01',seed:101};const p=operationProfile(createRun(config));json.push({task,profile:p});waves+=`\n## ${task.stage} / ${task.mode}\n\n${p.waves.length} 波、${p.points} 點、${p.enemies} 一般敵人、${p.escortCount??0} 護衛；每波間隔 ${p.interval} 秒。\n\n| 波 | 編隊 | 敵人 | 組別（代號×數量 @ 相對秒） | 反制提示 |\n|---|---|---|---|---|\n`;p.waves.forEach((w,i)=>{waves+=`| ${i+1} | ${p.waveNames?.[i]} | ${w} | ${p.formations?.[i]?.map(g=>`${g.code}×${g.count} @${g.offset}`).join('；')??'沿用教學時序'} | ${p.waveHints?.[i]} |\n`;});}
writeFileSync('docs/TACTICAL_ENCOUNTERS.md',waves);mkdirSync('artifacts/validation/tactical-rework',{recursive:true});writeFileSync('artifacts/validation/tactical-rework/encounters.json',JSON.stringify(json,null,2));console.log('192 skill specs and 67 stage/mode schedules written.');
