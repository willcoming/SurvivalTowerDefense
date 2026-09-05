import type { CharacterId, RunState } from '../sim/types';
import type { TreeMods } from './skill-trees';

export const FREE_CONTENT_VERSION = '0.3.0-dev.1';
export const usesFreeSkills = (s: Pick<RunState, 'contentVersion'>) => s.contentVersion === FREE_CONTENT_VERSION;
export type SkillOwner = CharacterId | 'common';
export interface DeepMods extends TreeMods {
  secondaryPower?: number; salvoEvery?: number; salvoShots?: number; critEvery?: number; critPower?: number;
  armorBreak?: number; executeDamage?: number; executeThreshold?: number; mainDamage?: number;
  markSpread?: number; chainReturn?: number; chainBurst?: number; burstEvery?: number; burstStun?: number;
  linePower?: number; lineShock?: number; collision?: number; fieldExposure?: number; controlledDamage?: number;
  burnArmor?: number; fireSpread?: number; blastEcho?: number; echoCount?: number; dronePower?: number;
  missiles?: number; missileEvery?: number; teamHaste?: number; teamExposeDamage?: number;
  wallHealth?: number; wallReduction?: number; repairBonus?: number; shieldCapacity?: number;
  periodicRepair?: number; pulseShield?: number; emergencyShield?: number; emergencyRepair?: number;
  emergencyRepulse?: number; secondWind?: number; killRepair?: number; shieldReflect?: number;
  shieldHaste?: number; teamMarkEvery?: number; teamMarkValue?: number; teamControlDamage?: number;
}
export interface DeepNode {
  id: string; treeId: string; ownerId: SkillOwner; name: string; description: string;
  kind: 'entry' | 'branch' | 'ultimate'; parents: string[]; requires: 'any' | 'all';
  layer: number; lane: number; mods: DeepMods;
}
export interface DeepTree { id: string; ownerId: SkillOwner; name: string; purpose: string; visualBranch: 'A' | 'B'; nodes: DeepNode[] }
type Input = [name: string, description: string, mods: DeepMods];
/** Small topology families, with different width/depth and real cross-connections. All ultimates have a four-pick route. */
function tree(ownerId: CharacterId, code: string, name: string, purpose: string, normal: Input[], ultimates: Input[], cross = false): DeepTree {
  const id = `${ownerId}-${code}`;
  const widths = normal.length === 7 ? [1,2,2,2] : normal.length === 8 ? [1,3,2,2] : normal.length === 9 ? [1,3,3,2] : [1,3,3,3];
  const rows: number[][] = []; let at = 0;
  for (const width of [...widths,ultimates.length]) rows.push(Array.from({length:width},()=>at++));
  const inputs = [...normal,...ultimates];
  return {id,ownerId,name,purpose,visualBranch:code==='B'&&ownerId!=='C06'||ownerId==='C06'&&code==='C'?'B':'A',nodes:inputs.map(([name,description,mods],i)=>{
    const layer=rows.findIndex(row=>row.includes(i)),row=rows[layer],column=row.indexOf(i),prev=rows[layer-1];
    const parents=prev ? layer===4 ? [prev[column%prev.length]] : [prev[Math.min(column,prev.length-1)]] : [];
    if(cross&&layer===3&&column===1&&prev.length>1)parents.push(prev[0]);
    return {id:`${id}/${i}`,treeId:id,ownerId,name,description,mods,kind:i>=normal.length?'ultimate':i===0?'entry':'branch',parents:[...new Set(parents)].map(p=>`${id}/${p}`),requires:'any',layer,lane:row.length===1?1:row.length===2?column*2:column};
  })};
}
export const CHARACTER_TREES: DeepTree[] = [
  tree('C01','A','多重掃射','連發、側翼彈道與多目標壓制。',[
    ['分流槍機','主攻擊增加一條側翼彈道，對另一目標造成主彈 45% 傷害。',{targets:1}],
    ['急速供彈','武器攻速 +15%。',{haste:.15}],
    ['展翼槍口','側翼彈道倍率 +15 個百分點。',{secondaryPower:.15}],
    ['延伸槍管','武器射程 +45。',{range:45}],
    ['三連節拍','每 4 次攻擊追加一發主彈，造成 45% 傷害。',{salvoEvery:4,salvoShots:1}],
    ['交叉火網','再增加一個不同射擊目標。',{targets:1}],
    ['遠端校準','武器傷害 +12%，隊長技能範圍 +15%。',{damage:.12,skillRadius:.15}],
    ['熱循環膛室','武器攻速 +20%，隊長技能冷卻 -6%。',{haste:.2,skillCooldown:.06}],
    ['壓制彈幕','側翼倍率 +15 個百分點，曝露目標傷害 +15%。',{secondaryPower:.15,exposureDamage:.15}],
  ],[
    ['星雨飽和','增加 2 個射擊目標；自身武器傷害 +25%。',{targets:2,damage:.25}],
    ['零秒換匣','武器攻速 +45%；每 2 次攻擊追加 2 發 45% 傷害主彈。',{haste:.45,salvoEvery:2,salvoShots:2}],
  ],true),
  tree('C01','B','破盾穿透','一條直線拆盾、削甲，再穿過敵陣。',[
    ['共振彈芯','對護盾傷害倍率 +0.30。',{shield:.3}],
    ['穿透彈頭','主彈多貫穿 1 人，後續命中保留 80% 傷害。',{pierce:1}],
    ['裝甲裂解','命中使目標裝甲降低 5 個百分點，持續 4 秒，不疊加。',{armorBreak:.05}],
    ['延伸加速器','射程 +50，武器傷害 +10%。',{range:50,damage:.1}],
    ['高壓共振','對盾倍率再 +0.45，裝甲忽略 +10 個百分點。',{shield:.45,armor:.1}],
    ['次級貫穿','再多貫穿 1 人，武器傷害 +15%。',{pierce:1,damage:.15}],
    ['裂甲回授','裝甲削弱再 +5 個百分點；隊長技能傷害 +25%。',{armorBreak:.05,skillDamage:.25}],
    ['零阻彈道','武器攻速 +15%，對曝露目標傷害 +15%。',{haste:.15,exposureDamage:.15}],
  ],[['天穹貫星','主彈再多貫穿 2 人；傷害 +55%，對盾倍率 +0.50。',{pierce:2,damage:.55,shield:.5}]]),
  tree('C01','C','弱點追擊','主動標記、規律暴擊與死亡後轉移弱點。',[
    ['弱點掃描','每 3 次主攻擊標記 10% 曝露，持續 3 秒。',{exposureEvery:3,exposureValue:.1,exposureSeconds:3}],
    ['追擊演算','對曝露目標武器傷害 +20%。',{exposureDamage:.2}],
    ['精準節拍','每 4 次攻擊必定暴擊，主彈傷害 +60%。',{critEvery:4,critPower:.6}],
    ['獵手鏡片','武器射程 +40，攻速 +10%。',{range:40,haste:.1}],
    ['處決視窗','對生命低於 30% 的敵人，直擊傷害 +25%。',{executeThreshold:.3,executeDamage:.25}],
    ['標記轉移','擊殺曝露目標後，將 10% 曝露傳給附近 1 人，持續 4 秒。',{markSpread:1}],
    ['追蹤鎖鏈','曝露持續 +2 秒，對曝露目標傷害再 +20%。',{exposureSeconds:2,exposureDamage:.2}],
    ['赤紅校準','暴擊額外倍率 +40 個百分點，隊長技能冷卻 -8%。',{critPower:.4,skillCooldown:.08}],
  ],[
    ['赤紅天眼','每 2 次攻擊暴擊；暴擊額外倍率 +70 個百分點。',{critEvery:2,critPower:.7}],
    ['終焉追獵','生命低於 40% 時直擊增傷再 +80%；弱點轉移再多 2 人。',{executeThreshold:.4,executeDamage:.8,markSpread:2}],
  ],true),
  tree('C02','A','連鎖清場','在分散敵人間搭建導電網。',[
    ['導電延伸','電弧跳躍距離 +25。',{jumpRange:25}],
    ['接力放電','增加 1 次電弧跳躍。',{jumps:1}],
    ['低耗傳導','每跳保留傷害 +10 個百分點，上限 95%。',{jumpPower:.1}],
    ['高頻充能','武器攻速 +15%。',{haste:.15}],
    ['跨區電橋','跳躍距離再 +35，武器傷害 +10%。',{jumpRange:35,damage:.1}],
    ['回流支線','每次連鎖結束後，對首個目標追加主擊 25% 電弧傷害。',{chainReturn:.25}],
    ['同步導電','全隊攻速 +6%。',{teamHaste:.06}],
    ['雙重接力','再增加 2 次跳躍。',{jumps:2}],
    ['超導網路','每跳保留傷害再 +15 個百分點，對盾倍率 +0.20。',{jumpPower:.15,shield:.2}],
  ],[
    ['萬雷結界','最後一個跳躍目標爆出半徑 60 的雷環，造成主擊 100% 傷害。',{chainBurst:1,damage:.15}],
    ['無限迴路','再增加 3 次跳躍；回流傷害追加主擊 100%。',{jumps:3,chainReturn:1}],
  ],true),
  tree('C02','B','磁暴引爆','在目標上堆積磁荷，再以爆炸或 EMP 解放。',[
    ['磁荷核心','主目標累積 3 次命中後引爆 35 電弧傷害，半徑 65。',{burstDamage:35,burstRadius:65,burstEvery:3}],
    ['磁場擴散','磁暴半徑提升至 80。',{burstRadius:80}],
    ['靜默脈衝','每 5 次主攻擊暈眩 0.4 秒；Boss 適用控場抗性。',{stunEvery:5,stunSeconds:.4}],
    ['高能磁荷','磁暴傷害 +30，對盾倍率 +0.25。',{burstDamage:30,shield:.25}],
    ['過載供能','攻速 +18%，隊長控場持續 +15%。',{haste:.18,skillDuration:.15}],
    ['磁核聚爆','磁暴傷害再 +35，半徑提升至 95。',{burstDamage:35,burstRadius:95}],
    ['斷訊共振','磁暴附帶 0.5 秒暈眩。',{burstStun:.5}],
  ],[
    ['超磁暴縮退','每 2 次命中引爆，磁暴傷害再 +70。',{burstEvery:2,burstDamage:70}],
    ['寂靜脈衝','磁暴附帶暈眩延長 0.6 秒，半徑提升至 120；控場中目標直擊傷害 +35%。',{burstStun:.6,burstRadius:120,controlledDamage:.35}],
  ]),
  tree('C03','A','長線貫穿','沿狹長路線強化縱列貫穿與末端震波。',[
    ['加速軌道','武器傷害 +15%。',{damage:.15}],
    ['超遠瞄準','射程 +80，攻速 +8%。',{range:80,haste:.08}],
    ['延長貫穿','直線多命中 2 人。',{pierce:2}],
    ['穩定復進','武器攻速 +20%。',{haste:.2}],
    ['過穿震波','最後命中位置產生半徑 40 震波，造成主擊 35% 傷害。',{lineShock:.35}],
    ['高壓彈軌','武器傷害 +25%，忽略裝甲再 +15 個百分點。',{damage:.25,armor:.15}],
    ['等速貫流','每個後續命中保留傷害 +15 個百分點，上限 100%。',{linePower:.15}],
  ],[['天際線斷擊','再多貫穿 3 人，傷害 +50%，末端震波追加主擊 55%。',{pierce:3,damage:.5,lineShock:.55}]]),
  tree('C03','B','核心狙殺','蓄力暴擊、重型弱點與殘血處決。',[
    ['重型獵手','對精英與 Boss 直擊傷害 +25%。',{eliteDamage:.25}],
    ['凝縮彈芯','主目標直擊傷害 +20%。',{mainDamage:.2}],
    ['核心測距','每 3 次攻擊必定暴擊，直擊額外傷害 +50%。',{critEvery:3,critPower:.5}],
    ['破甲瞄準','裝甲忽略再 +15 個百分點。',{armor:.15}],
    ['蓄能穩架','主目標傷害再 +30%，隊長技能傷害 +20%。',{mainDamage:.3,skillDamage:.2}],
    ['殘血鎖定','目標低於 30% 生命時，直擊傷害 +35%。',{executeThreshold:.3,executeDamage:.35}],
    ['弱點穿針','對重型敵人傷害再 +20%，暴擊額外倍率 +30 個百分點。',{eliteDamage:.2,critPower:.3}],
    ['回收膛壓','武器攻速 +18%，隊長技能冷卻 -8%。',{haste:.18,skillCooldown:.08}],
  ],[
    ['絕對零距','主目標傷害再 +90%，忽略裝甲再 +30 個百分點。',{mainDamage:.9,armor:.3}],
    ['因果狙擊','每 2 次攻擊暴擊，生命低於 40% 時直擊增傷再 +100%。',{critEvery:2,executeThreshold:.4,executeDamage:1}],
  ],true),
  tree('C04','A','引力聚怪','三條支線交會，聚集、壓縮或暴露群體。',[
    ['吸積核心','攻擊留下 1.5 秒引力場：半徑 65、6 DPS、拉力 12。',{fieldDamage:6,fieldRadius:65,fieldDuration:1.5,pull:12}],
    ['場域展開','引力場半徑提升至 85。',{fieldRadius:85}],
    ['重力牽引','拉力 +12。',{pull:12}],
    ['壓縮反應','引力場傷害 +6 DPS。',{fieldDamage:6}],
    ['時差延展','場域持續 +1 秒，狀態時間 +20%。',{fieldDuration:1,duration:.2}],
    ['引力束縛','緩速強度 +8 個百分點，對受控目標直擊傷害 +15%。',{slow:.08,controlledDamage:.15}],
    ['暴露透鏡','引力場內敵人受到 8% 曝露。',{fieldExposure:.08}],
    ['環形吸積','場域半徑提升至 105，拉力再 +10。',{fieldRadius:105,pull:10}],
    ['密度崩塌','場域傷害 +12 DPS，武器傷害 +15%。',{fieldDamage:12,damage:.15}],
    ['集火座標','全隊對曝露目標直擊傷害 +10%。',{teamExposeDamage:.1}],
  ],[
    ['人造黑洞','場域傷害 +22 DPS，拉力 +30，持續 +2 秒。',{fieldDamage:22,pull:30,fieldDuration:2}],
    ['事件視界','引力場曝露再 +12 個百分點；半徑提升至 130，緩速 +12 個百分點。',{fieldExposure:.12,fieldRadius:130,slow:.12}],
  ],true),
  tree('C04','B','反轉擊退','把突破者推回火線，讓碰撞造成二次傷害。',[
    ['斥力脈衝','每 5 次攻擊擊退命中區域敵人 35。',{knockEvery:5,knockback:35}],
    ['快速反轉','武器攻速 +18%。',{haste:.18}],
    ['碰撞轉譯','擊退落點附近半徑 40 的其他敵人受到主擊 30% 傷害。',{collision:.3}],
    ['反衝增壓','擊退距離 +25，武器傷害 +15%。',{knockback:25,damage:.15}],
    ['廣域斥場','武器爆炸半徑 +25%。',{radius:.25}],
    ['短週期逆轉','每 3 次攻擊觸發擊退。',{knockEvery:3}],
    ['動量交換','碰撞傷害再 +40 個百分點；隊長技能冷卻 -10%。',{collision:.4,skillCooldown:.1}],
  ],[['星環反衝','每 2 次攻擊擊退，距離再 +45；武器傷害 +35%。',{knockEvery:2,knockback:45,damage:.35}]]),
  tree('C05','A','持續燃燒','以附著燃燒、地面火區與火勢傳播消耗重甲。',[
    ['灼熱凝膠','附著與火區燃燒傷害 +30%。',{burn:.3}],
    ['延燒燃料','燃燒時間 +30%。',{duration:.3}],
    ['燃燒封鎖','砲彈留下 2 秒火區：半徑 70、5 DPS；最多兩片。',{fireDamage:5,fireDuration:2}],
    ['熔甲配方','燃燒忽略裝甲再 +20 個百分點。',{burnArmor:.2}],
    ['火種接力','擊殺燃燒目標後，將其燃燒傳給附近 1 人。',{fireSpread:1}],
    ['高溫供氧','火區傷害 +5 DPS，燃燒傷害再 +25%。',{fireDamage:5,burn:.25}],
    ['赤潮擴散','爆炸及火區半徑 +20%，火區持續 +1 秒。',{radius:.2,fireDuration:1}],
    ['熱崩解','燃燒傷害再 +35%，隊長技能傷害 +20%。',{burn:.35,skillDamage:.2}],
  ],[
    ['赤潮火海','火區傷害追加 18 DPS、持續 +2 秒；傳火再多 2 人。',{fireDamage:18,fireDuration:2,fireSpread:2}],
    ['永燃核心','燃燒傷害再 +110%，狀態時間 +60%，燃燒忽略裝甲再 +30 個百分點。',{burn:1.1,duration:.6,burnArmor:.3}],
  ],true),
  tree('C05','B','大範圍爆破','大爆炸與延遲子彈，分別對應密集與移動敵群。',[
    ['高爆彈芯','武器爆炸傷害 +18%。',{damage:.18}],
    ['廣域震波','爆炸半徑 +20%。',{radius:.2}],
    ['子母引信','爆炸後 0.2 秒追加一次小爆炸，半徑為原本 65%，傷害為原爆炸 25%。',{blastEcho:.25,echoCount:1}],
    ['反甲破片','爆炸忽略 20% 裝甲。',{armor:.2}],
    ['快速輸彈','武器攻速 +18%。',{haste:.18}],
    ['超壓裝藥','武器傷害 +25%，範圍半徑再 +15%。',{damage:.25,radius:.15}],
    ['二段殉爆','延遲爆炸傷害倍率再 +20 個百分點。',{blastEcho:.2}],
  ],[
    ['終末煙火','爆炸傷害再 +70%，半徑再 +30%。',{damage:.7,radius:.3}],
    ['連環殉爆','延遲爆炸增加至 3 次，傷害倍率再 +30 個百分點。',{echoCount:3,blastEcho:.3}],
  ]),
  tree('C06','A','蜂群輸出','無人機數量、雷射強度與微型導彈組合。',[
    ['伴飛單元','增加一架副機，造成主機 45% 傷害。',{drones:1}],
    ['高速指令','武器攻速 +15%。',{haste:.15}],
    ['雷射聚焦','武器傷害 +15%。',{damage:.15}],
    ['微型導彈','每 4 次攻擊發射一枚微型導彈，半徑 35、主機 45% 傷害。',{missiles:.45,missileEvery:4}],
    ['交叉編隊','增加一架副機；副機優先分別鎖定不同目標。',{drones:1}],
    ['光束同步','副機傷害倍率 +15 個百分點。',{dronePower:.15}],
    ['連裝掛架','導彈每 3 次攻擊發射，導彈傷害倍率 +30 個百分點。',{missileEvery:3,missiles:.3}],
    ['遠端控制','射程 +60，隊長技能冷卻 -8%。',{range:60,skillCooldown:.08}],
    ['增幅棱鏡','武器傷害 +20%，副機倍率再 +10 個百分點。',{damage:.2,dronePower:.1}],
    ['蜂群火控','武器攻速 +15%，導彈傷害倍率再 +25 個百分點。',{haste:.15,missiles:.25}],
  ],[
    ['女王蜂巢','增加 2 架副機（總計最多 5 架），副機倍率再 +25 個百分點。',{drones:2,dronePower:.25}],
    ['全機突擊','每次攻擊都發射導彈，導彈倍率再 +50 個百分點，武器傷害 +20%。',{missileEvery:1,missiles:.5,damage:.2}],
  ],true),
  tree('C06','B','曝露協同','弱點放大、目標接力與全隊集火。',[
    ['持續標記','曝露持續時間 +2 秒。',{exposureSeconds:2}],
    ['弱點放大','曝露強度 +5 個百分點，上限 25%。',{exposureValue:.05}],
    ['快速校準','武器攻速 +18%。',{haste:.18}],
    ['協同火控','全隊對曝露目標直擊傷害 +8%。',{teamExposeDamage:.08}],
    ['高頻掃描','每 2 次主攻擊施加曝露。',{exposureEvery:2}],
    ['交接目標','擊殺曝露目標後，把 10% 曝露傳給附近 2 人，持續 4 秒。',{markSpread:2}],
    ['精準追擊','自身對曝露目標武器傷害 +35%。',{exposureDamage:.35}],
    ['同步回授','全隊攻速 +6%，隊長技能冷卻 -8%。',{teamHaste:.06,skillCooldown:.08}],
  ],[
    ['全域解算','每次主攻擊施加曝露，曝露再 +10 個百分點；標記轉移再多 3 人。',{exposureEvery:1,exposureValue:.1,markSpread:3}],
    ['獵殺協定','全隊對曝露目標直擊增傷再 +20%，自身武器傷害 +30%。',{teamExposeDamage:.2,damage:.3}],
  ],true),
  tree('C06','C','防線護盾','規律充能、反射與低防線救援。',[
    ['護盾節點','每 15 秒提供 50 護盾，持續 6 秒。',{autoShield:50,shieldInterval:15,shieldDuration:6}],
    ['擴容電池','自動護盾量 +30。',{autoShield:30}],
    ['再充能','自動護盾間隔縮短至 12 秒。',{shieldInterval:12}],
    ['延展防幕','自動護盾持續 +3 秒，隊長技能護盾 +30。',{shieldDuration:3,skillShield:30}],
    ['反射棱鏡','全隊護盾吸收傷害的 20% 反射給最近敵人。',{shieldReflect:.2}],
    ['危急充能','防線低於 35% 時提供 100 護盾 8 秒，45 秒冷卻。',{emergencyShield:100}],
    ['防守反擊','有防線護盾時，自身武器攻速 +20%。',{shieldHaste:.2}],
  ],[
    ['六角天幕','自動護盾量再 +100、間隔縮短至 10 秒；全隊護盾上限 +100。',{autoShield:100,shieldInterval:10,shieldCapacity:100}],
    ['絕對防衛線','防線受傷減少 12%；瀕危護盾再 +140，反射比例再 +30 個百分點。',{wallReduction:.12,emergencyShield:140,shieldReflect:.3}],
  ]),
];

const commonRoutes: {name:string;nodes:Input[]}[] = [
  {name:'防線工程',nodes:[
    ['複合防壁','最大防線 +100，並回復 100 防線。',{wallHealth:100}],
    ['衝擊吸收','防線承受傷害降低 6%。',{wallReduction:.06}],
    ['維修網路','每 20 秒回復 12 防線；所有修復量 +20%。',{periodicRepair:12,repairBonus:.2}],
    ['儲能護層','護盾上限 +80，每 18 秒提供 35 護盾，持續 8 秒。',{shieldCapacity:80,pulseShield:35}],
  ]},
  {name:'緊急應變',nodes:[
    ['備援電容','防線低於 35% 時提供 70 護盾 8 秒，45 秒冷卻。',{emergencyShield:70}],
    ['突破搶修','防線每累計承受 100 傷害，自動回復 15。',{emergencyRepair:15}],
    ['自動排斥','敵人抵達防線時自動擊退附近敵人 45，20 秒冷卻。',{emergencyRepulse:45}],
    ['最後防衛','防線低於 20% 時立即回復 120，每局一次。',{secondWind:120}],
  ]},
  {name:'戰術協同',nodes:[
    ['共同標定','每位角色每 6 次攻擊，對主目標施加 8% 曝露 3 秒。',{teamMarkEvery:6,teamMarkValue:.08}],
    ['壓制接力','全隊對緩速或暈眩目標直擊傷害 +10%。',{teamControlDamage:.1}],
    ['殘骸回收','每擊殺 12 個敵人回復 8 防線。',{killRepair:8}],
    ['集中火控','全隊對曝露目標直擊傷害 +10%。',{teamExposeDamage:.1}],
  ]},
];
export const COMMON_TREE: DeepTree = {id:'TEAM',ownerId:'common',name:'全隊共用',purpose:'防線工程 · 緊急應變 · 戰術協同；全為被動或自動觸發。',visualBranch:'A',nodes:commonRoutes.flatMap((route,lane)=>route.nodes.map(([name,description,mods],layer)=>({id:`TEAM/${lane*4+layer}`,treeId:'TEAM',ownerId:'common' as const,name,description,mods,kind:layer===0?'entry' as const:'branch' as const,parents:layer?[`TEAM/${lane*4+layer-1}`]:[],requires:'all' as const,layer,lane})))};
export const DEEP_TREES = [...CHARACTER_TREES,COMMON_TREE];
export const DEEP_TREE_MAP = Object.fromEntries(DEEP_TREES.map(t=>[t.id,t])) as Record<string,DeepTree>;
export const DEEP_NODES = DEEP_TREES.flatMap(t=>t.nodes);
export const DEEP_NODE_MAP = Object.fromEntries(DEEP_NODES.map(n=>[n.id,n])) as Record<string,DeepNode>;
export const deepTreesFor = (owner: SkillOwner) => DEEP_TREES.filter(t=>t.ownerId===owner);
export const COMMON_ROUTE_NAMES = commonRoutes.map(r=>r.name);
