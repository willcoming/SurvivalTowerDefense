import { buildTacticalSkills, specializeNode, TACTICAL_CONTENT_VERSION, usesTacticalSkills } from './tactical-skills';
import { buildSkillNetworks, NETWORK_CONTENT_VERSION } from './skill-network';
import type { DeepMods, DeepNode, DeepTree } from './deep-trees';
import type { CharacterId, FormId, RunState } from '../sim/types';

export const LINEAR_SKILL_VERSION = '0.5.0-dev.1';
export const SKILL_REWORK_VERSION = TACTICAL_CONTENT_VERSION;
export const usesReworkedSkills = (s: Pick<RunState, 'contentVersion'>) => usesTacticalSkills(s) || s.contentVersion === LINEAR_SKILL_VERSION || s.contentVersion === NETWORK_CONTENT_VERSION;
export const CAPTAIN_BONUSES: Record<CharacterId, {name:string;description:string}> = {
  C01:{name:'弱點集火',description:'全隊對曝露中的敵人直擊傷害 +10%。'},
  C02:{name:'破盾協奏',description:'全隊對仍有護盾的敵人，護盾傷害倍率 +0.25。'},
  C03:{name:'優先處決',description:'全隊對精英與首領直擊傷害 +8%。'},
  C04:{name:'失衡追擊',description:'全隊對緩速或暈眩中的敵人直擊傷害 +10%。'},
  C05:{name:'侵蝕擴散',description:'全隊持續傷害 +15%；不強化直擊。'},
  C06:{name:'防幕協定',description:'防線有有效護盾時，受到的傷害降低 10%。'},
  C07:{name:'持久封鎖',description:'全隊對已在戰場停留 8 秒的敵人，直擊傷害 +10%。'},
  C08:{name:'近線反擊',description:'有敵人逼近防線 100 距離內時，全隊攻速 +10%。'},
};
export interface UltimateDef { name:string; description:string; cooldown:number; damage:number; radius:number; duration:number; pulses:number; shield:number; }
const ult = (name:string,description:string,cooldown:number,damage=0,radius=0,duration=0,pulses=1,shield=0):UltimateDef=>({name,description,cooldown,damage,radius,duration,pulses,shield});
export const ULTIMATES: Record<FormId,UltimateDef> = {
  'C01-original':ult('星雨掃射','對威脅最高目標周圍 85 距離，連續 4 次各造成 90 傷害。',32,90,85,0,4),
  'C01-summer':ult('熔浪覆蓋','對威脅最高目標周圍 90 距離連續 3 次造成 80 傷害，留下 6 秒、每秒 36 傷害的熱能區域。',34,80,90,6,3),
  'C02-original':ult('磁暴連鎖','對目標周圍 110 距離造成 260 傷害，暈眩 1 秒；首領適用控場抗性。',34,260,110,1),
  'C02-summer':ult('電漿迴響','對目標周圍 100 距離連續 3 次各造成 110 傷害，附加 15% 曝露 5 秒。',34,110,100,5,3),
  'C03-original':ult('零界穿甲','狙擊射程內生命上限最高的目標，造成 1250 傷害，忽略 75% 裝甲。',30,1250),
  'C03-summer':ult('重力定點','狙擊射程內生命上限最高的目標，造成 1150 傷害並緩速 50% 共 6 秒；首領適用抗性。',30,1150,0,6),
  'C04-original':ult('事件漩渦','在目標位置建立 6 秒力場，半徑 90、每秒 45 傷害，緩速 35% 並持續牽引。',36,45,90,6),
  'C04-summer':ult('電弧囚籠','在目標位置建立 7 秒抑制區，半徑 105、每秒 32 傷害、緩速 45%；落地暈眩 0.8 秒。',36,32,105,7),
  'C05-original':ult('熔星轟炸','對目標周圍 100 距離造成 560 傷害，附加每秒 26 傷害的侵蝕，持續 5 秒。',30,560,100,5),
  'C05-summer':ult('電漿裂爆','在目標與左右兩側分別引爆，半徑 70、每次 270 傷害，分三次落地。',30,270,70,0,3),
  'C06-original':ult('棱鏡增幅幕','護盾不足且有敵人時，提供 210 護盾 10 秒，並對射程內敵人施加 15% 曝露 6 秒。',34,0,0,10,1,210),
  'C06-summer':ult('反應防衛幕','護盾不足且有敵人時，提供 190 護盾 10 秒；期間護盾吸收傷害的 30% 反擊最近敵人。',34,0,0,10,1,190),
  'C07-original':ult('雷網齊爆','有地雷覆蓋敵人時，立即引爆所有地雷，爆炸傷害提高 140%。',28,2.4),
  'C07-summer':ult('潮汐雷爆','有地雷覆蓋敵人時，引爆所有地雷，爆炸傷害提高 70%；原位置追加一次 140 電漿傷害的延遲爆炸。',28,1.7,70),
  'C08-original':ult('赤曜排熱','有射程內目標且熱量達 70 時清空熱量、恢復射擊；10 秒內攻速 +35%、直擊傷害 +60%。',24,0,0,10),
  'C08-summer':ult('海風超載','有射程內目標且熱量達 70 時恢復射擊；6 秒內熱量鎖定 70，攻速 +35%。',24,0,0,6),
};
export const ultimateForForm=(owner:CharacterId,form?:FormId)=>ULTIMATES[form??`${owner}-original`];
type Input=[string,string,DeepMods];
type BranchSpec=[string,string,Input[],Input];
// Each branch's third node has an authored summer replacement; all other ordinary nodes are shared.
const specs:Record<CharacterId,BranchSpec[]>={
 C01:[
 ['多重掃射','增加多目標覆蓋，以週期掃射完成爆發。',[
 ['分流槍機','增加一條 45% 傷害的側翼彈道。',{targets:1}],['急速供彈','攻速 +16%。',{haste:.16}],['側翼校準','側翼彈道倍率 +20 個百分點。',{secondaryPower:.2}],['遠端彈幕','射程 +35，武器傷害 +12%。',{range:35,damage:.12}]],['餘熱彈道','側翼倍率 +10 個百分點，持續傷害 +40%。',{secondaryPower:.1,burn:.4}]],
 ['破盾穿透','拆解護盾與縱列，適合穩定清線。',[
 ['共振彈芯','對盾倍率 +0.35。',{shield:.35}],['穿透彈頭','主彈多貫穿 1 人。',{pierce:1}],['裝甲裂解','命中削弱裝甲 8 個百分點，持續 4 秒。',{armorBreak:.08}],['線性加速','傷害 +20%，射程 +30。',{damage:.2,range:30}],['貫星彈列','再貫穿 1 人，對盾倍率 +0.25。',{pierce:1,shield:.25}]],['熱蝕彈芯','忽略 15% 裝甲，持續傷害 +25%。',{armor:.15,burn:.25}]],
 ['弱點追擊','標記與規律暴擊，集中處理高威脅目標。',[
 ['弱點掃描','每 3 次攻擊施加 10% 曝露 3 秒。',{exposureEvery:3,exposureValue:.1,exposureSeconds:3}],['追擊演算','對曝露目標增傷 +20%。',{exposureDamage:.2}],['精準節拍','每 4 次攻擊暴擊，額外傷害 +60%。',{critEvery:4,critPower:.6}],['獵手鏡片','射程 +30，攻速 +15%。',{range:30,haste:.15}],['終結追獵','對生命低於 35% 的敵人增傷 +55%。',{executeThreshold:.35,executeDamage:.55}]],['熱能追獵','對生命低於 50% 的敵人增傷 +22%。',{executeThreshold:.5,executeDamage:.22}]],
 ],
 C02:[
 ['連鎖傳導','穩定跳躍與末端擴散，處理分散敵群。',[
 ['延伸導體','電弧多跳躍 1 人。',{jumps:1}],['導電增幅','跳躍傷害保留率 +25 個百分點。',{jumpPower:.25}],['遠距接力','跳躍距離 +35。',{jumpRange:35}],['高頻充能','攻速 +18%。',{haste:.18}],['回環放電','額外跳躍 1 人，末端回擊首個目標造成主擊 100% 傷害；單一目標也會回擊。',{chainReturn:1,jumps:1}]],['電漿接力','跳躍距離 +20，跳躍傷害保留率 +10 個百分點。',{jumpRange:20,jumpPower:.1}]],
 ['磁荷引爆','累積磁荷，以區域爆發瓦解密集敵群。',[
 ['磁荷核心','每命中同一目標 3 次，引爆 25 傷害、半徑 60。',{burstDamage:25,burstEvery:3,burstRadius:60}],['過載供能','武器傷害 +18%。',{damage:.18}],['磁爆擴張','磁爆傷害 +15，半徑提高至 80。',{burstDamage:15,burstRadius:80}],['放電節奏','攻速 +18%。',{haste:.18}]],['電漿飽和','磁爆每 2 次命中觸發，磁爆傷害減少 5。',{burstEvery:2,burstDamage:-5}]],
 ['電場抑制','控制逼近者，同時強化對盾輸出。',[
 ['制動電流','每 4 次攻擊暈眩主目標 0.5 秒。',{stunEvery:4,stunSeconds:.5}],['破盾線圈','對盾倍率 +0.4。',{shield:.4}],['滯留磁場','對受控敵人增傷 +25%。',{controlledDamage:.25}],['再充能','攻速 +16%。',{haste:.16}],['電場封鎖','每 3 次攻擊觸發暈眩，暈眩時間增加 0.25 秒。',{stunEvery:3,stunSeconds:.25}]],['曝光電場','每 3 次攻擊施加 12% 曝露 3 秒。',{exposureEvery:3,exposureValue:.12,exposureSeconds:3}]],
 ],
 C03:[
 ['縱列貫穿','增加穿線效率，犧牲爆發換取持續清線。',[
 ['長線彈頭','額外貫穿 1 人。',{pierce:1}],['動能保存','後續貫穿傷害保留 +15 個百分點。',{linePower:.15}],['末端震波','末端追加 40% 主彈傷害的半徑 40 震波。',{lineShock:.4}],['加速裝填','攻速 +18%。',{haste:.18}],['貫通射界','額外貫穿 1 人，射程 +45。',{pierce:1,range:45}]],['重力穿線','後續貫穿保留 +20 個百分點，傷害 +10%。',{linePower:.2,damage:.1}]],
 ['核心狙殺','對精英與首領集中投資，解鎖自動狙擊。',[
 ['核心瞄準','主目標傷害 +25%。',{mainDamage:.25}],['反甲彈芯','忽略 15% 裝甲。',{armor:.15}],['精英識別','對精英與首領傷害 +25%。',{eliteDamage:.25}],['穩架校準','傷害 +18%，射程 +25。',{damage:.18,range:25}]],['重力鎖定','主目標傷害 +30%，射程 +20。',{mainDamage:.3,range:20}]],
 ['精密校準','規律暴擊與殘血處決，形成無終極狙擊。',[
 ['快速裝填','攻速 +18%。',{haste:.18}],['規律心跳','每 3 次攻擊暴擊，額外傷害 +55%。',{critEvery:3,critPower:.55}],['終結刻度','對生命低於 35% 的敵人增傷 +30%。',{executeThreshold:.35,executeDamage:.3}],['精密鏡片','傷害 +15%，射程 +35。',{damage:.15,range:35}],['冷靜射手','攻速 +20%，暴擊額外傷害再 +35 個百分點。',{haste:.2,critPower:.35}]],['重力處決','對生命低於 50% 的敵人增傷 +22%。',{executeThreshold:.5,executeDamage:.22}]],
 ],
 C04:[
 ['引力聚怪','集中敵人，解鎖大範圍自動力場。',[
 ['引力井','武器留下 2 秒、半徑 65、每秒 12 傷害的牽引區。',{fieldDamage:12,fieldRadius:65,fieldDuration:2,pull:10}],['擴張透鏡','武器範圍 +18%。',{radius:.18}],['引力壓縮','牽引力度 +10，力場每秒傷害 +8。',{pull:10,fieldDamage:8}],['長效場域','力場持續 +1 秒，武器傷害 +15%。',{fieldDuration:1,damage:.15}]],['磁場滯留','力場每秒傷害 +6，緩速強度 +12 個百分點。',{fieldDamage:6,slow:.12}]],
 ['反轉擊退','推回突破者，以碰撞補足控制收益。',[
 ['斥力脈衝','每 4 次攻擊擊退 35 距離。',{knockEvery:4,knockback:35}],['快速循環','攻速 +18%。',{haste:.18}],['碰撞回授','被擊退敵人對附近敵人造成 50% 主擊傷害。',{collision:.5}],['斥力擴張','範圍 +18%，傷害 +15%。',{radius:.18,damage:.15}],['逆向潮汐','每 3 次攻擊觸發擊退，擊退距離再 +20。',{knockEvery:3,knockback:20}]],['導電回授','碰撞傷害 30%，對受控目標增傷 +20%。',{collision:.3,controlledDamage:.2}]],
 ['控場協同','延長緩速並曝露弱點，協助全隊集火。',[
 ['時間拉伸','武器狀態持續 +25%。',{duration:.25}],['失衡標定','每 3 次攻擊施加 10% 曝露 3 秒。',{exposureEvery:3,exposureValue:.1,exposureSeconds:3}],['失衡獵手','自身對受控目標增傷 +30%。',{controlledDamage:.3}],['同步脈衝','攻速 +18%。',{haste:.18}],['穩態封鎖','緩速強度 +15 個百分點，全隊對受控目標增傷 +8%。',{slow:.15,teamControlDamage:.08}]],['電荷標定','曝露強度 +5 個百分點，曝露持續 +2 秒。',{exposureValue:.05,exposureSeconds:2}]],
 ],
 C05:[
 ['持續侵蝕','延長侵蝕與地面區域，消耗重甲敵人。',[
 ['高能餘燼','持續傷害 +40%。',{burn:.4}],['侵蝕延展','武器狀態持續 +25%。',{duration:.25}],['灼熱地帶','爆炸留下 2 秒、每秒 15 傷害的區域。',{fireDamage:15,fireDuration:2}],['深層侵蝕','持續傷害忽略裝甲再 +20 個百分點。',{burnArmor:.2}],['餘燼蔓延','持續傷害 +60%，地面區域持續 +2 秒。',{burn:.6,fireDuration:2}]],['電漿殘留','爆炸留下 3 秒、每秒 12 傷害的區域。',{fireDamage:12,fireDuration:3}]],
 ['爆破覆蓋','提高直接爆破能力，解鎖週期轟炸。',[
 ['擴散彈殼','爆炸半徑 +18%。',{radius:.18}],['高壓裝藥','武器傷害 +20%。',{damage:.2}],['反甲爆破','忽略 18% 裝甲。',{armor:.18}],['快速裝填','攻速 +16%。',{haste:.16}]],['電漿拆盾','對盾倍率 +0.4，武器傷害 +10%。',{shield:.4,damage:.1}]],
 ['延遲追爆','追加爆炸與穩定連射，追擊移動敵群。',[
 ['回音彈片','追加 1 次 30% 傷害的小型追爆。',{blastEcho:.3,echoCount:1}],['供彈循環','攻速 +16%。',{haste:.16}],['追爆校準','追爆傷害再 +20 個百分點。',{blastEcho:.2}],['遠端測距','射程 +40，傷害 +15%。',{range:40,damage:.15}],['雙重迴響','追爆次數提高至 2，爆炸範圍 +12%。',{echoCount:2,radius:.12}]],['離子彈片','追爆傷害再 +10 個百分點，對盾倍率 +0.25。',{blastEcho:.1,shield:.25}]],
 ],
 C06:[
 ['蜂群輸出','擴大無人機火力，走穩定多目標輸出。',[
 ['伴飛單元','增加 1 架 45% 傷害的無人機。',{drones:1}],['雷射聚焦','副機傷害倍率 +15 個百分點。',{dronePower:.15}],['微型導彈','每 4 次攻擊發射 55% 主擊傷害的微型導彈。',{missiles:.55,missileEvery:4}],['快速指令','攻速 +18%。',{haste:.18}],['蜂群協定','再增加 1 架無人機，副機傷害倍率 +15 個百分點。',{drones:1,dronePower:.15}]],['動能導彈','每 3 次攻擊發射 40% 主擊傷害的導彈。',{missiles:.4,missileEvery:3}]],
 ['曝露協同','提高弱點標記與隊伍收益。',[
 ['弱點放大','曝露強度 +5 個百分點。',{exposureValue:.05}],['標定延展','曝露持續 +2 秒。',{exposureSeconds:2}],['同步火控','全隊攻速 +6%。',{teamHaste:.06}],['追蹤校準','射程 +45，武器傷害 +15%。',{range:45,damage:.15}],['獵殺協定','每 2 次攻擊施加曝露，全隊對曝露目標增傷 +8%。',{exposureEvery:2,teamExposeDamage:.08}]],['彈道同步','全隊攻速 +3%，自身對盾倍率 +0.35。',{teamHaste:.03,shield:.35}]],
 ['防線護盾','自動補充護盾，解鎖戰術防幕。',[
 ['維護電池','每 18 秒提供 55 護盾、持續 6 秒。',{autoShield:55,shieldInterval:18,shieldDuration:6}],['擴容護層','全隊護盾上限 +50。',{shieldCapacity:50}],['防幕延展','自動護盾持續 +3 秒、容量 +20。',{shieldDuration:3,autoShield:20}],['充能回路','自動護盾間隔縮短至 15 秒，傷害 +12%。',{shieldInterval:15,damage:.12}]],['動能防幕','自動護盾容量 +25，護盾上限 +20。',{autoShield:25,shieldCapacity:20}]],
 ],
 C07:[
 ['雷網覆蓋','擴大布雷與觸發範圍，穩定攔截敵群。',[
 ['擴充雷匣','地雷上限 +1。',{mineCap:1}],['感應延伸','地雷觸發距離 +12。',{mineTrigger:12}],['廣域裝藥','爆炸半徑 +20%。',{radius:.2}],['快速布雷','攻速 +18%。',{haste:.18}],['密集雷網','地雷上限 +1，武器傷害 +25%。',{mineCap:1,damage:.25}]],['離子雷網','爆炸範圍 +10%，對盾倍率 +0.3。',{radius:.1,shield:.3}]],
 ['蓄能爆破','提高預置威力，解鎖自動引爆。',[
 ['蓄能雷芯','每秒預置增傷 +8 個百分點。',{mineCharge:.08}],['儲能匣','預置增傷上限 +30 個百分點。',{mineChargeCap:.3}],['反甲雷芯','忽略 20% 裝甲。',{armor:.2}],['增壓迴路','武器傷害 +20%。',{damage:.2}]],['電漿雷芯','對盾倍率 +0.4，預置增傷上限 +15 個百分點。',{shield:.4,mineChargeCap:.15}]],
 ['封路干擾','地雷減速與暈眩，協助防線拖延時間。',[
 ['遲滯引信','地雷爆炸附加 25% 緩速 1.5 秒。',{slow:.25}],['即時啟動','地雷裝設時間縮短 0.25 秒。',{mineArm:.25}],['失衡雷芯','地雷附加 0.4 秒暈眩。',{stunSeconds:.4}],['精密佈點','觸發距離 +10，攻速 +15%。',{mineTrigger:10,haste:.15}],['封鎖協定','對受控目標增傷 +35%，爆炸半徑 +15%。',{controlledDamage:.35,radius:.15}]],['離子遲滯','緩速強度 +15 個百分點，對受控目標增傷 +15%。',{slow:.15,controlledDamage:.15}]],
 ],
 C08:[
 ['高熱連射','提高熱量爆發，解鎖自動過載。',[
 ['高熱膛室','最高熱量增傷 +45 個百分點。',{heatBonus:.45}],['快速供彈','攻速 +16%。',{haste:.16}],['臨界聚能','最高熱量增傷再 +45 個百分點。',{heatBonus:.45}],['貫甲彈芯','忽略 15% 裝甲。',{armor:.15}]],['電弧聚能','最高熱量增傷 +25 個百分點，對盾倍率 +0.3。',{heatBonus:.25,shield:.3}]],
 ['循環散熱','縮短停火時間，維持持續火力。',[
 ['雙向散熱','散熱速度 +25%。',{cooling:.25}],['低耗彈鏈','每發熱量減少 1 點。',{heatCost:1}],['熱交換器','散熱速度再 +30%。',{cooling:.3}],['穩定火控','武器傷害 +20%。',{damage:.2}],['閉環冷卻','每發熱量再減少 1 點，散熱速度 +20%。',{heatCost:1,cooling:.2}]],['海風交換','散熱速度 +15%，武器傷害 +12%。',{cooling:.15,damage:.12}]],
 ['火力壓制','貫穿、暴擊與射程，建立無終極火力。',[
 ['延伸槍管','射程 +40。',{range:40}],['貫通彈鏈','額外貫穿 1 人。',{pierce:1}],['同步扳機','每 4 發暴擊，額外傷害 +55%。',{critEvery:4,critPower:.55}],['精密供彈','攻速 +16%。',{haste:.16}],['壓制射界','傷害 +25%，射程 +35。',{damage:.25,range:35}]],['破盾扳機','對盾倍率 +0.35，傷害 +12%。',{shield:.35,damage:.12}]],
 ],
};
export const LINEAR_REWORKED_TREES:DeepTree[]=[];
const summerNodes:Record<string,Input>={};
for(const [owner,branches] of Object.entries(specs))for(const [branchIndex,[name,purpose,ordinary,summer]] of branches.entries()){
 const ownerId=owner as CharacterId,id=`${ownerId}-${'ABC'[branchIndex]}2`,hasUltimate=ordinary.length===4;
 const inputs:Input[]=hasUltimate?[...ordinary,[ULTIMATES[`${ownerId}-original`].name,ULTIMATES[`${ownerId}-original`].description,{}]]:ordinary;
 const nodes:DeepNode[]=inputs.map(([name,description,mods],layer)=>({id:`${id}/${layer}`,treeId:id,ownerId,name,description,mods,kind:hasUltimate&&layer===4?'ultimate':layer===0?'entry':'branch',parents:layer?[`${id}/${layer-1}`]:[],requires:'all',layer,lane:1}));
 LINEAR_REWORKED_TREES.push({id,ownerId,name,purpose,visualBranch:branchIndex===1?'B':'A',nodes});summerNodes[`${id}/2`]=summer;
}
export const NETWORK_TREES=buildSkillNetworks(LINEAR_REWORKED_TREES);
export const REWORKED_TREES=buildTacticalSkills(NETWORK_TREES);
for(const [id,input] of Object.entries(summerNodes)){summerNodes[id.replace('2/','3/')]=input;summerNodes[id.replace('2/','4/')]=input;}
export const NETWORK_NODE_IDS=new Set([...NETWORK_TREES,...REWORKED_TREES].flatMap(t=>t.nodes.map(n=>n.id)));
export const REWORKED_NODE_IDS=new Set([...LINEAR_REWORKED_TREES,...NETWORK_TREES,...REWORKED_TREES].flatMap(t=>t.nodes.map(n=>n.id)));
export function resolveSkillNode(node:DeepNode,form?:FormId):DeepNode {
 if(!REWORKED_NODE_IDS.has(node.id))return node;
 if(node.kind==='ultimate'){const u=ULTIMATES[form??`${node.ownerId as CharacterId}-original`];return {...node,name:u.name,description:`${u.description} 冷卻 ${u.cooldown} 秒；取得後先完成一次冷卻。`};}
 if(!form?.endsWith('-summer'))return node;
 const alt=summerNodes[node.id];const resolved=alt?{...node,name:alt[0],description:alt[1],mods:alt[2]}:node;return node.id.includes('4/')&&alt?specializeNode(resolved,true):resolved;
}
export const resolveSkillTree=(tree:DeepTree,form?:FormId):DeepTree=>({...tree,nodes:tree.nodes.map(n=>resolveSkillNode(n,form))});
