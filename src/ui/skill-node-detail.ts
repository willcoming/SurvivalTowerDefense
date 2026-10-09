import { CHARACTER_MAP } from '../data/content';
import { DEEP_NODE_MAP, type DeepNode, type SkillOwner } from '../data/deep-trees';
import { FORM_MAP, formPortrait, originalForm } from '../data/forms';
import { resolveSkillNode } from '../data/reworked-skills';
import { deepHas, deepLock, deepNodeCost } from '../sim/deep-tree';
import type { FormId, RunState } from '../sim/types';
import { esc } from './format';
import { skillEmblem } from './skill-constellation';
import { renderSkillStats } from './skill-stat-preview';

interface DetailOptions { owner:SkillOwner; form?:FormId; node?:DeepNode; run?:RunState; open:boolean }

/** One detail region shared by the bottom sheet and desktop side column. */
export function skillNodeDetail({owner,form,node,run,open}:DetailOptions){
  const active=open?node:undefined,owned=!!(active&&run&&deepHas(run,active.id));
  const pending=!!(active&&run?.draft?.pendingNodeIds?.includes(active.id));
  const remaining=run?.draft?(run.draft.pointTarget??0)-run.choicesSpent:0;
  const cost=active?deepNodeCost(active.id,run):0;
  const reason=active&&run&&!owned?(deepLock(run,active.id)??(run.draft&&cost>remaining?'剩餘點數不足':null)):null;
  const state=!run?'preview':owned?'owned':pending?'pending':reason?'locked':'available';
  const status=!run?'圖鑑預覽':owned?'已取得':pending?'待確認':reason?'前置未達成':run.draft?'可配置':'波末可配置';
  const confirmAllowed=!!(active&&run?.draft&&remaining>=cost&&!owned&&!reason);
  const titleId=run?'skill-detail-title':'personnel-detail-title';
  const resolvedForm=owner==='common'?undefined:form??originalForm(owner);
  const member=owner==='common'?undefined:CHARACTER_MAP[owner];
  return `<aside class="skill-bottom-sheet ${run?'combat-skill-detail':'personnel-skill-detail'}" data-open="${!!active}" role="region" aria-label="${run?'技能配置詳情':'技能預覽詳情'}">
    ${member&&resolvedForm?`<div class="skill-member-overview"><img src="${formPortrait(resolvedForm)}" alt="${esc(member.name)}・${esc(FORM_MAP[resolvedForm].name)}"><div><span>${run?'目前隊員':'圖鑑預覽'}</span><h3>${esc(member.name)}</h3><p>${esc(member.weaponName)}</p><small>${esc(FORM_MAP[resolvedForm].name)}</small></div></div>`:''}
    ${active?`<div class="skill-node-detail node-description" data-state="${state}" aria-labelledby="${titleId}">
      <span class="node-detail-icon ${state} ${active.kind}" aria-hidden="true">${skillEmblem(active,resolvedForm)}</span>
      <div class="node-detail-copy" tabindex="0"><div class="node-title-row"><h3 id="${titleId}">${esc(active.name)}</h3><span class="node-status ${state}">${reason==='剩餘點數不足'?'點數不足':status}</span></div>
        <p class="node-effect">${esc(active.description)}</p>
        <div class="node-prerequisites">${active.parents.length?`<span>前置${active.requires==='any'&&active.parents.length>1?'（任一即可）':''}：</span>${active.parents.map(id=>`<span class="prerequisite ${run?(deepHas(run,id)?'owned':'locked'):'preview'}">${esc(resolveSkillNode(DEEP_NODE_MAP[id],resolvedForm).name)}${run?` <b>${deepHas(run,id)?'✓ 已取得':'未取得'}</b>`:''}</span>`).join('')}`:'<span>入口技能 · 無前置條件</span>'}${active.kind==='ultimate'?'<span>此角色需先投入 4 點</span>':''}</div>
        ${reason?`<small class="node-lock-reason">${esc(reason)}</small>`:''}
      </div>
    </div><footer class="skill-detail-actions">${run?`<button class="button primary" data-action="buy-node" ${confirmAllowed?'':'disabled'}>確認配置</button><span class="skill-detail-cost">${cost} 點</span>`:'<span class="skill-preview-note">圖鑑預覽 · 不消耗點數</span>'}<button class="skill-detail-close" data-action="${run?'tree-detail-close':'personnel-skill-detail-close'}" aria-label="關閉">×</button></footer>`:'<div class="skill-detail-empty"><h3>點選節點查看效果</h3><p>查看技能說明與解鎖條件。</p></div>'}
    ${run&&owner!=='common'?renderSkillStats(run,owner,confirmAllowed?active!.id:undefined):''}
    <span class="sr-only" aria-live="polite" aria-atomic="true">${active?`${active.name}，${status}${reason?`，${reason}`:''}`:''}</span>
  </aside>`;
}
