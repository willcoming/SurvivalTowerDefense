import type { DeepMods, DeepNode, DeepTree } from './deep-trees';
import type { CharacterId } from '../sim/types';

export const PREVIOUS_TACTICAL_VERSION = '0.6.0-dev.1';
export const TIMED_TACTICAL_VERSION = '0.6.0-dev.2';
export const TACTICAL_CONTENT_VERSION = '0.6.0-dev.3';
export const usesTacticalSkills = (s:{contentVersion:string}) => s.contentVersion === TACTICAL_CONTENT_VERSION || s.contentVersion === PREVIOUS_TACTICAL_VERSION || s.contentVersion === TIMED_TACTICAL_VERSION;
export const ULTIMATE_ENTRIES:Record<CharacterId,readonly string[]> = {
 C01:['A','B'],C02:['A','B'],C03:['B','C'],C04:['A','B'],
 C05:['A','B'],C06:['B','C'],C07:['A','B'],C08:['A','C'],
};
// Explicit conditions are weapon-only; no accidental multiplication of ultimates or team buffs.
export const CONDITIONAL_KEYS = ['crowdDamage','isolatedDamage','guardDamage','freshDamage','markedHaste','pressureHaste'] as const;
export type ConditionalKey = typeof CONDITIONAL_KEYS[number];
const CONDITIONS:Record<ConditionalKey,string> = {
 crowdDamage:'命中時，目標 80 距離內另有至少 2 名敵人，武器直擊傷害',
 isolatedDamage:'命中時，目標 100 距離內沒有其他敵人，武器直擊傷害',
 guardDamage:'命中仍有護盾或裝甲至少 20% 的目標時，武器直擊傷害',
 freshDamage:'命中生命高於 70% 的目標時，武器直擊傷害',
 markedHaste:'射程內有曝露目標時，自身武器攻速',
 pressureHaste:'有敵人進入防線前 100 距離時，自身武器攻速',
};
const THEMES:Record<CharacterId,ConditionalKey[]> = {
 C01:['crowdDamage','guardDamage','markedHaste'],C02:['crowdDamage','guardDamage','pressureHaste'],
 C03:['crowdDamage','isolatedDamage','freshDamage'],C04:['crowdDamage','pressureHaste','markedHaste'],
 C05:['guardDamage','crowdDamage','freshDamage'],C06:['crowdDamage','markedHaste','pressureHaste'],
 C07:['crowdDamage','guardDamage','pressureHaste'],C08:['freshDamage','pressureHaste','guardDamage'],
};
const NUMERIC = new Set(['damage','haste','range','radius','duration','armor','shield','burn','burnArmor','jumpRange','jumpPower','linePower','dronePower','secondaryPower','mineTrigger','mineChargeCap','cooling','heatCost','mainDamage','eliteDamage']);
export function isUnconditionalNode(n:DeepNode){return n.kind!=='ultimate'&&Object.keys(n.mods).length>0&&Object.keys(n.mods).every(k=>NUMERIC.has(k));}
export function specializeNode(n:DeepNode,summer=false):DeepNode {
 if(n.treeId==='C08-B4'){
  const effects:Record<string,[string,DeepMods]>={
   '1':['敵人進入防線前 100 距離時，武器攻速 +8%。',{pressureHaste:.08}],
   '2':['命中仍有護盾或裝甲至少 20% 的敵人時，武器直擊傷害 +12%。',{guardDamage:.12}],
   '4':['每 5 發附加 8% 曝露 3 秒。',{exposureEvery:5,exposureValue:.08,exposureSeconds:3}],
   '6':['射程內有曝露敵人時，武器攻速 +8%。',{markedHaste:.08}],
   '7':['武器對受控目標增傷 +15%。',{controlledDamage:.15}],
  };
  const effect=effects[n.id.split('/')[1]];
  return effect?{...n,description:`${n.description} ${effect[0]}`,mods:{...n.mods,...effect[1]}}:n;
 }

 if(!isUnconditionalNode(n)||n.id.endsWith('/5'))return n;
 const owner=n.ownerId as CharacterId,branch='ABC'.indexOf(n.treeId[4]),base=THEMES[owner][branch];
 const alternatives:Record<ConditionalKey,ConditionalKey>={crowdDamage:'freshDamage',freshDamage:'guardDamage',guardDamage:'crowdDamage',isolatedDamage:'guardDamage',markedHaste:'pressureHaste',pressureHaste:'markedHaste'};
 const slots=[1,2,6,7,0,4],slot=slots.indexOf(Number(n.id.split('/')[1]));
 const palette:ConditionalKey[]=[base,...CONDITIONAL_KEYS.filter(k=>k!==base)];
 const ordinary=palette[Math.max(0,slot)%palette.length];
 const key=summer?alternatives[ordinary]:ordinary;
 const value=key.endsWith('Haste')?.16:.24;
 // Keep a small amount of essential range on former range nodes; the primary benefit requires a tactical condition.
 const mods:DeepMods={[key]:summer?value/2:value,...(summer?{[ordinary]:ordinary.endsWith('Haste')?.08:.12}:{}),...(n.mods.range?{range:Math.min(15,n.mods.range)}:{})};
 return {...n,description:`${CONDITIONS[key]} +${Math.round((summer?value/2:value)*100)}%。${summer?`${CONDITIONS[ordinary]} +${ordinary.endsWith('Haste')?8:12}%。`:''}${mods.range?`射程 +${mods.range}。`:''}`,mods};
}
type Signature=[string,string,DeepMods];
const SIGNATURES:Record<CharacterId,Signature[]>={
 C01:[['三連節拍','每 4 次攻擊追加 1 發 45% 傷害主彈。',{salvoEvery:4,salvoShots:1}],['破陣節拍','每 5 次攻擊暴擊，額外傷害 +55%。',{critEvery:5,critPower:.55}],['標記轉移','擊殺曝露目標後，向附近 1 人傳遞 10% 曝露 4 秒。',{markSpread:1}]],
 C02:[['回流接力','連鎖結束後對首個目標追加 35% 主擊傷害；單目標也會觸發。',{chainReturn:.35}],['磁荷斷訊','磁荷引爆附帶 0.3 秒暈眩；首領適用抗性。',{burstStun:.3}],['抑制協奏','全隊對受控敵人直擊傷害 +4%。',{teamControlDamage:.04}]],
 C03:[['終端裂片','貫穿末端追加半徑 40、主彈 30% 傷害的震波。',{lineShock:.3}],['鎖定節奏','每 4 次攻擊暴擊，額外傷害 +50%。',{critEvery:4,critPower:.5}],['處決標記','每 4 次攻擊施加 10% 曝露 3 秒。',{exposureEvery:4,exposureValue:.1,exposureSeconds:3}]],
 C04:[['失衡力場','引力區每次傷害附加 8% 曝露。需已取得引力井。',{fieldExposure:.08}],['碰撞擴散','每 4 次攻擊擊退 20 距離；碰撞追加 25% 主擊傷害。',{knockEvery:4,knockback:20,collision:.25}],['協同追擊','全隊對受控敵人直擊傷害 +4%。',{teamControlDamage:.04}]],
 C05:[['餘燼轉移','擊殺燃燒敵人時，向附近 1 人傳遞該燃燒的剩餘效果。',{fireSpread:1}],['爆心回聲','爆炸後追加一次 25% 傷害、65% 半徑的追爆。',{blastEcho:.25}],['延遲標定','每 3 次攻擊施加 8% 曝露 3 秒。',{exposureEvery:3,exposureValue:.08,exposureSeconds:3}]],
 C06:[['追蹤導彈','每 4 次攻擊發射微型導彈，倍率額外 +35 個百分點。',{missiles:.35,missileEvery:4}],['追蹤校準','全隊對曝露目標直擊傷害 +4%。',{teamExposeDamage:.04}],['充能回路','防線有有效護盾時，自身武器攻速 +16%。',{shieldHaste:.16}]],
 C07:[['交錯雷區','同時地雷上限 +1；爆炸附加 10% 緩速。',{mineCap:1,slow:.1}],['震盪雷芯','地雷爆炸附加 0.2 秒暈眩；首領適用抗性。',{stunSeconds:.2}],['雷網標定','每 3 次部署的地雷附加 8% 曝露 3 秒。',{exposureEvery:3,exposureValue:.08,exposureSeconds:3}]],
 C08:[['高熱破陣','主彈額外貫穿 1 人。',{pierce:1}],['冷卻節拍','每 5 發暴擊，額外傷害 +50%。',{critEvery:5,critPower:.5}],['壓制標定','每 4 發附加 10% 曝露 3 秒。',{exposureEvery:4,exposureValue:.1,exposureSeconds:3}]],
};
export function buildTacticalSkills(previous:DeepTree[]):DeepTree[]{
 const trees=previous.map(t=>({...t,id:t.id.replace(/3$/, '4'),nodes:t.nodes.map(n=>specializeNode({...n,id:n.id.replace('3/','4/'),treeId:n.treeId.replace(/3$/, '4'),parents:n.parents.map(p=>p.replace('3/','4/')),mods:{...n.mods},atlas:{...n.atlas!}}))}));
 for(const tree of trees){const signature=SIGNATURES[tree.ownerId as CharacterId]['ABC'.indexOf(tree.id[4])];const n=tree.nodes[3];Object.assign(n,{name:signature[0],description:signature[1],mods:signature[2]});}
 const heat=trees.find(t=>t.id==='C08-A4')!.nodes[2];
 Object.assign(heat,{name:'臨界反擊',description:'有敵人進入防線前 100 距離時，自身武器攻速 +16%；最高熱量增傷 +15 個百分點。',mods:{pressureHaste:.16,heatBonus:.15}});
 for(const [owner,entries] of Object.entries(ULTIMATE_ENTRIES)){
  const nodes=trees.filter(t=>t.ownerId===owner).flatMap(t=>t.nodes),ultimate=nodes.find(n=>n.kind==='ultimate')!;
  ultimate.parents=entries.map(b=>`${owner}-${b}4/3`);
  const parents=ultimate.parents.map(id=>nodes.find(n=>n.id===id)!);
  ultimate.atlas={x:parents.reduce((n,p)=>n+p.atlas!.x,0)/2,y:90};
 }
 return trees;
}
