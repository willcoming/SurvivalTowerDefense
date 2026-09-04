import { COMMON_UPGRADES } from '../data/content';
import { nextRandom } from './rng';
import type { CharacterId, RunState, UpgradeCard } from './types';

export function getReadyEvolutions(s: RunState): string[] {
  return s.evolvedCount >= s.evolutionLimit ? [] : s.weapons.filter(w=>w.rank===2).sort((a,b)=>a.readyAt-b.readyAt||a.id.localeCompare(b.id)).map(w=>`${w.id}-${w.branch}-3`);
}
export function getLegalNodeIds(s: RunState): string[] {
  const ids:string[]=[];
  for(const w of s.weapons){
    if(!w.branch) ids.push(`${w.id}-A-1`,`${w.id}-B-1`);
    else if(w.rank<2 || (w.rank===2 && s.evolvedCount<s.evolutionLimit)) ids.push(`${w.id}-${w.branch}-${w.rank+1}`);
  }
  for(const g of COMMON_UPGRADES){
    if(g.id==='G06' && !s.weapons.some(w=>['C04','C05','C06'].includes(w.id)||(w.id==='C02'&&w.branch==='B'&&w.rank===3)) && !['C02','C04','C05'].includes(s.config.captainId)) continue;
    if(g.id==='G03' && !s.weapons.some(w=>['C04','C05'].includes(w.id)||(w.id==='C02'&&w.branch==='B'&&w.rank===3)) && !['C01','C05'].includes(s.config.captainId)) continue;
    const rank=s.commonRanks[g.id]??0;
    if(rank<g.max)ids.push(`${g.id}-${rank+1}`);
  }
  return ids.sort();
}
export const legalNodes=getLegalNodeIds;
const focusRound=(s:RunState)=>(s.choicesSpent%3)===0;
function focusNode(s:RunState,id:CharacterId):string|null{
  const w=s.weapons.find(w=>w.id===id); if(!w)return null;
  const node=`${id}-${w.branch??s.preferredBranches[id]}-${w.rank+1}`;
  return getLegalNodeIds(s).includes(node)?node:null;
}
function weighted(s:RunState,ids:string[]):string{
  const sum=ids.reduce((n,id)=>n+(id.startsWith('C')?2:1),0);let n=nextRandom(s.rng,'draft')*sum;
  for(const id of ids){n-=id.startsWith('C')?2:1;if(n<0)return id;}return ids.at(-1)!;
}
export function rebuildDraft(s:RunState, randomize=false):void{
  const d=s.draft;if(!d)return;
  const legal=getLegalNodeIds(s);const ready=getReadyEvolutions(s);const cards:UpgradeCard[]=[];
  if(ready.length){if(!ready.includes(d.selectedEvolution??''))d.selectedEvolution=ready[0];cards.push({nodeId:d.selectedEvolution!,kind:'evolution'});}else d.selectedEvolution=null;
  if(focusRound(s)){
    const id=focusNode(s,d.focusId);
    if(id&&!cards.some(c=>c.nodeId===id))cards.push({nodeId:id,kind:'focus'});
  }
  const maxRandom=focusRound(s)?(ready.length?1:2):3-cards.length;
  const oldRandom=d.cards.filter(c=>c.kind==='random');
  for(const c of oldRandom){if(cards.length>=3||cards.filter(c=>c.kind==='random').length>=maxRandom)break;if(legal.includes(c.nodeId)&&!cards.some(x=>x.nodeId===c.nodeId))cards.push(c);}
  const randomPool=legal.filter(id=>!id.endsWith('-3')&&(!focusRound(s)||!id.startsWith('C')));
  while(cards.length<3&&cards.filter(c=>c.kind==='random').length<maxRandom){
    const pool=randomPool.filter(id=>!cards.some(c=>c.nodeId===id));if(!pool.length)break;
    cards.push({nodeId:randomize?weighted(s,pool):pool[0],kind:'random'});
  }
  if(!cards.length)cards.push({nodeId:'EMPTY',kind:'empty'});
  d.cards=cards;
}
export function openDraft(s:RunState):void{
  if(s.draft||s.choicesSpent>=s.choicesEarned||s.outcome)return;
  const focusId=[...s.actions].reverse().find(a=>a.command.type==='focus')?.command;
  s.draft={id:s.nextOfferId++,choice:s.choicesSpent+1,cards:[],focusId:focusId?.type==='focus'?focusId.characterId:s.config.captainId,selectedEvolution:null};
  if(focusRound(s)&&!focusNode(s,s.draft.focusId)){const available=s.config.squadIds.find(id=>focusNode(s,id));if(available)s.draft.focusId=available;}
  if(!s.pauseReasons.includes('upgrade'))s.pauseReasons.push('upgrade');
  s.phase='choosing';rebuildDraft(s,true);
}
export function rerollDraft(s:RunState):boolean{
  if(!s.draft||s.rerollsRemaining<=0)return false;
  const old=s.draft.cards;const cards=old.map(c=>({...c}));const legal=getLegalNodeIds(s).filter(id=>!id.endsWith('-3')&&(!focusRound(s)||!id.startsWith('C')));
  const rngBefore=s.rng.draft;let changed=false;
  for(let i=0;i<cards.length;i++){
    if(cards[i].kind!=='random')continue;
    const pool=legal.filter(id=>id!==old[i].nodeId&&!cards.some((c,j)=>j!==i&&c.nodeId===id));
    if(pool.length){cards[i].nodeId=weighted(s,pool);changed=true;}
  }
  if(!changed){s.rng.draft=rngBefore;return false;}
  s.draft.cards=cards;s.rerollsRemaining--;return true;
}
