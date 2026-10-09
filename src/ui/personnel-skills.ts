import { FORM_MAP, ELEMENTS } from '../data/forms';
import { resolveSkillNode, resolveSkillTree } from '../data/reworked-skills';
import type { FormId } from '../sim/types';
import { CHARACTER_MAP } from '../data/content';
import { DEEP_NODE_MAP, DEEP_TREE_MAP } from '../data/deep-trees';
import type { CharacterId } from '../sim/types';
import { deepGraph } from './deep-tree';
import { esc } from './format';
import { skillNodeDetail } from './skill-node-detail';
import { skillTheme } from './skill-theme';

export interface PersonnelSkills { ownerId:CharacterId;treeId:string;nodeId:string|null;formId?:FormId;mapSession?:number; }
export function personnelSkills(view:PersonnelSkills) {
  const owner=CHARACTER_MAP[view.ownerId],tree=resolveSkillTree(DEEP_TREE_MAP[view.treeId],view.formId);
  const base=DEEP_NODE_MAP[view.nodeId??''],node=base?resolveSkillNode(base,view.formId):undefined;
  return `<div class="modal-backdrop personnel-skills-backdrop"><section class="dialog personnel-skills-dialog constellation-preview" role="dialog" aria-modal="true" aria-labelledby="personnel-skills-title" data-owner="${owner.id}" data-tree-id="${tree.id}" data-map-session="${view.mapSession??0}" style="${skillTheme(view.formId,view.ownerId)}">
    <header><div><small>${owner.id} / 技能預覽</small><h2 id="personnel-skills-title">${esc(owner.name)}・技能樹</h2></div><button class="icon-button" data-action="personnel-skills-close" aria-label="關閉技能樹">×</button></header>
    <div class="skill-form-switch" aria-label="預覽換裝">${['original','summer'].map(theme=>`<button data-action="personnel-skill-form" data-id="${owner.id}-${theme}" aria-pressed="${(view.formId??`${owner.id}-original`)===`${owner.id}-${theme}`}">${theme==='summer'?'夏日換裝':'原裝'}</button>`).join('')}<span>${esc(ELEMENTS[FORM_MAP[view.formId??`${owner.id}-original`].damageType].name)} · 同武器，不同招式</span></div>
    <div class="split-network-view"><div class="personnel-skill-scroll" id="personnel-skill-content" role="region" aria-label="${esc(owner.name)}完整技能網路" tabindex="0"><div class="constellation-intro"><span>能力星圖</span><p>${esc(tree.purpose)}</p><small>◎ 終極大招 · 2 點</small></div>${deepGraph(tree,undefined,node?.id,'personnel-skill-node',view.formId)}<p class="personnel-skill-note">24 個節點 · 交會任一前置即可 · 普通技能 1 點、終極 2 點</p></div>
    ${skillNodeDetail({owner:view.ownerId,form:view.formId,node,open:!!node})}</div>
  </section></div>`;
}
