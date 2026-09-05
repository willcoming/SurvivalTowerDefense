import { CHARACTER_MAP, COMMON_UPGRADES } from '../data/content';
import { NODE_MAP, TREE_MAP, treesFor } from '../data/skill-trees';
import { hasNode, nodeLock, ultimateFor } from '../sim/skill-tree';
import { getLegalNodeIds } from '../sim/draft';
import { cardInfo, cardPreview, esc, portrait } from './format';
import type { RunState } from '../sim/types';
import type { ViewModel } from './model';

export function treePanel(run: RunState, vm: ViewModel) {
  const view=vm.treePanel! as NonNullable<ViewModel['treePanel']> & {ownerId: import('../sim/types').CharacterId};const character=CHARACTER_MAP[view.ownerId],tree=TREE_MAP[view.treeId]??treesFor(view.ownerId)[0];
  const preview=NODE_MAP[view.nodeId??''],lock=preview?nodeLock(run,preview.id):null;
  const ordinary=tree.nodes.filter(n=>n.kind!=='ultimate'&&hasNode(run,n.id)).length;
  const owned=(run.treeNodes??[]).filter(id=>NODE_MAP[id].ownerId===character.id);
  return `<div class="modal-backdrop tree-backdrop"><section class="tree-panel" role="dialog" aria-modal="true" aria-labelledby="tree-title" style="--character:${character.color}">
    <header class="tree-header"><div><span class="eyebrow">NEURAL TECH / Ⅱ 戰鬥已暫停</span><h2 id="tree-title">共鳴技能樹 <small>${run.choicesSpent} / 18</small></h2></div><button class="icon-button" data-action="tree-close" aria-label="關閉技能樹">×</button></header>
    <div class="tree-scroll"><nav class="tree-characters" aria-label="技能樹角色">${run.config.squadIds.map(id=>`<button data-action="tree-character" data-id="${id}" aria-pressed="${id===view.ownerId}" class="${id===view.ownerId?'active':''}">${portrait(id)}<span>${esc(CHARACTER_MAP[id].name)}</span><small>${(run.treeNodes??[]).filter(n=>NODE_MAP[n].ownerId===id).length} 節點</small></button>`).join('')}</nav>
    <nav class="tree-tabs" aria-label="${esc(character.name)}的技能樹">${treesFor(character.id).map(t=>`<button data-action="tree-tab" data-id="${t.id}" aria-pressed="${t.id===tree.id}" class="${t.id===tree.id?'active':''}"><span>${esc(t.name)}</span><small>${t.nodes.filter(n=>hasNode(run,n.id)).length} / 5</small></button>`).join('')}</nav>
    <div class="tree-intro"><h3>${esc(character.name)} · ${esc(tree.name)}</h3><p>${esc(tree.purpose)}</p><span>本樹普通節點 ${ordinary}/3 · 全隊終極 ${run.evolvedCount}/${run.evolutionLimit}</span></div>
    <div class="node-graph">${tree.nodes.map(n=>{
      const reason=nodeLock(run,n.id),owned=hasNode(run,n.id),state=owned?'owned':reason?'locked':'available';
      return `<button class="skill-node node-${n.kind} ${state} ${preview?.id===n.id?'inspecting':''}" data-action="tree-node" data-id="${n.id}" data-state="${state}" aria-pressed="${preview?.id===n.id}" aria-label="${esc(n.name)}，${owned?'已取得':reason??'可取得'}"><span class="node-symbol">${owned?'✓':reason?'◇':n.kind==='ultimate'?'✦':'＋'}</span><strong>${esc(n.name)}</strong><small>${owned?'已取得':reason??(n.kind==='entry'?'入口 · 1 次升級':n.kind==='ultimate'?'終極 · 1 次升級':'分支 · 1 次升級')}</small></button>`;
    }).join('')}</div>
    <p class="tree-path-note">先取得入口，再任選兩個分支，即可選終極。剩餘分支仍可補上。</p>
    <div class="tree-owned"><b>本角色已取得 · ${owned.length}</b><p>${owned.length?owned.map(n=>esc(NODE_MAP[n].name)).join(' · '):'尚未配點。每次升級可指定一個合法節點作為候選。'}</p>${ultimateFor(run,character.id)?'<small>本角色終極已定案，仍可投資其他樹的普通節點。</small>':''}</div>
    ${view.mode==='choose'?`<details class="tree-common"><summary>通用改造</summary><div>${getLegalNodeIds(run).filter(id=>id.startsWith('G')).map(id=>`<button data-action="tree-common" data-id="${id}"><strong>${esc(cardInfo(id).name)}</strong><span>${esc(cardInfo(id).effect)}</span></button>`).join('')||'<p>目前沒有可選通用改造。</p>'}</div></details>`:''}
    </div><footer class="node-preview" aria-live="polite"><div>${preview?`<span class="eyebrow">${preview.kind==='ultimate'?'ULTIMATE / 終極':preview.kind==='entry'?'ENTRY / 入口':'BRANCH / 分支'}</span><h3>${esc(preview.name)}</h3><p>${esc(preview.description)}</p><small>${esc(lock??(preview.kind==='ultimate'?'取得後本角色其他終極將鎖定，普通節點仍可取得。':'可跨樹混搭，取得後本局不洗點。'))}</small>`:'<h3>選擇節點，查看效果</h3><p>切換角色與技能樹不會消耗升級次數。</p>'}</div><button class="button primary" data-action="tree-candidate" ${view.mode!=='choose'||!preview||lock?'disabled':''}>${view.mode==='view'?'查看模式 · 升級時可取得':'設為自選候選 →'}</button><small class="tree-confirm-note">${view.mode==='choose'?'返回三張候選卡後，按「確認取得」才會消耗升級次數。':'關閉面板即可返回原本的戰鬥或暫停畫面。'}</small></footer>
    </section></div>`;
}
export function treeUpgradeDialog(run: RunState, vm: ViewModel) {
  const d=run.draft!;
  return `<div class="modal-backdrop upgrade-backdrop"><section class="dialog upgrade-dialog tree-upgrade" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><header class="dialog-header"><div><span class="eyebrow">NEURAL REFINEMENT / ${d.choice} OF 18</span><h2 id="upgrade-title">這一次，如何進化？</h2></div><span class="pause-tag">Ⅱ 戰鬥已暫停</span></header><div class="upgrade-summary"><span>全隊終極 <b>${run.evolvedCount}/${run.evolutionLimit}</b></span><button class="text-button" data-action="view-build">查看完整技能樹 ↗</button></div><p class="tree-offer-note">一格自選 · 兩格隨機 · 最後只取得一項</p><div class="upgrade-cards">${d.cards.map(c=>{const info=cardInfo(c.nodeId),node=NODE_MAP[c.nodeId];return `<button class="upgrade-card ${vm.selectedCard===c.nodeId?'selected':''} ${node?.kind==='ultimate'?'evolution-card':''}" data-action="${c.kind==='focus'?'tree-open':'select-card'}" data-id="${c.nodeId}" aria-pressed="${vm.selectedCard===c.nodeId}"><span class="upgrade-art">${info.icon?`<img src="${info.icon}" alt="">`:'<b>✦</b>'}<i>${esc(info.rank)}</i></span><span class="upgrade-copy"><span class="card-meta">${c.kind==='focus'?'自選候選 · 點擊查看／改選':'隨機候選'} · ${esc(info.owner)}</span><strong>${esc(info.name)}</strong><span class="upgrade-effect">${esc(info.effect)}</span><span class="upgrade-before">${esc(cardPreview(run,c.nodeId))}</span>${node?.kind==='ultimate'?'<span class="upgrade-tradeoff">取得後本角色其他終極鎖定，普通節點仍可取得。</span>':''}</span><span class="selection-dot">${vm.selectedCard===c.nodeId?'✓':''}</span></button>`;}).join('')}</div><footer class="upgrade-footer"><button class="button secondary" data-action="reroll" ${!run.rerollsRemaining||!d.cards.some(c=>c.kind==='random')?'disabled':''}>↻ 重抽 ${run.rerollsRemaining}/3</button><button class="button primary" data-action="confirm-card" ${!vm.selectedCard?'disabled':''}>確認取得 →</button></footer><p class="quiet-note">確認後本局不洗點。重抽只更換隨機候選，自選節點保留。</p></section></div>`;
}
