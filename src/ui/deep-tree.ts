import { operationProfile } from '../data/progression';
import { CHARACTER_MAP, ENEMY_MAP, STAGE_MAP } from '../data/content';
import { COMMON_ROUTE_NAMES, DEEP_NODE_MAP, DEEP_TREE_MAP, deepTreesFor, type DeepTree } from '../data/deep-trees';
import { deepHas, deepLock, deepLegalNodes, deepNodeCost, deepPointCost } from '../sim/deep-tree';
import { nextIntel, VARIANT_INFO, EVENT_INFO } from '../sim/operations';
import { weaponStats } from '../sim/weapons';
import { weaponRange } from '../sim/range';
import { esc, portrait, clock } from './format';
import type { RunState } from '../sim/types';
import type { ViewModel } from './model';

export function deepGraph(tree:DeepTree,run?:RunState,selected?:string|null,action=run?'deep-node':'codex-node'){
  const height=(Math.max(...tree.nodes.map(n=>n.layer))+1)*104;
  const point=(id:string)=>{const n=DEEP_NODE_MAP[id];return{x:60+n.lane*120,y:50+n.layer*104};};
  const edges=tree.nodes.flatMap(n=>n.parents.map(parent=>{
    const a=point(parent),b=point(n.id),on=!!run&&deepHas(run,parent),chosen=selected===n.id||selected===parent;
    return `<path class="${on?'connected':''} ${chosen?'traced':''}" data-parent="${parent}" data-child="${n.id}" d="M ${a.x} ${a.y+34} C ${a.x} ${a.y+59}, ${b.x} ${b.y-59}, ${b.x} ${b.y-34}"/>`;
  })).join('');
  const pending=run?.draft?.pendingNodeIds??[];
  const shadow=run?{...run,treeNodes:[...(run.treeNodes??[]),...pending]}:undefined;
  return `<div class="deep-graph" style="height:${height}px" aria-label="${esc(tree.name)}前置路線"><svg class="deep-connections" viewBox="0 0 360 ${height}" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>${tree.nodes.map(n=>{
    const owned=!!run&&deepHas(run,n.id),queued=pending.includes(n.id),cost=deepNodeCost(n.id,run),reason=run&&!owned&&!queued?(deepLock(shadow!,n.id)??(run.draft&&cost>(run.draft.pointTarget??0)-run.choicesSpent-deepPointCost(pending,run)?`需要 ${cost} 點，剩餘點數不足`:null)):null,state=owned?'owned':queued?'pending':reason?'locked':'available';
    return `<button class="deep-node ${state} ${n.kind} ${selected===n.id?'inspecting':''}" style="left:${(n.lane*120+60)/3.6}%;top:${n.layer*104+12}px" data-action="${action}" data-id="${n.id}" data-state="${state}" data-cost="${cost}" data-layer="${n.layer}" aria-pressed="${selected===n.id}" aria-label="${esc(n.name)}，${owned?'已取得':queued?'待確認':reason??`${cost} 點可取得`}" ${run?.draft&&state==='locked'?'disabled':''}><span class="node-symbol">${owned?'✓':queued?'●':n.kind==='ultimate'?'✦':reason?'◇':'＋'}</span><strong>${esc(n.name)}</strong><small>${owned?'已取得':queued?'待確認':reason?'查看前置':n.kind==='ultimate'?`終極 · ${cost} 點`:'1 技能點'}</small></button>`;
  }).join('')}</div>`;
}
function battlefieldIntel(run:RunState){
  const rows=nextIntel(run),boss=ENEMY_MAP[STAGE_MAP[run.config.stageId].bossId];
  return `<details class="operation-intel" ${run.draft?'open':''}><summary>下一階段敵情 <span>${rows.length?`第 ${rows[0].wave} 波起`:'首領戰'}</span></summary><div>${rows.map(row=>{
    const variant=VARIANT_INFO[row.brief?.variant??'standard'],event=EVENT_INFO[row.brief?.event??'none'];
    return `<article><b>第 ${row.wave} 波 · ${clock(row.at)} · ${variant.name}</b><p>${row.counts.map(([id,count])=>`${esc(ENEMY_MAP[id].name)} ×${count}`).join('、')||'本波已部署完成'}</p><small>未出場單位：護盾 ${row.shieldPercent}% · 裝甲 ${row.armorPercent}%</small><p>${variant.description}</p>${row.brief?.event!=='none'?`<p class="event-rule"><strong>${event.name}</strong> · ${event.description}</p>`:''}<details><summary>敵人特性與反制</summary>${row.counts.map(([id])=>`<p><b>${esc(ENEMY_MAP[id].name)}</b>：${esc(ENEMY_MAP[id].mechanic)}<br>反制：${esc(ENEMY_MAP[id].counter)}</p>`).join('')}</details></article>`;
  }).join('')}<p class="boss-intel"><b>${clock(operationProfile(run).bossAt*30)} · ${esc(boss.name)}</b><br>${esc(boss.mechanic)}<br>弱點與反制：${esc(boss.counter)}</p></div></details>`;
}
export function deepTreePanel(run:RunState,vm:ViewModel){
  const view=vm.treePanel!,owner=view.ownerId,tree=DEEP_TREE_MAP[view.treeId]??deepTreesFor(owner)[0];
  const node=DEEP_NODE_MAP[view.nodeId??''],pending=run.draft?.pendingNodeIds??[],shadow={...run,treeNodes:[...(run.treeNodes??[]),...pending]},lock=node&&!pending.includes(node.id)?deepLock(shadow,node.id):null;
  const name=owner==='common'?'全隊共用':CHARACTER_MAP[owner].name,color=owner==='common'?'#558577':CHARACTER_MAP[owner].color;
  const remaining=run.draft?(run.draft.pointTarget??0)-run.choicesSpent:0,queued=deepPointCost(pending,run);
  const weapon=owner==='common'?undefined:run.weapons.find(w=>w.id===owner),stats=weapon?weaponStats(run,weapon):null;
  return `<div class="modal-backdrop tree-backdrop skill-modal-backdrop"><section class="tree-panel deep-panel" data-tree-id="${tree.id}" role="dialog" aria-modal="true" aria-labelledby="deep-title" style="--character:${color}">
    <header class="tree-header"><div><span class="eyebrow">Ⅱ 戰鬥暫停 · 技能配置</span><h2 id="deep-title">${remaining?'配置技能':'本局技能樹'} <small>${run.choicesSpent} / ${operationProfile(run).points} 點</small></h2></div>${remaining?`<span class="points-left" role="status"><span>已分配點數</span><strong><b>${queued}</b> / ${remaining}</strong></span>`:'<button class="icon-button" data-action="tree-close" aria-label="關閉技能樹">×</button>'}</header>
    <div class="tree-scroll">${battlefieldIntel(run)}
    <nav class="tree-characters deep-characters" aria-label="選擇隊員技能" style="--squad-size:${run.config.squadIds.length}">${run.config.squadIds.map(id=>`<button data-action="deep-owner" data-id="${id}" aria-pressed="${id===owner}" class="${id===owner?'active':''}">${portrait(id)}<span>${esc(CHARACTER_MAP[id].name)}</span><small>${deepPointCost((run.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n]?.ownerId===id),run)} 點${pending.some(n=>DEEP_NODE_MAP[n]?.ownerId===id)?`<em>+${deepPointCost(pending.filter(n=>DEEP_NODE_MAP[n]?.ownerId===id),run)}</em>`:''}</small></button>`).join('')}</nav>
    <nav class="tree-tabs" aria-label="${esc(name)}技能樹">${deepTreesFor(owner).map(t=>`<button data-action="deep-tab" data-id="${t.id}" aria-pressed="${t.id===tree.id}" class="${t.id===tree.id?'active':''}"><span>${esc(t.name)}</span><small>${t.nodes.filter(n=>deepHas(run,n.id)).length} / ${t.nodes.length}</small></button>`).join('')}</nav>
    <div class="tree-intro"><h3>${esc(name)} · ${esc(tree.name)}</h3><p>${esc(tree.purpose)}</p><span>全隊終極 ${run.evolvedCount}/${run.evolutionLimit} · ${remaining?`里程碑 ${run.draft!.choice}/${operationProfile(run).points/2} · 已選 ${queued}/${remaining}`:'隨時可查看'}</span>${stats?`<p class="weapon-readout">目前傷害 ${stats.damage.toFixed(1)} · 間隔 ${(stats.interval/30).toFixed(2)} 秒 · 射程 ${weaponRange(run,weapon!.id)}</p>`:''}</div>
    ${owner==='common'?`<div class="common-route-labels">${COMMON_ROUTE_NAMES.map(t=>`<b>${t}</b>`).join('')}</div>`:''}${deepGraph(tree,run,node?.id)}
    <p class="tree-path-note">${owner==='common'?'共用技能均為被動或自動觸發，不占終極名額。':'沿連線取得前置；交會節點擇一父節點即可。本樹先投入 4 點，再取得終極。'}</p>
    <div class="tree-owned"><b>已取得的技能</b><p>${(run.treeNodes??[]).filter(n=>DEEP_NODE_MAP[n]?.ownerId===owner).map(n=>esc(DEEP_NODE_MAP[n].name)).join(' · ')||'尚未投入，可從入口開始。'}</p></div>
    </div><footer class="node-preview" aria-live="polite"><div>${node?`<span class="eyebrow">${node.kind==='ultimate'?`ULTIMATE / 終極 · ${deepNodeCost(node.id,run)} 點`:node.kind==='entry'?'ENTRY / 入口':'MODULE / 模組'}</span><h3>${esc(node.name)}${node.kind==='ultimate'?` · ${deepNodeCost(node.id,run)} 點`:''}</h3><p>${esc(node.description)}</p><small>${esc(lock??(node.kind==='ultimate'?'取得後本角色其他終極鎖定，普通節點仍可購入。':'確認後立即生效，本局不能洗點。'))}</small>${node.parents.length?`<small class="node-prerequisites">前置：${node.parents.map(id=>esc(DEEP_NODE_MAP[id].name)).join(node.requires==='any'?' 或 ':'＋')}${node.kind==='ultimate'?'；本樹已投入 4 點':''}</small>`:''}`:`<h3>${remaining?'選擇本次強化':'檢視技能路線'}</h3><p>${remaining?'點選亮起的節點，可跨角色分配。':'點選節點，查看效果與解鎖條件。'}</p>`}</div>
    <button class="button primary" data-action="buy-node" ${remaining?(queued!==remaining&&!(queued>0&&!deepLegalNodes({...shadow,evolvedCount:run.evolvedCount+pending.filter(id=>DEEP_NODE_MAP[id].kind==='ultimate').length}).length)?'disabled':''): 'disabled'}>${remaining?`確認強化 · ${queued}/${remaining} →`:'查看模式 · 經驗升級時可取得'}</button>
    <div class="deep-footer-note"><small>${remaining?'本次點數用完後自動返回戰鬥。':'關閉後返回原本戰鬥狀態。'}</small><button class="text-button" data-action="tree-save-home">離開關卡 · 本局結束</button></div></footer>
  </section></div>`;
}
