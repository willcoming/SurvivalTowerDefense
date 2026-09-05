import { NODE_MAP } from '../data/skill-trees';
import { treeLegalNodes } from './skill-tree';
import { nextRandom } from './rng';
import type { RunState, UpgradeCard } from './types';

/** Equal owner weights (2 per available character, 1 for the common pool), independent of tree/node counts. */
export function drawTreeNode(s: RunState, pool: string[]): string {
  const owners: string[] = [...new Set(pool.map(id => NODE_MAP[id]?.ownerId ?? 'common'))].sort();
  let pick = nextRandom(s.rng,'draft') * owners.reduce((sum,id)=>sum+(id==='common'?1:2),0);
  let owner = owners.at(-1)!;
  for (const id of owners) { pick -= id==='common'?1:2; if(pick<0) {owner=id;break;} }
  const nodes = pool.filter(id => (NODE_MAP[id]?.ownerId ?? 'common') === owner);
  return nodes[Math.floor(nextRandom(s.rng,'draft')*nodes.length)];
}
export function rebuildTreeDraft(s: RunState) {
  const d=s.draft;if(!d)return;
  const legal=treeLegalNodes(s);
  if (!legal.length) { d.cards=[{nodeId:'EMPTY',kind:'empty'}]; delete d.customNodeId; return; }
  if (!d.customNodeId || !legal.includes(d.customNodeId)) d.customNodeId = legal.find(n=>NODE_MAP[n]?.ownerId===d.focusId) ?? legal[0];
  const cards: UpgradeCard[]=[{nodeId:d.customNodeId,kind:'focus'}];
  // Moving the custom slot onto a random card swaps the previous custom candidate into its place.
  const previousFocus=d.cards.find(c=>c.kind==='focus')?.nodeId;
  for (const c of d.cards.filter(c=>c.kind==='random')) {
    const id = c.nodeId===d.customNodeId ? previousFocus : c.nodeId;
    if (id && legal.includes(id) && !cards.some(c=>c.nodeId===id)) cards.push({nodeId:id,kind:'random'});
  }
  // A custom selection must not let a player reroll randomness for free.
  while(cards.length<Math.min(3,legal.length)) {
    const pool=legal.filter(id=>!cards.some(c=>c.nodeId===id));
    cards.push({nodeId:d.cards.length ? pool[0] : drawTreeNode(s,pool),kind:'random'});
  }
  d.cards=cards;
}
export function rerollTreeDraft(s: RunState) {
  const d=s.draft; if(!d||s.rerollsRemaining<=0)return false;
  const cards=d.cards.map(c=>({...c}));const legal=treeLegalNodes(s);let changed=false;
  for(let i=0;i<cards.length;i++) {
    if(cards[i].kind!=='random')continue;
    const pool=legal.filter(id=>id!==d.cards[i].nodeId&&!cards.some((c,j)=>j!==i&&c.nodeId===id));
    if(pool.length) {cards[i].nodeId=drawTreeNode(s,pool);changed=true;}
  }
  if(changed){d.cards=cards;s.rerollsRemaining--;}
  return changed;
}
