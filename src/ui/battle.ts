import { CHARACTER_MAP, ROUTE_MAP, STAGE_MAP, ENEMY_MAP, COMMON_UPGRADES } from '../data/content';
import { getReadyEvolutions, getLegalNodeIds } from '../sim/engine';
import type { RunState } from '../sim/types';
import type { BattleSpeed, GameSave } from '../storage/repository';
import type { ViewModel } from './model';
import { esc, clock, num, cardInfo, cardPreview, portrait, weaponLabel } from './format';
import { settings } from './lobby';

export function battleShell(run: RunState, speed: BattleSpeed = 1, autoTactical = false) {
  const captain = CHARACTER_MAP[run.config.captainId];
  return `<main class="battle-layout"><aside class="battle-aside"><span class="eyebrow">LIVE OPERATION / ${run.config.stageId}</span><h1>${esc(STAGE_MAP[run.config.stageId].name)}</h1><p>守住防線。<br>讓每一份火力，都有意義。</p><div class="mission-objective"><span>MISSION</span><h2>08:00 內擊破首領</h2><p>首領於 06:00 降臨；擊破後清除殘敵。</p></div><div class="live-build" id="live-build"></div><div class="keyboard-hints"><kbd>SPACE</kbd> 隊長技能 <kbd>ESC</kbd> 暫停</div></aside><section class="battle-phone" aria-label="戰鬥畫面"><header class="battle-hud"><div class="wall-hud"><div><b>防線 <span id="wall-text"></span></b><span id="shield-text"></span></div><div class="hp-track"><i id="wall-bar"></i></div></div><div class="battle-header-controls"><button class="speed-button ${speed > 1 ? 'accelerated' : ''}" id="speed-button" data-action="speed" aria-label="戰鬥速度 ${speed} 倍，點擊切換至 ${speed === 3 ? 1 : speed + 1} 倍" title="切換戰鬥速度：1× → 2× → 3×">${speed}×</button><button class="icon-button" data-action="pause" aria-label="暫停戰鬥">Ⅱ</button></div><div class="time-hud"><span id="wave-text"></span><strong id="time-text"></strong><span id="evolution-text"></span></div><div class="xp-track"><i id="xp-bar"></i></div><div class="xp-caption"><span>共鳴經驗</span><span id="xp-text"></span></div></header><div id="battle-canvas" class="battle-canvas" role="img" aria-label="敵人從上方進攻，五人小隊在底部自動防守"></div><div id="weapon-strip" class="weapon-strip"></div><div class="tactical-control"><button class="tactical-button" data-action="cast" id="tactical-button"><span class="tactical-icon">✦</span><span><small>隊長 · ${esc(captain.name)}</small><b>${esc(captain.tacticalName)}</b></span><strong id="tactical-status">就緒</strong></button><button class="auto-tactical-button" id="auto-tactical-button" data-action="auto-tactical" aria-label="自動施放隊長技能" aria-pressed="${autoTactical}" ${run.config.challengeId === 'no-skill' ? 'disabled' : ''}><span>自動施放</span><b id="auto-tactical-status">${autoTactical ? '已開啟' : '已關閉'}</b></button></div></section><aside class="battle-right"><span class="eyebrow">FIELD COMMANDER</span><div class="battle-captain">${portrait(captain.id)}<div><strong>${esc(captain.name)}</strong><span>${esc(captain.english)}</span></div></div><p>${esc(captain.tacticalDescription)}</p><div class="tactical-note"><span>TACTICAL NOTE</span><p id="threat-note">攻擊自動進行。預留技能，回應敵人的蓄力。</p></div><p class="battle-autosave">本機自動保存<br><small>切換到背景時會暫停。</small></p></aside></main><div id="battle-overlay"></div>`;
}
export function buildMarkup(run: RunState) {
  return `<h2>本局構築 <span>${run.choicesSpent} / 18</span></h2>${run.weapons.map(w => `<div class="build-line"><span style="background:${CHARACTER_MAP[w.id].color}"></span><b>${esc(CHARACTER_MAP[w.id].name)}</b><small>${esc(weaponLabel(run, w.id))}</small></div>`).join('')}${COMMON_UPGRADES.filter(c => run.commonRanks[c.id]).map(c => `<p class="common-build">${esc(c.name)} × ${run.commonRanks[c.id]}</p>`).join('')}`;
}
interface HudCache {
  run: RunState | null; key: string; buildKey: string; stripKey: string;
  values: Map<string, string>; nodes: Map<string, HTMLElement | null>;
}
const hudCaches = new WeakMap<HTMLElement, HudCache>();
export function updateHud(run: RunState, speed: BattleSpeed = 1, autoTactical = false) {
  const root = document.getElementById('wall-text'); if (!root) return;
  let cache = hudCaches.get(root);
  if (!cache) { cache = { run: null, key: '', buildKey: '', stripKey: '', values: new Map(), nodes: new Map() }; hudCaches.set(root, cache); }
  const shield = Math.ceil(run.shields.reduce((sum, entry) => sum + entry.value, 0));
  const weaponKey = run.weapons.map(w => `${w.id}:${w.branch}:${w.rank}`).join(',');
  const commonKey = COMMON_UPGRADES.map(c => run.commonRanks[c.id] ?? 0).join(',');
  const key = `${autoTactical}:${speed}:${run.tick}:${run.actionSeq}:${run.eventSeq}:${run.phase}:${run.wallHp}:${run.wallMaxHp}:${shield}:${run.xp}:${run.choicesSpent}:${run.evolvedCount}:${run.evolutionLimit}:${run.tacticalReadyAt}:${run.enemies.length}:${run.bossKilled}:${weaponKey}:${commonKey}`;
  if (cache.run === run && cache.key === key) return;
  cache.run = run; cache.key = key;
  const node = (id: string) => { if (!cache!.nodes.has(id)) cache!.nodes.set(id, document.getElementById(id)); return cache!.nodes.get(id); };
  const changed = (id: string, value: string) => { if (cache!.values.get(id) === value) return false; cache!.values.set(id, value); return true; };
  const set = (id: string, value: string) => { if (changed(id, value)) { const el = node(id); if (el) el.textContent = value; } };
  const width = (id: string, value: string) => { if (changed(`${id}:width`, value)) node(id)?.style.setProperty('width', value); };
  set('auto-tactical-status', run.config.challengeId === 'no-skill' ? '挑戰禁用' : autoTactical ? '已開啟' : '已關閉');
  if (changed('auto-tactical:state', String(autoTactical))) node('auto-tactical-button')?.setAttribute('aria-pressed', String(autoTactical));
  set('speed-button', `${speed}×`);
  if (changed('speed:state', String(speed))) {
    const button = node('speed-button');
    button?.setAttribute('aria-label', `戰鬥速度 ${speed} 倍，點擊切換至 ${speed === 3 ? 1 : speed + 1} 倍`);
    button?.classList.toggle('accelerated', speed > 1);
  }
  set('wall-text', `${Math.ceil(run.wallHp)} / ${run.wallMaxHp}`); set('shield-text', shield > 0 ? `◈ 護盾 ${shield}` : '');
  width('wall-bar', `${Math.max(0, run.wallHp / run.wallMaxHp * 100)}%`);
  const critical = run.wallHp / run.wallMaxHp < .3;
  if (changed('wall:critical', String(critical))) node('wall-bar')?.classList.toggle('critical', critical);
  set('wave-text', run.tick >= 360 * 30 ? '首領降臨' : `WAVE ${Math.min(8, Math.floor(run.tick / (45 * 30)) + 1)} / 8`);
  set('time-text', clock(480 * 30 - run.tick)); set('evolution-text', `進化 ${run.evolvedCount}/${run.evolutionLimit}`);
  width('xp-bar', `${run.choicesSpent >= 18 ? 100 : run.xp % 40 / 40 * 100}%`);
  set('xp-text', run.choicesSpent >= 18 ? '改造完成' : `${run.xp % 40} / 40 · ${run.choicesSpent}/18 次`);
  const cooldown = Math.max(0, Math.ceil((run.tacticalReadyAt - run.tick) / 30));
  const noTarget = run.enemies.length === 0 && run.config.captainId !== 'C06';
  const disabled = run.config.challengeId === 'no-skill';
  set('tactical-status', disabled ? '挑戰禁用' : cooldown ? `${cooldown}s` : noTarget ? '等待敵人' : '就緒');
  const buttonDisabled = disabled || cooldown > 0 || noTarget || run.phase !== 'running';
  if (changed('tactical:disabled', String(buttonDisabled))) { const button = node('tactical-button') as HTMLButtonElement | null; if (button) button.disabled = buttonDisabled; }
  const fill = `${Math.min(100, cooldown / CHARACTER_MAP[run.config.captainId].cooldown * 100)}%`;
  if (changed('tactical:fill', fill)) node('tactical-button')?.style.setProperty('--cooldown', fill);
  const charge = run.enemies.find(e => e.chargeKind && !e.chargeCancelled);
  const immunity = charge ? [charge.stunImmuneUntil > run.tick ? `免暈 ${Math.ceil((charge.stunImmuneUntil - run.tick) / 30)} 秒` : '', charge.moveImmuneUntil > run.tick ? `免位移 ${Math.ceil((charge.moveImmuneUntil - run.tick) / 30)} 秒` : ''].filter(Boolean).join('、') : '';
  set('threat-note', charge ? `⚠ ${ENEMY_MAP[charge.defId].name} 蓄力中。${immunity || '可使用有效暈眩或位移打斷'}。` : run.bossKilled ? '核心已摧毀，清除剩餘敵人即可完成行動。' : run.tick > 360 * 30 ? '觀察首領的蓄力與曝露窗口，分配技能。' : '攻擊自動進行。預留技能，回應敵人的蓄力。');
  const buildKey = `${weaponKey}:${commonKey}:${run.choicesSpent}`;
  if (cache.buildKey !== buildKey) { cache.buildKey = buildKey; const build = node('live-build'); if (build) build.innerHTML = buildMarkup(run); }
  if (cache.stripKey !== weaponKey) {
    cache.stripKey = weaponKey; const strip = node('weapon-strip');
    if (strip) strip.innerHTML = run.weapons.map(w => `<button data-action="view-build" aria-label="查看${esc(CHARACTER_MAP[w.id].name)}的構築"><span style="--character:${CHARACTER_MAP[w.id].color}">${portrait(w.id)}</span><b>${esc(CHARACTER_MAP[w.id].name)}</b><small>${w.branch ?? '—'} ${['基礎', 'I', 'II', 'E'][w.rank]}</small></button>`).join('');
  }
}

export function upgradeDialog(run: RunState, vm: ViewModel) {
  const offer = run.draft; if (!offer) return '';
  const focused = run.weapons.find(w => w.id === offer.focusId)!; const ready = getReadyEvolutions(run);
  const hasFocus = offer.choice % 3 === 1; const legal = getLegalNodeIds(run);
  return `<div class="modal-backdrop upgrade-backdrop"><section class="dialog upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><header class="dialog-header"><div><span class="eyebrow">ALIEN TECH REFINEMENT / ${run.choicesSpent + 1}</span><h2 id="upgrade-title">讓下一擊，截然不同。</h2></div><span class="pause-tag">Ⅱ 戰鬥已暫停</span></header><div class="upgrade-summary"><span>終極進化 <b>${run.evolvedCount} / ${run.evolutionLimit}</b></span><button class="text-button" data-action="view-build">${vm.showBuild ? '收合構築 −' : '查看構築 ＋'}</button></div>${vm.showBuild ? `<div class="inline-build">${buildMarkup(run)}</div>` : ''}
  ${hasFocus ? `<div class="focus-controls"><label for="focus-character">聚焦改造</label><select id="focus-character" data-change="focus-character">${run.config.squadIds.map(id => `<option value="${id}" ${id === offer.focusId ? 'selected' : ''} ${legal.some(node => node.startsWith(id)) ? '' : 'disabled'}>${esc(CHARACTER_MAP[id].name)}${legal.some(node => node.startsWith(id)) ? '' : '（已完成）'}</option>`).join('')}</select><label class="sr-only" for="focus-branch">偏好路線</label><select id="focus-branch" data-change="focus-branch" ${focused?.branch ? 'disabled' : ''}><option value="A" ${run.preferredBranches[offer.focusId] === 'A' ? 'selected' : ''}>A 路線</option><option value="B" ${run.preferredBranches[offer.focusId] === 'B' ? 'selected' : ''}>B 路線</option></select></div>` : ''}
  ${ready.length > 1 ? `<div class="evolution-controls"><label for="evolution-choice">切換已就緒進化</label><select id="evolution-choice" data-change="evolution-choice">${ready.map(id => `<option value="${id}" ${offer.selectedEvolution === id ? 'selected' : ''}>${esc(cardInfo(id).owner)} · ${esc(cardInfo(id).name)}</option>`).join('')}</select></div>` : ''}
  <div class="upgrade-cards">${offer.cards.map(card => { const info = cardInfo(card.nodeId); return `<button class="upgrade-card ${vm.selectedCard === card.nodeId ? 'selected' : ''} ${card.kind === 'evolution' ? 'evolution-card' : ''}" data-action="select-card" data-id="${card.nodeId}" aria-pressed="${vm.selectedCard === card.nodeId}"><span class="upgrade-art">${info.icon ? `<img src="${info.icon}" alt="">` : '<b>✦</b>'}<i>${esc(info.rank)}</i></span><span class="upgrade-copy"><span class="card-meta">${esc(info.owner)} ${card.kind === 'focus' ? '· 可指定改造' : card.kind === 'evolution' ? '· 前置已達成' : ''}</span><strong>${esc(info.name)} <small>${esc(info.rank)}</small></strong><span class="upgrade-effect">${esc(info.effect)}</span><span class="upgrade-before">${esc(cardPreview(run, card.nodeId))}</span>${info.route ? `<span class="upgrade-counter">適用 / ${info.route.tags.map(esc).join("、")}</span>` : ""}${info.route ? `<span class="upgrade-tradeoff">${info.rank === 'I' ? `選取後鎖定 ${info.route.branch} 路線。` : ''}${info.rank === 'E' ? '占用 1 個進化名額。' : ''}${esc(info.tradeoff)}</span>` : ''}</span><span class="selection-dot">${vm.selectedCard === card.nodeId ? '✓' : ''}</span></button>`; }).join('')}</div><footer class="upgrade-footer"><button class="button secondary" data-action="reroll" ${run.rerollsRemaining === 0 || !offer.cards.some(c => c.kind === 'random') ? 'disabled' : ''}>↻ 重抽 ${run.rerollsRemaining}/3</button><button class="button primary" data-action="confirm-card" ${!vm.selectedCard ? 'disabled' : ''}>套用改造 →</button></footer><p class="quiet-note">先選擇卡片，再確認。聚焦與進化保底不受重抽影響。</p></section></div>`;
}
export function pauseDialog(run: RunState, save: GameSave, vm: ViewModel) {
  return `<div class="modal-backdrop"><section class="dialog pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">TAKE A BREATH</span><h2 id="pause-title">${run.pauseReasons.includes('orientation') ? '請將手機轉回直向' : run.pauseReasons.includes('error') ? '紀錄需要妳的注意' : '防線，等妳回來。'}</h2><p>${esc(STAGE_MAP[run.config.stageId].name)} · ${clock(run.tick)} · 防線 ${num(run.wallHp)}</p>${run.pauseReasons.includes('error') ? '<p>本局已安全暫停。請先重試儲存或讀取最新紀錄，再繼續行動。</p><button class="button secondary" data-action="save-retry">重試儲存</button><button class="button secondary" data-action="reload">讀取最新紀錄</button>' : ''}<button class="button primary" data-action="resume" ${run.pauseReasons.includes('orientation') || run.pauseReasons.includes('error') ? 'disabled' : ''}>繼續行動 →</button><button class="button secondary" data-action="view-build">${vm.showBuild ? '收合目前構築' : '查看目前構築'}</button>${vm.showBuild ? `<div class="inline-build">${buildMarkup(run)}</div>` : ''}${settings(save, vm.saveStatus, true)}<button class="button secondary" data-action="save-home">儲存並返回作戰中心</button><button class="text-button danger-text" data-action="abandon-confirm">放棄本次行動</button></section></div>`;
}
export function tutorialDialog() {
  return `<div class="modal-backdrop"><section class="dialog tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><span class="eyebrow">FIRST DEPLOYMENT</span><h2 id="tutorial-title">指揮官，準備好了嗎？</h2><ol class="tutorial-steps"><li><b>01</b><span><strong>守住共同防線</strong>小隊自動索敵射擊。防線歸零，行動失敗。</span></li><li><b>02</b><span><strong>把火力，改造成妳的答案</strong>共鳴經驗達標後三選一；每人 I → II → E，全隊最多三把 E。</span></li><li><b>03</b><span><strong>在關鍵時刻下令</strong>點擊底部隊長技能。敵人蓄力時，控場能打斷攻擊。</span></li><li><b>04</b><span><strong>換個搭配，立即重試</strong>不用農資源。失敗可保留相同戰局，重新分配火力。</span></li></ol><button class="button primary" data-action="tutorial-done">明白，開始防守 →</button><button class="text-button" data-action="tutorial-done">跳過引導</button></section></div>`;
}
export function result(run: RunState) {
  const won = run.outcome === 'victory'; const totalDamage = Object.values(run.stats.damageByCharacter).reduce((a, b) => a + b, 0);
  const wallSources = Object.entries(run.stats.wallDamageByEnemy).sort((a, b) => b[1] - a[1]); const wallTotal = wallSources.reduce((s, [, d]) => s + d, 0);
  const mainThreat = wallSources[0]; const knownThreat = mainThreat ? ENEMY_MAP[mainThreat[0] as keyof typeof ENEMY_MAP] : null;
  const next = run.config.stageId === 'S01' ? 'S02' : run.config.stageId === 'S02' ? 'S03' : null;
  return `<main class="content-screen result-screen"><section class="result-hero ${won ? 'victory' : 'defeat'}"><span class="eyebrow">${won ? 'OPERATION COMPLETE' : 'REGROUP & RETURN'}</span><h1>${won ? '黎明，向前一步。' : run.outcome === 'abandoned' ? '撤退，也是下一步的開始。' : '這次的答案，還能更好。'}</h1><p>${esc(STAGE_MAP[run.config.stageId].name)} · ${won ? '防線奪回成功' : run.outcome === 'timeout' ? '行動時間已到' : run.outcome === 'abandoned' ? '行動已放棄' : '防線失守'}</p><div class="result-numbers"><div><strong>${clock(run.tick)}</strong><span>有效戰鬥時間</span></div><div><strong>${num(run.wallHp)}</strong><span>防線剩餘 / ${run.wallMaxHp}</span></div><div><strong>${run.evolvedCount}</strong><span>完成終極進化</span></div></div></section>
  ${knownThreat ? `<div class="result-insight"><span>TACTICAL INSIGHT</span><p><b>${esc(knownThreat.name)}</b> 造成 ${Math.round(mainThreat[1] / wallTotal * 100)}% 防線傷害。${esc(knownThreat.counter)}。</p></div>` : `<div class="result-insight"><span>TACTICAL INSIGHT</span><p>${won ? '防線未受到直接傷害。試試另一條路線，或挑戰更精簡的編隊。' : '可以立即調整編隊與改造路線，再次出擊。'}</p></div>`}
  <div class="result-columns"><section><h2 class="section-heading">每一位，都留下了火力</h2><div class="damage-chart">${run.config.squadIds.map(id => `<div class="damage-row">${portrait(id)}<div><div><b>${esc(CHARACTER_MAP[id].name)}</b><span>${num(run.stats.damageByCharacter[id])}</span></div><div class="damage-track"><i style="width:${totalDamage ? run.stats.damageByCharacter[id] / totalDamage * 100 : 0}%;background:${CHARACTER_MAP[id].color}"></i></div><small>${esc(weaponLabel(run, id))} · 對盾 ${num(run.stats.shieldDamageByCharacter[id])} · 控場 ${(run.stats.controlTicks[id] / 30).toFixed(1)} 敵人秒</small></div></div>`).join('')}</div><div class="result-support"><span>護盾吸收 <b>${num(run.stats.shieldAbsorbed)}</b></span><span>技能施放 <b>${run.stats.casts.length}</b></span><span>擊破敵人 <b>${run.stats.kills}</b></span></div></section><section><h2 class="section-heading">構築軌跡</h2><ol class="choice-history">${run.stats.choices.map(c => `<li><time>${clock(c.tick)}</time><span>${esc(cardInfo(c.nodeId).owner)} · ${esc(cardInfo(c.nodeId).name)} ${esc(cardInfo(c.nodeId).rank)}</span></li>`).join('')}</ol>${!run.stats.choices.length ? '<p>本次尚未取得改造。</p>' : ''}</section></div><div class="result-actions"><button class="button primary" data-action="retry">相同戰局 · 再次挑戰 →</button><button class="button secondary" data-action="adjust">調整編隊</button><button class="button secondary" data-action="new-run">新戰局</button>${won && next ? `<button class="button secondary" data-action="next-stage" data-id="${next}">前往下一關 →</button>` : ''}<button class="text-button" data-action="home">返回作戰中心</button></div><details class="run-details"><summary>行動詳細資訊</summary><p>種子 ${run.config.seed} · 內容 ${esc(run.contentVersion)} · ${esc(run.runId)}</p><p>隊長 ${esc(CHARACTER_MAP[run.config.captainId].name)} · 挑戰 ${run.config.challengeId ?? '標準'}</p></details></main>`;
}
