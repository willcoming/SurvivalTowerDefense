import { usesSkillNetwork } from '../data/skill-network';
import { resolveSkillNode, resolveSkillTree, usesReworkedSkills } from '../data/reworked-skills';
import { operationProfile } from '../data/progression';
import { CHARACTER_MAP, ENEMY_MAP, STAGE_MAP } from '../data/content';
import { COMMON_ROUTE_NAMES, DEEP_NODE_MAP, DEEP_TREE_MAP, deepTreesFor } from '../data/deep-trees';
import { deepHas, deepLock, deepLegalNodes, canSpendDeepPoints, deepNodeCost, deepPointCost } from '../sim/deep-tree';
import { nextIntel, VARIANT_INFO, EVENT_INFO } from '../sim/operations';
import { weaponStats } from '../sim/weapons';
import { weaponRange } from '../sim/range';
import { esc, portrait, clock } from './format';
import type { RunState } from '../sim/types';
import type { ViewModel } from './model';

export { constellationGraph as deepGraph } from './skill-constellation';
import { constellationGraph as deepGraph } from './skill-constellation';

function battlefieldIntel(run:RunState){
  const rows=nextIntel(run),boss=ENEMY_MAP[STAGE_MAP[run.config.stageId].bossId];
  return `<details class="operation-intel" ${run.draft?'open':''}><summary>下一階段敵情 <span>${rows.length?`第 ${rows[0].wave} 波起`:'首領戰'}</span></summary><div>${rows.map(row=>{
    const variant=VARIANT_INFO[row.brief?.variant??'standard'],event=EVENT_INFO[row.brief?.event??'none'];
    return `<article><b>第 ${row.wave} 波 · ${clock(row.at)} · ${esc(row.name??variant.name)}</b><p>${row.counts.map(([id,count])=>`${esc(ENEMY_MAP[id].name)} ×${count}`).join('、')||'本波已部署完成'}</p><small>未出場單位：護盾 ${row.shieldPercent}% · 裝甲 ${row.armorPercent}%</small><p>${variant.description}</p>${row.hint?`<p class="event-rule">${esc(row.hint)}</p>`:''}${row.brief?.event!=='none'?`<p class="event-rule"><strong>${event.name}</strong> · ${event.description}</p>`:''}<details><summary>敵人特性與反制</summary>${row.counts.map(([id])=>`<p><b>${esc(ENEMY_MAP[id].name)}</b>：${esc(ENEMY_MAP[id].mechanic)}<br>反制：${esc(ENEMY_MAP[id].counter)}</p>`).join('')}</details></article>`;
  }).join('')}<p class="boss-intel"><b>${clock(operationProfile(run).bossAt*30)} · ${esc(boss.name)}</b><br>${esc(boss.mechanic)}<br>弱點與反制：${esc(boss.counter)}</p></div></details>`;
}
export function deepTreePanel(run:RunState,vm:ViewModel){
  const view=vm.treePanel!,owner=view.ownerId,form=owner==='common'?undefined:run.config.forms?.[owner],tree=resolveSkillTree(DEEP_TREE_MAP[view.treeId]??deepTreesFor(owner,run)[0],form);
  const base=DEEP_NODE_MAP[view.nodeId??''],node=base?resolveSkillNode(base,form):undefined,pending=run.draft?.pendingNodeIds??[],shadow={...run,treeNodes:[...(run.treeNodes??[]),...pending]},lock=node&&!pending.includes(node.id)?deepLock(shadow,node.id):null;
  const name=owner==='common'?'全隊共用':CHARACTER_MAP[owner].name,color=owner==='common'?'#558577':CHARACTER_MAP[owner].color;
  const remaining=run.draft?(run.draft.pointTarget??0)-run.choicesSpent:0,queued=deepPointCost(pending,run);
  const weapon=owner==='common'?undefined:run.weapons.find(w=>w.id===owner),stats=weapon?weaponStats(run,weapon):null;
  return `<div class="modal-backdrop tree-backdrop skill-modal-backdrop"><section class="tree-panel deep-panel" data-tree-id="${tree.id}" role="dialog" aria-modal="true" aria-labelledby="deep-title" style="--character:${color}">
    <header class="tree-header"><div><span class="eyebrow">Ⅱ 戰鬥暫停 · 技能配置</span><h2 id="deep-title">${remaining?'配置技能':'本局技能樹'} <small>${run.choicesSpent} / ${operationProfile(run).points} 點</small></h2></div>${remaining?`<span class="points-left" role="status"><span>已分配點數</span><strong><b>${queued}</b> / ${remaining}</strong></span>`:'<button class="icon-button" data-action="tree-close" aria-label="關閉技能樹">×</button>'}</header>
    <div class="tree-scroll">${battlefieldIntel(run)}
    <nav class="tree-characters deep-characters" aria-label="選擇隊員技能" style="--squad-size:${run.config.squadIds.length}">${run.config.squadIds.map(id=>`<button data-action="deep-owner" data-id="${id}" aria-pressed="${id===owner}" class="${id===owner?'active':''}">${portrait(id)}<span>${esc(CHARACTER_MAP[id].name)}</span><small>${deepPointCost((run.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n]?.ownerId===id),run)} 點${pending.some(n=>DEEP_NODE_MAP[n]?.ownerId===id)?`<em>+${deepPointCost(pending.filter(n=>DEEP_NODE_MAP[n]?.ownerId===id),run)}</em>`:''}</small></button>`).join('')}</nav>
    <nav class="tree-tabs" aria-label="${esc(name)}技能樹">${deepTreesFor(owner,run).map(t=>`<button data-action="deep-tab" data-id="${t.id}" aria-pressed="${t.id===tree.id}" class="${t.id===tree.id?'active':''}"><span>${esc(t.name)}</span><small>${t.nodes.filter(n=>deepHas(run,n.id)).length} / ${t.nodes.length}</small></button>`).join('')}</nav>
    <div class="tree-intro"><h3>${esc(name)} · ${esc(tree.name)}</h3><p>${esc(tree.purpose)}</p><span>全隊終極 ${run.evolvedCount}/${run.evolutionLimit} · ${remaining?`里程碑 ${run.draft!.choice}/${operationProfile(run).points/2} · 已選 ${queued}/${remaining}`:'隨時可查看'}</span>${stats?`<p class="weapon-readout">目前傷害 ${stats.damage.toFixed(1)} · 間隔 ${(stats.interval/30).toFixed(2)} 秒 · 射程 ${weaponRange(run,weapon!.id)}</p>`:''}</div>
    ${owner==='common'?`<div class="common-route-labels">${COMMON_ROUTE_NAMES.map(t=>`<b>${t}</b>`).join('')}</div>`:''}${deepGraph(tree,run,node?.id)}
    <p class="tree-path-note">${owner==='common'?'共用技能均為被動或自動觸發，不占終極名額。':usesSkillNetwork(run)?'可跨路線配點；交會點任一前置即可解鎖。終極最短需 4 點前置＋2 點，其他路線以普通技能封頂。':'沿連線取得前置；本樹先投入 4 點，再取得終極。'}</p>
    <div class="tree-owned"><b>已取得的技能</b><p>${(run.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n]?.ownerId===owner).map(n=>esc(resolveSkillNode(DEEP_NODE_MAP[n],form).name)).join(' · ')||'尚未投入，可從入口開始。'}</p></div>
    </div><footer class="node-preview" aria-live="polite"><div>${node?`<span class="eyebrow">${node.kind==='ultimate'?`ULTIMATE / 終極 · ${deepNodeCost(node.id,run)} 點`:node.kind==='entry'?'ENTRY / 入口':'MODULE / 模組'}</span><h3>${esc(node.name)}${node.kind==='ultimate'?` · ${deepNodeCost(node.id,run)} 點`:''}</h3><p>${esc(node.description)}</p><small>${esc(lock??(node.kind==='ultimate'?usesReworkedSkills(run)?'取得後先完成一次冷卻，有有效目標時自動施放。':'取得後本角色其他終極鎖定。':'確認後立即生效，本局不能洗點。'))}</small>${node.parents.length?`<small class="node-prerequisites">前置：${node.parents.map(id=>esc(resolveSkillNode(DEEP_NODE_MAP[id],form).name)).join(node.requires==='any'?' 或 ':'＋')}${node.kind==='ultimate'?'；此角色已投入 4 點':''}</small>`:''}`:`<h3>${remaining?'選擇本次強化':'檢視技能路線'}</h3><p>${remaining?'點選亮起的節點，可跨角色分配。':'點選節點，查看效果與解鎖條件。'}</p>`}</div>
    <button class="button primary" data-action="buy-node" ${remaining?(queued!==remaining&&!(queued>0&&(usesSkillNetwork(run)?!canSpendDeepPoints({...shadow,evolvedCount:run.evolvedCount+pending.filter(id=>DEEP_NODE_MAP[id].kind==='ultimate').length},remaining-queued):!deepLegalNodes({...shadow,evolvedCount:run.evolvedCount+pending.filter(id=>DEEP_NODE_MAP[id].kind==='ultimate').length}).length))?'disabled':''): 'disabled'}>${remaining?`確認強化 · ${queued}/${remaining} →`:'查看模式 · 經驗升級時可取得'}</button>
    <div class="deep-footer-note"><small>${remaining?'本次點數用完後自動返回戰鬥。':'關閉後返回原本戰鬥狀態。'}</small><button class="text-button" data-action="tree-save-home">離開關卡 · 本局結束</button></div></footer>
  </section></div>`;
}
