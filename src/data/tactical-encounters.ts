import { ENCOUNTER_PATTERNS, STAGE_ENCOUNTERS, type EncounterKind } from './encounters-v1';
import type { OperationProfile } from './progression';
import type { RunConfig, StageId } from '../sim/types';
export interface FormationGroup { code:string; count:number; offset:number; lane:number }
const order:Record<EncounterKind,string[]>={
 advance:['C','P','R','A','S','M','H','D'],rush:['S','P','C','A','M','R','H','D'],
 armor:['P','M','S','C','A','R','H','D'],shield:['S','P','C','M','A','R','H','D'],
 artillery:['S','P','C','A','M','R','H','D'],repair:['P','M','S','C','A','R','H','D'],
 elite:['S','P','C','M','A','H','D','R'],mixed:['S','P','M','C','A','R','H','D'],respite:['C','R','P','S','A','M','H','D'],
};
export function distribute(total:number,weights:number[]){
 const sum=weights.reduce((a,b)=>a+b,0),result=weights.map(w=>Math.floor(total*w/sum));
 const sorted=weights.map((w,i)=>({i,rem:total*w/sum-result[i]})).sort((a,b)=>b.rem-a.rem||a.i-b.i);
 for(let i=0,left=total-result.reduce((a,b)=>a+b,0);i<left;i++)result[sorted[i].i]++;
 return result;
}
export function tacticalOperation(base:OperationProfile,stage:StageId,config:Pick<RunConfig,'difficulty'|'challengeId'|'mode'>,allowed:string[],assault=false):OperationProfile {
 const hundred=config.mode==='hundred',early=!assault&&!hundred&&!stage.startsWith('X')&&Number(stage.slice(1))<=3&&config.difficulty!=='hard'&&!config.challengeId;
 const authored=STAGE_ENCOUNTERS[stage].plan.filter(k=>k!=='respite'),count=base.waves.length;
 const kinds:EncounterKind[]=Array.from({length:count},(_,i)=>{
  if(assault&&stage==='S01'&&!hundred&&i===0)return 'mixed';
  if(early&&i<2)return STAGE_ENCOUNTERS[stage].plan[i];
  if(hundred)return (['advance','shield','respite','rush','armor','respite','repair','artillery','respite','elite'] as EncounterKind[])[i%10];
  if(i%4===3)return 'respite';
  return authored[Math.floor(i*authored.length/count)%authored.length];
 });
 const totals=base.waves.map(w=>w.split(' ').reduce((sum,t)=>sum+Number(t.slice(1)),0));
 // Move a quarter of recovery-wave bodies into the preceding pressure waves, with no extra enemies or XP.
 totals.forEach((total,i)=>{if(kinds[i]!=='respite'||i<2)return;const moved=Math.floor(total*.25);totals[i]-=moved;totals[i-1]+=moved;});
 const formations:(FormationGroup[]|null)[]=[],waves:string[]=[],names:string[]=[],hints:string[]=[];
 kinds.forEach((kind,i)=>{
  if(early&&i<2){waves.push(base.waves[i]);formations.push(null);names.push(base.waveNames![i]);hints.push(base.waveHints![i]);return;}
  const p=ENCOUNTER_PATTERNS[kind];
  // The first elite chapter must leave room to earn a counter-build before
  // stacked armor reaches the wall. Reweight bodies; never remove XP or waves.
  const weights=Object.entries(p.weights).filter(([code])=>allowed.includes(code)&&(!(i<3||hundred&&i<10)||!['H','D'].includes(code)))
   .map(([code,weight]):[string,number]=>[code,weight*(assault&&!hundred&&stage==='S03'&&config.difficulty!=='hard'&&!config.challengeId
    ? code==='P'?.4:code==='H'?.2:code==='D'?.4:1 :1)]);
  // Limits are balanced independently: a reduced team must not inherit hard-mode specialist density.
  const strength=config.challengeId==='four'?.92:config.challengeId==='no-skill'?.95:config.challengeId==='two-evolutions'?1.04:config.difficulty==='hard'?1.15:1.05;
  const amounts=distribute(totals[i],weights.map(([code,w])=>code==='C'?w:w*strength));
  const counts=Object.fromEntries(weights.map(([code],j)=>[code,amounts[j]]));
  waves.push(weights.flatMap(([code])=>counts[code]?[`${code}${counts[code]}`]:[]).join(' '));
  const groups:FormationGroup[]=[];
  order[kind].forEach(code=>{
   const n=counts[code]??0;if(!n)return;
   // Cover and healer units share a lane; rushes arrive on two distinct flanks.
   const first=code==='S'||code==='P'||code==='M',rush=code==='R'||code==='D';
   const offset=kind==='respite'?4:first?0:code==='A'?5:rush?7:3;
   if(rush&&kind!=='respite'&&n>1){groups.push({code,count:Math.ceil(n/2),offset,lane:0},{code,count:Math.floor(n/2),offset:offset+6,lane:4});}
   else groups.push({code,count:n,offset,lane:first||code==='A'?2:1});
  });
  formations.push(groups);
  names.push(hundred?`第 ${Math.floor(i/10)+1} 階段 · ${p.name}`:p.name);
  const counter=kind==='repair'?'範圍壓制或集中爆發可拆開修復編隊。':kind==='rush'?'緩速、擊退或多目標火力可處理兩批突破。':kind==='shield'||kind==='artillery'?'破盾配合清群，或用控制與護盾降低後排威脅。':kind==='respite'?'敵群較疏，補齊後續反制能力。':'穿甲、範圍或控制可分別處理前排與後續敵群。';
  hints.push(counter);
 });
 return {...base,waves,waveNames:names,waveHints:hints,formations,waveKinds:kinds};
}
