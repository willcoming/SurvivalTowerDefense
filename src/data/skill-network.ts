import type { CharacterId } from '../sim/types';
import type { DeepMods, DeepTree } from './deep-trees';

export const NETWORK_CONTENT_VERSION = '0.5.0-dev.2';
export const usesSkillNetwork = (s:{contentVersion:string}) => s.contentVersion === NETWORK_CONTENT_VERSION;
export const NETWORK_WIDTH=1240, NETWORK_HEIGHT=620;
type Input=[string,string,DeepMods];
/** Three side-route skills per discipline. They expand choices, not the point budget. */
const additions:Record<CharacterId,Input[][]>={
 C01:[[['輕量槍栓','攻速 +12%，射程 +20。',{haste:.12,range:20}],['協同準星','對曝露目標增傷 +18%。',{exposureDamage:.18}],['扇面壓制','增加 1 條側翼彈道，側翼倍率 +10 個百分點。',{targets:1,secondaryPower:.1}]],
 [['加速彈膛','武器傷害 +15%。',{damage:.15}],['崩解彈衣','對盾倍率 +0.25，忽略 8% 裝甲。',{shield:.25,armor:.08}],['破陣射界','武器傷害 +22%，射程 +30。',{damage:.22,range:30}]],
 [['追蹤光學','射程 +35。',{range:35}],['精密供能','武器傷害 +14%。',{damage:.14}],['協同追獵','對受控目標增傷 +30%，攻速 +10%。',{controlledDamage:.3,haste:.1}]]],
 C02:[[['並聯供能','武器傷害 +14%。',{damage:.14}],['接力線圈','跳躍距離 +25，對盾倍率 +0.2。',{jumpRange:25,shield:.2}],['連鎖增幅','跳躍傷害保留率 +12 個百分點，攻速 +12%。',{jumpPower:.12,haste:.12}]],
 [['高頻電容','攻速 +12%。',{haste:.12}],['裂盾磁荷','對盾倍率 +0.3。',{shield:.3}],['蓄電回流','武器傷害 +22%，射程 +25。',{damage:.22,range:25}]],
 [['抑制增幅','武器傷害 +14%。',{damage:.14}],['偏轉電場','對受控目標增傷 +20%。',{controlledDamage:.2}],['定場協奏','對受控目標增傷 +25%，射程 +30。',{controlledDamage:.25,range:30}]]],
 C03:[[['穩定膛線','武器傷害 +14%。',{damage:.14}],['遠距演算','射程 +40。',{range:40}],['貫甲餘震','後續貫穿保留 +15 個百分點，忽略 10% 裝甲。',{linePower:.15,armor:.1}]],
 [['急速校準','攻速 +12%。',{haste:.12}],['破綻追蹤','對曝露目標增傷 +20%。',{exposureDamage:.2}],['定點處決','主目標傷害 +25%，對精英與首領傷害 +15%。',{mainDamage:.25,eliteDamage:.15}]],
 [['瞄準輔助','武器傷害 +12%，射程 +15。',{damage:.12,range:15}],['脈搏調整','攻速 +13%。',{haste:.13}],['弱點終結','對生命低於 35% 的敵人增傷 +40%。',{executeThreshold:.35,executeDamage:.4}]]],
 C04:[[['引力加速','攻速 +12%。',{haste:.12}],['失衡透鏡','對受控目標增傷 +20%。',{controlledDamage:.2}],['潮汐聚焦','武器傷害 +20%，範圍 +15%。',{damage:.2,radius:.15}]],
 [['場域聚焦','武器傷害 +14%。',{damage:.14}],['長距斥力','射程 +30，狀態持續 +10%。',{range:30,duration:.1}],['排斥增幅','擊退距離 +20，對受控目標增傷 +20%。',{knockback:20,controlledDamage:.2}]],
 [['延伸場域','射程 +35。',{range:35}],['相位協調','武器傷害 +15%。',{damage:.15}],['失衡共鳴','全隊對受控目標增傷 +6%，狀態持續 +20%。',{teamControlDamage:.06,duration:.2}]]],
 C05:[[['熱流循環','攻速 +12%。',{haste:.12}],['殘留擴散','爆炸範圍 +14%。',{radius:.14}],['深層餘燼','持續傷害 +35%，忽略裝甲再 +15 個百分點。',{burn:.35,burnArmor:.15}]],
 [['供彈校準','武器傷害 +14%。',{damage:.14}],['爆心測距','射程 +35。',{range:35}],['廣域轟擊','爆炸範圍 +18%，武器傷害 +18%。',{radius:.18,damage:.18}]],
 [['回聲導引','爆炸範圍 +14%。',{radius:.14}],['瞬發填裝','攻速 +13%。',{haste:.13}],['追爆彈幕','武器傷害 +20%，追爆倍率 +15 個百分點。',{damage:.2,blastEcho:.15}]]],
 C06:[[['高速鏈路','攻速 +12%。',{haste:.12}],['遠端指令','射程 +35。',{range:35}],['同步蜂群','副機倍率 +15 個百分點，武器傷害 +18%。',{dronePower:.15,damage:.18}]],
 [['協同供能','武器傷害 +14%。',{damage:.14}],['標記追擊','對曝露目標增傷 +20%。',{exposureDamage:.2}],['群體標定','全隊對曝露目標增傷 +6%，曝露持續 +1 秒。',{teamExposeDamage:.06,exposureSeconds:1}]],
 [['穩態供能','武器傷害 +12%，射程 +15。',{damage:.12,range:15}],['防幕火控','有護盾時自身攻速 +18%。',{shieldHaste:.18}],['護盾回授','全隊護盾上限 +50，護盾吸收傷害的 12% 反擊。',{shieldCapacity:50,shieldReflect:.12}]]],
 C07:[[['引信校準','武器傷害 +14%。',{damage:.14}],['雷網延伸','射程 +35。',{range:35}],['外圍封鎖','觸發距離 +12，爆炸範圍 +15%。',{mineTrigger:12,radius:.15}]],
 [['提前佈署','攻速 +12%。',{haste:.12}],['深埋裝藥','忽略 12% 裝甲。',{armor:.12}],['高壓雷芯','武器傷害 +22%，預置增傷上限 +20 個百分點。',{damage:.22,mineChargeCap:.2}]],
 [['感應調整','觸發距離 +10。',{mineTrigger:10}],['封路填裝','武器傷害 +15%。',{damage:.15}],['牽制雷陣','緩速強度 +12 個百分點，攻速 +15%。',{slow:.12,haste:.15}]]],
 C08:[[['穩定槍架','武器傷害 +14%。',{damage:.14}],['穿甲熱流','忽略 10% 裝甲。',{armor:.1}],['熾熱壓制','最高熱量增傷 +25 個百分點，武器傷害 +18%。',{heatBonus:.25,damage:.18}]],
 [['低溫供彈','攻速 +12%。',{haste:.12}],['熱量導流','散熱速度 +18%。',{cooling:.18}],['持續射擊','武器傷害 +20%，散熱速度 +15%。',{damage:.2,cooling:.15}]],
 [['精準照門','武器傷害 +14%。',{damage:.14}],['遠距壓制','射程 +35。',{range:35}],['火線追擊','對曝露目標增傷 +25%，攻速 +12%。',{exposureDamage:.25,haste:.12}]]],
};
interface Shape { skew:number[]; merge:number[]; cross:[string,string][]; tips:number[]; }
// Authored directed acyclic layouts: fan, relay, converging scope, fields, blast, lattice, mines and heat exchange.
const shapes:Record<CharacterId,Shape>={
 C01:{skew:[-25,0,25],merge:[0,2],cross:[['B6','A1'],['C6','B1'],['A3','B2']],tips:[0,1,0]},
 C02:{skew:[20,-20,0],merge:[0,1,2],cross:[['A6','B1'],['B6','C1'],['C3','B2'],['A7','B3']],tips:[1,0,1]},
 C03:{skew:[-20,20,0],merge:[1],cross:[['B6','A1'],['B3','C2'],['C7','B3']],tips:[1,0,0]},
 C04:{skew:[20,-10,-20],merge:[0,2],cross:[['A6','B1'],['B6','C1'],['B3','A2'],['C7','B3']],tips:[0,1,1]},
 C05:{skew:[-15,0,20],merge:[1,2],cross:[['B6','A1'],['C6','B1'],['B3','C2'],['A7','B3']],tips:[1,0,1]},
 C06:{skew:[0,20,-15],merge:[0,1,2],cross:[['A6','B1'],['C6','B1'],['B3','A2'],['B7','C3']],tips:[1,1,0]},
 C07:{skew:[20,-20,10],merge:[0],cross:[['B6','A1'],['C6','B1'],['C3','B2'],['A7','B3'],['B7','C3']],tips:[0,1,1]},
 C08:{skew:[-20,15,-15],merge:[1,2],cross:[['A6','B1'],['B6','A1'],['C6','B1'],['A3','B2'],['C7','B3']],tips:[0,1,0]},
};
// Each discipline follows an authored centreline, so silhouettes vary beyond edge changes.
const centrelines:Record<CharacterId,number[][]>={
 C01:[[450,350,285,265,265],[620,620,620,620,620],[790,890,955,975,975]],
 C02:[[310,245,310,220,250],[590,650,590,680,610],[920,970,930,1040,990]],
 C03:[[350,270,240,300,350],[640,610,650,620,650],[920,1000,980,920,950]],
 C04:[[390,300,250,280,240],[630,640,610,670,630],[850,970,1040,1000,970]],
 C05:[[390,290,260,230,260],[630,650,620,710,635],[860,1010,980,1020,1000]],
 C06:[[390,280,320,240,250],[620,660,630,590,650],[860,980,950,1040,990]],
 C07:[[350,240,300,230,265],[620,620,640,650,630],[900,1010,980,1040,985]],
 C08:[[390,300,250,330,270],[630,590,640,620,640],[860,940,1030,970,1020]],
};
export function buildSkillNetworks(previous:DeepTree[]):DeepTree[]{
 const result:DeepTree[]=[];
 for(const [owner,shape] of Object.entries(shapes)){
  const ownerId=owner as CharacterId, trees=previous.filter(t=>t.ownerId===ownerId);
  const idFor=(ref:string)=>`${ownerId}-${ref[0]}3/${ref.slice(1)}`;
  for(const [group,t] of trees.entries()){
   const id=`${ownerId}-${'ABC'[group]}3`, base=t.nodes.map(n=>({...n,mods:{...n.mods}}));
   const extra=additions[ownerId][group].map(([name,description,mods],i)=>({...base[0],name,description,mods,id:`${id}/${i+5}`}));
   const nodes=[...base,...extra].map((n,i)=>{
    const parents=i===0?[]:i===5?[0]:i===6?shape.merge.includes(group)?[1,5]:[5]:i===2?[1,5]:i===3?[2,6]:i===7?[3]:[i-1];
    const layer=[0,1,2,3,4,1,2,4][i];
    const side=[0,-76,-76,0,-76,76,76,76][i];
    const x=centrelines[ownerId][group][layer]+side+shape.skew[group]*(layer/4);
    const y=510-layer*100-(i===7&&shape.tips[group]?20:0);
    return {...n,id:`${id}/${i}`,treeId:id,kind:i===0?'entry' as const:i===4&&n.kind==='ultimate'?'ultimate' as const:'branch' as const,requires:'any' as const,parents:parents.map(p=>`${id}/${p}`),layer,lane:1,atlas:{x,y}};
   });
   result.push({...t,id,nodes});
  }
  for(const [child,parent] of shape.cross){const n=result.flatMap(t=>t.nodes).find(n=>n.id===idFor(child))!;n.parents.push(idFor(parent));}
 }
 return result;
}
