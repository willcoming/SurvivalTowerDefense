import { CHARACTER_MAP } from '../data/content';
import { DEEP_NODE_MAP, DEEP_TREE_MAP, deepTreesFor } from '../data/deep-trees';
import type { CharacterId } from '../sim/types';
import { deepGraph } from './deep-tree';
import { esc } from './format';

export interface PersonnelSkills { ownerId:CharacterId;treeId:string;nodeId:string|null; }
export function personnelSkills(view:PersonnelSkills) {
  const owner=CHARACTER_MAP[view.ownerId],trees=deepTreesFor(owner.id),tree=DEEP_TREE_MAP[view.treeId];
  const node=DEEP_NODE_MAP[view.nodeId??''];
  return `<div class="modal-backdrop personnel-skills-backdrop"><section class="dialog personnel-skills-dialog" role="dialog" aria-modal="true" aria-labelledby="personnel-skills-title" data-owner="${owner.id}" data-tree-id="${tree.id}">
    <header><div><small>${owner.id} / 技能預覽</small><h2 id="personnel-skills-title">${esc(owner.name)}・技能樹</h2></div><button class="icon-button" data-action="personnel-skills-close" aria-label="關閉技能樹">×</button></header>
    <div class="personnel-skill-tabs" role="tablist" aria-label="技能分支">${trees.map(t=>`<button role="tab" id="personnel-tab-${t.id}" data-action="personnel-skill-tab" data-id="${t.id}" aria-controls="personnel-skill-content" aria-selected="${t.id===tree.id}" tabindex="${t.id===tree.id?0:-1}">${esc(t.name)}</button>`).join('')}</div>
    <div class="personnel-skill-scroll" id="personnel-skill-content" role="tabpanel" aria-labelledby="personnel-tab-${tree.id}" tabindex="0"><p>${esc(tree.purpose)}</p>${deepGraph(tree,undefined,node?.id,'personnel-skill-node')}<p class="personnel-skill-note">沿連線取得前置；本樹先投入 4 點，再取得終極。普通技能 1 點，終極大招 2 點，於每局戰鬥中配置。</p></div>
    <footer class="personnel-skill-detail" aria-live="polite">${node?`<h3>${esc(node.name)}</h3><p>${esc(node.description)}</p><small>前置：${node.parents.map(id=>esc(DEEP_NODE_MAP[id].name)).join(node.requires==='any'?' 或 ':'＋')||'入口，可直接取得'}${node.kind==='ultimate'?'；本樹先投入 4 點':''}</small>`:'<h3>點選節點查看效果</h3><p>查看技能說明與解鎖條件。</p>'}</footer>
  </section></div>`;
}
