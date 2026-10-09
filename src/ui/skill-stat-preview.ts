import { CHARACTER_MAP } from '../data/content';
import { DEEP_NODE_MAP, type DeepMods } from '../data/deep-trees';
import { deepLock, deepMods, previewDeepNodes, teamMod } from '../sim/deep-tree';
import { weaponRange } from '../sim/range';
import { weaponStats } from '../sim/weapons';
import type { CharacterId, RunState } from '../sim/types';
import { esc } from './format';

export interface SkillStatRow {
  key: string;
  label: string;
  before: number;
  after: number;
  unit: string;
  precision: number;
  condition?: string;
}
export interface SkillMemberStats { ownerId: CharacterId; rows: SkillStatRow[]; changed: boolean }

const conditional: {key: keyof DeepMods; label: string; condition: string; team?: keyof DeepMods}[] = [
  {key:'crowdDamage',label:'群襲增傷',condition:'目標 80 距離內另有至少 2 名敵人'},
  {key:'isolatedDamage',label:'獨擊增傷',condition:'目標 100 距離內沒有其他敵人'},
  {key:'guardDamage',label:'破防增傷',condition:'目標仍有護盾或裝甲至少 20%'},
  {key:'freshDamage',label:'先制增傷',condition:'目標生命高於 70%'},
  {key:'markedHaste',label:'曝露攻速',condition:'射程內有曝露目標'},
  {key:'pressureHaste',label:'近線攻速',condition:'有敵人進入防線前 100 距離'},
  {key:'shieldHaste',label:'護盾攻速',condition:'防線有有效護盾'},
  {key:'exposureDamage',team:'teamExposeDamage',label:'曝露增傷',condition:'直擊曝露目標；技能加成'},
  {key:'controlledDamage',team:'teamControlDamage',label:'受控增傷',condition:'直擊緩速或暈眩目標；技能加成'},
  {key:'executeDamage',label:'處決增傷',condition:'目標生命達技能的處決門檻'},
];

/** A derived read-only view: never applyUpgrade/command or advance the live run. */
export function skillStatComparison(run: RunState, ownerId: CharacterId, nodeId?: string): SkillMemberStats[] {
  const next = nodeId && DEEP_NODE_MAP[nodeId] && !deepLock(run,nodeId) ? previewDeepNodes(run,[nodeId]) : run;
  return run.weapons.map(weapon => {
    const before=weaponStats(run,weapon), after=weaponStats(next,weapon);
    const row=(key:string,label:string,a:number,b:number,unit='',precision=1):SkillStatRow=>({key,label,before:a,after:b,unit,precision});
    const rows:SkillStatRow[]=[
      row('damage','基礎傷害',before.damage,after.damage),
      row('interval','目前攻擊間隔',before.interval/30,after.interval/30,' 秒',2),
      row('range','射程',weaponRange(run,weapon.id),weaponRange(next,weapon.id),'',0),
    ];
    if(before.radius||after.radius)rows.push(row('radius','有效範圍半徑',before.radius,after.radius));
    const currentMods=deepMods(run,weapon.id),nextMods=deepMods(next,weapon.id);
    for(const entry of conditional){
      const a=(currentMods[entry.key]??0)+(entry.team?teamMod(run,entry.team):0);
      const b=(nextMods[entry.key]??0)+(entry.team?teamMod(next,entry.team):0);
      if(a||b)rows.push({...row(entry.key,entry.label,a*100,b*100,'%',0),condition:entry.condition});
    }
    return {ownerId:weapon.id,rows,changed:rows.some(r=>Math.abs(r.after-r.before)>1e-8)};
  }).filter(member=>member.ownerId===ownerId||member.changed);
}

export function renderSkillStats(run:RunState,ownerId:CharacterId,nodeId?:string){
  const members=skillStatComparison(run,ownerId,nodeId);
  const format=(value:number,row:SkillStatRow)=>Number.isFinite(value)?`${value.toFixed(row.precision)}${row.unit}`:'無限';
  return `<section class="skill-stat-preview" aria-label="武器數值${nodeId?'配置前後比較':''}"><h4>${nodeId?'配置前 → 配置後':'目前武器數值'}</h4>${members.map(member=>`<article data-stat-owner="${member.ownerId}"><h5>${esc(CHARACTER_MAP[member.ownerId].name)}${member.ownerId!==ownerId?'<span>隊伍聯動</span>':''}</h5><dl>${member.rows.filter(r=>member.ownerId===ownerId||r.before!==r.after).map(r=>`<div class="skill-stat-row ${r.before!==r.after?'changed':''}" data-stat="${r.key}" data-before="${r.before}" data-after="${r.after}"><dt>${r.label}${r.condition?`<small>${esc(r.condition)}</small>`:''}</dt><dd>${format(r.before,r)}${r.before!==r.after?` <span aria-hidden="true">→</span> <strong>${format(r.after,r)}</strong>`:''}</dd></div>`).join('')}</dl></article>`).join('')}<p>條件加成依目標狀態生效；攻擊間隔依目前戰場狀態計算。</p></section>`;
}
