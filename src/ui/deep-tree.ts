import { usesSkillNetwork } from '../data/skill-network';
import { resolveSkillNode, resolveSkillTree } from '../data/reworked-skills';
import { operationProfile } from '../data/progression';
import { CHARACTER_MAP, ENEMY_MAP, STAGE_MAP } from '../data/content';
import { COMMON_ROUTE_NAMES, DEEP_NODE_MAP, DEEP_TREE_MAP, deepTreesFor } from '../data/deep-trees';
import { deepHas, deepLock, deepNodeCost, deepPointCost } from '../sim/deep-tree';
import { nextIntel, VARIANT_INFO, EVENT_INFO } from '../sim/operations';
import { weaponStats } from '../sim/weapons';
import { weaponRange } from '../sim/range';
import { esc, clock } from './format';
import { formPortrait, originalForm } from '../data/forms';
import { skillEmblem } from './skill-constellation';
import type { RunState } from '../sim/types';
import type { ViewModel } from './model';

export { constellationGraph as deepGraph } from './skill-constellation';
import { constellationGraph as deepGraph } from './skill-constellation';

function battlefieldIntel(run:RunState){
  const rows=nextIntel(run),boss=ENEMY_MAP[STAGE_MAP[run.config.stageId].bossId];
  return `<details class="operation-intel" ${run.draft?'open':''}><summary>下一階段敵情 <span>${rows.length?`第 ${rows[0].wave} 波起`:'首領戰'}</span></summary><div>${rows.map(row=>{
    const variant=VARIANT_INFO[row.brief?.variant??'standard'],event=EVENT_INFO[row.brief?.event??'none'];
    return `<article><b>第 ${row.wave} 波 · ${run.waveFlow?'清場後推進':clock(row.at)} · ${esc(row.name??variant.name)}</b><p>${row.counts.map(([id,count])=>`${esc(ENEMY_MAP[id].name)} ×${count}`).join('、')||'本波已部署完成'}</p><small>未出場單位：護盾 ${row.shieldPercent}% · 裝甲 ${row.armorPercent}%</small><p>${variant.description}</p>${row.hint?`<p class="event-rule">${esc(row.hint)}</p>`:''}${row.brief?.event!=='none'?`<p class="event-rule"><strong>${event.name}</strong> · ${event.description}</p>`:''}<details><summary>敵人特性與反制</summary>${row.counts.map(([id])=>`<p><b>${esc(ENEMY_MAP[id].name)}</b>：${esc(ENEMY_MAP[id].mechanic)}<br>反制：${esc(ENEMY_MAP[id].counter)}</p>`).join('')}</details></article>`;
  }).join('')}<p class="boss-intel"><b>${run.waveFlow?(run.config.mode==='hundred'?'第 100 波':'完成常規波次後'):clock(operationProfile(run).bossAt*30)} · ${esc(boss.name)}</b><br>${esc(boss.mechanic)}<br>弱點與反制：${esc(boss.counter)}</p></div></details>`;
}
export function deepTreePanel(run:RunState,vm:ViewModel){
  const view=vm.treePanel!,owner=view.ownerId,form=owner==='common'?undefined:run.config.forms?.[owner],tree=resolveSkillTree(DEEP_TREE_MAP[view.treeId]??deepTreesFor(owner,run)[0],form);
  const base=DEEP_NODE_MAP[view.nodeId??''],node=base?resolveSkillNode(base,form):undefined,pending=run.draft?.pendingNodeIds??[],lock=node?deepLock(run,node.id):null;
  const name=owner==='common'?'全隊共用':CHARACTER_MAP[owner].name,color=owner==='common'?'#558577':CHARACTER_MAP[owner].color;
  const remaining=run.draft?(run.draft.pointTarget??0)-run.choicesSpent:0,queued=deepPointCost(pending,run);
  const waveAllocation=!!run.waveFlow&&!!run.draft;
  const owned=!!node&&deepHas(run,node.id),selectedPending=!!node&&pending.includes(node.id);
  const cost=node?deepNodeCost(node.id,run):0;
  const reason=owned?null:lock??(remaining&&cost>remaining?'剩餘點數不足':null);
  const status=owned?'已取得':selectedPending?'待確認':reason?'':remaining?'可配置':'可於波末配置';
  const state=owned?'owned':selectedPending?'pending':reason?'locked':'available';
  const confirmAllowed=!!node&&remaining>0&&!owned&&!lock&&cost<=remaining;
  const weapon=owner==='common'?undefined:run.weapons.find(w=>w.id===owner),stats=weapon?weaponStats(run,weapon):null;
  return `<div class="modal-backdrop tree-backdrop skill-modal-backdrop"><section class="tree-panel deep-panel skill-configuration ${remaining||waveAllocation?'allocating':'viewing'} ${waveAllocation?'wave-allocation':''}" data-tree-id="${tree.id}" role="dialog" aria-modal="true" aria-labelledby="deep-title" style="--character:${color}">
    <header class="tree-header"><div class="tree-heading"><span class="eyebrow">${waveAllocation?'波末配點':'技能配置'} · 戰鬥已暫停</span><h2 id="deep-title">${waveAllocation?`第 ${run.waveFlow!.wave} 波完成`:remaining?'配置技能':'本局技能樹'}</h2></div><div class="tree-header-actions">${remaining||waveAllocation?`<span class="points-left" role="status"><span>可用 <b>${remaining}</b> 點</span><small>已選 ${queued} · 保留 ${remaining-queued}</small></span>`:''}<button class="icon-button" data-action="${remaining||waveAllocation?'tree-exit':'tree-close'}" aria-label="${remaining||waveAllocation?'離開關卡':'關閉技能樹'}">×</button></div></header>
    <div class="tree-scroll">${battlefieldIntel(run)}
    <nav class="tree-characters deep-characters" aria-label="選擇隊員技能" style="--squad-size:${run.config.squadIds.length}">${run.config.squadIds.map(id=>`<button data-action="deep-owner" data-id="${id}" aria-pressed="${id===owner}" class="${id===owner?'active':''}"><span class="character-avatar"><img data-owner="${id}" src="${formPortrait(run.config.forms?.[id]??originalForm(id))}" alt="" loading="lazy"></span><span>${esc(CHARACTER_MAP[id].name)}</span><small>${deepPointCost((run.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n]?.ownerId===id),run)} 點${pending.some(n=>DEEP_NODE_MAP[n]?.ownerId===id)?`<em>+${deepPointCost(pending.filter(n=>DEEP_NODE_MAP[n]?.ownerId===id),run)}</em>`:''}</small></button>`).join('')}</nav>
    ${usesSkillNetwork(run)?'':`<nav class="tree-tabs" aria-label="${esc(name)}技能樹">${deepTreesFor(owner,run).map(t=>`<button data-action="deep-tab" data-id="${t.id}" aria-pressed="${t.id===tree.id}" class="${t.id===tree.id?'active':''}"><span>${esc(t.name)}</span></button>`).join('')}</nav>`}
    <div class="tree-intro"><h3>${esc(name)} · ${esc(tree.name)}</h3><p>${esc(tree.purpose)}</p><span>全隊終極 ${run.evolvedCount}/${run.evolutionLimit} · ${remaining?`${waveAllocation?'波末配置':`里程碑 ${run.draft!.choice}/${operationProfile(run).points/2}`} · 已選 ${queued}/${remaining}`:'隨時可查看'}</span>${stats?`<p class="weapon-readout">目前傷害 ${stats.damage.toFixed(1)} · 間隔 ${(stats.interval/30).toFixed(2)} 秒 · 射程 ${weaponRange(run,weapon!.id)}</p>`:''}</div>
    ${owner==='common'?`<div class="common-route-labels">${COMMON_ROUTE_NAMES.map(t=>`<b>${t}</b>`).join('')}</div>`:''}${deepGraph(tree,run,node?.id)}
    <p class="tree-path-note">${owner==='common'?'共用技能均為被動或自動觸發，不占終極名額。':usesSkillNetwork(run)?'可跨路線配點；交會點任一前置即可解鎖。終極最短需 4 點前置＋2 點，其他路線以普通技能封頂。':'沿連線取得前置；本樹先投入 4 點，再取得終極。'}</p>
    <div class="tree-owned"><b>已取得的技能</b><p>${(run.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n]?.ownerId===owner).map(n=>esc(resolveSkillNode(DEEP_NODE_MAP[n],form).name)).join(' · ')||'尚未投入，可從入口開始。'}</p></div>
    </div><footer class="skill-tree-actions">
    ${waveAllocation?`<button class="button primary wave-bank" data-action="bank-wave-points">開始下一波${remaining?` · 保留 ${remaining} 點`:''}</button>`:'<button class="text-button" data-action="tree-save-home">離開關卡 · 本局結束</button>'}
    </footer>
    ${view.detailOpen&&node?`<dialog class="mobile-detail skill-description-dialog" data-detail="combat-node:${tree.id}" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title">
      <div class="mobile-detail-body node-description" data-state="${state}">
        <div class="node-detail-heading"><span class="node-detail-icon ${state} ${node.kind}" aria-hidden="true">${skillEmblem(node)}</span><div><div class="node-title-row"><h3 id="skill-detail-title">${esc(node.name)}</h3>${status?`<span class="node-status ${state}">${status}</span>`:''}</div><p class="node-effect">${esc(node.description)}</p></div></div>
        <div class="node-prerequisites">${node.parents.length?`<span>前置${node.requires==='any'&&node.parents.length>1?'（任一即可）':''}：</span>${node.parents.map(id=>`<span class="prerequisite ${deepHas(run,id)?'owned':'locked'}">${esc(resolveSkillNode(DEEP_NODE_MAP[id],form).name)} <b>${deepHas(run,id)?'✓ 已取得':'未取得'}</b></span>`).join('')}${node.kind==='ultimate'?'<span>此角色需先投入 4 點</span>':''}`:'<span>入口技能 · 無前置條件</span>'}</div>
        ${reason?`<small class="node-lock-reason">${esc(reason)}</small>`:''}
        <small class="node-selection-hint">${selectedPending?'確認配置後取得此技能，並扣除所需點數。':owned?'本局已取得此技能。':remaining?'選擇可配置的節點後，確認配置即可生效。':'波末取得技能點時可配置。'}</small>
      </div>
      <footer class="mobile-detail-actions"><button class="button primary" data-action="buy-node" ${confirmAllowed?'':'disabled'}>確認配置</button><button class="button secondary" data-action="tree-detail-close">關閉</button></footer>
    </dialog>`:''}
  </section></div>`;
}
