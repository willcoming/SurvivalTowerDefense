import { CHARACTERS, CHARACTER_MAP, STAGES, BUILDS } from '../data/content';
import { createRun, stepRun, command, restoreRun } from '../sim/engine';
import { GameRepository, createDefaultSave, completeRun, IncompatibleRunError, SaveConflictError, type GameSave } from '../storage/repository';
import type { Branch, CharacterId, ChallengeId, Command, RunConfig, RunState, StageId } from '../sim/types';
import type { Page, ViewModel } from './model';
import { header, home, intel, roster, codex, stories, settings } from './lobby';
import { battleShell, updateHud, upgradeDialog, pauseDialog, tutorialDialog, result } from './battle';
import { esc } from './format';
import { GameAudio } from '../game/audio';
import { createBattleCanvas } from '../game/scene';
import { keyInterfaceImage } from '../game/chroma';

export class GameApp {
  private root: HTMLElement;
  private save = createDefaultSave();
  private repository = new GameRepository();
  private audio = new GameAudio();
  private canvas: ReturnType<typeof createBattleCanvas> | null = null;
  private vm: ViewModel = { page: 'home', stageId: 'S01', characterId: 'C01', challengeId: null, retrySeed: null, selectedCard: null, modal: null, saveStatus: '正在讀取本機進度', message: '', showBuild: false };
  private lastFrame = performance.now(); private accumulator = 0; private lastAutosave = 0;
  private saveQueue: Promise<void> = Promise.resolve(); private renderedOverlay = ''; private endedId = '';
  private lastFocused: HTMLElement | null = null; private ready = false;
  private lastRun: RunState | null = null; private temporary = false; private preservedSave: GameSave | null = null;
  private saveBoundary = ''; private loadFailure = false;
  private sceneReady = false; private assetFailure = false;
  private overlayKey = '';
  constructor(root: HTMLElement) {
    this.root = root;
    this.root.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (button && !(button as HTMLButtonElement).disabled) { void this.audio.unlock(); void this.action(button.dataset.action!, button.dataset.id); } });
    this.root.addEventListener('change', event => { const input = event.target as HTMLInputElement | HTMLSelectElement; if (input.dataset.change) this.change(input); });
    document.addEventListener('keydown', event => this.key(event));
    document.addEventListener('visibilitychange', () => this.visibility());
    window.addEventListener('resize', () => this.orientation());
    window.addEventListener('pagehide', () => { if (this.ready) { this.pauseFor('hidden'); void this.persist(); } });
    requestAnimationFrame(time => this.frame(time));
  }
  async init() {
    this.root.innerHTML = '<div class="loading-screen"><span class="brand-star">✦</span><h1>星骸防線</h1><p>正在連接本機作戰紀錄…</p></div>';
    try {
      this.save = await this.repository.load();
      if (this.save.activeRun) this.save.activeRun = restoreRun(this.save.activeRun);
      this.audio.volumes(this.save.preferences.musicVolume, this.save.preferences.sfxVolume);
      const latest = STAGES.find(s => !this.save.profile.cleared.includes(s.id)); this.vm.stageId = latest?.id ?? 'S03';
      this.vm.saveStatus = '已儲存在本機'; this.ready = true;
      if (this.save.activeRun?.phase === 'ended') { this.lastRun = this.save.activeRun; this.endedId = this.lastRun.runId; completeRun(this.save, this.lastRun); this.vm.page = 'result'; await this.persist(); }
      if (this.save.activeRun && this.save.activeRun.phase !== 'ended') command(this.save.activeRun, { type: 'pause', reason: 'user' });
      this.render(); this.exposeTesting();
    } catch (error) { if (error instanceof IncompatibleRunError) this.preservedSave = error.preservedSave; this.loadFailure = true; this.vm.message = String(error); this.renderLoadError(); }
  }
  private renderLoadError() {
    this.root.innerHTML = `<main class="loading-screen"><span class="brand-star">!</span><h1>本機紀錄暫時無法讀取</h1><p>${esc(this.vm.message)}</p><div class="result-actions"><button class="button primary" data-action="reload">重新讀取</button>${this.preservedSave ? '<button class="button secondary" data-action="discard-old-run">保留進度，放棄舊版本戰局</button>' : ''}<button class="button secondary" data-action="temporary-play">暫時試玩（不儲存）</button><button class="button secondary" data-action="reset-confirm">重置本機紀錄</button></div><p>重置會清除進度；原有資料不會被默默覆寫。</p></main><div id="global-overlay"></div>`;
  }
  private render() {
    this.canvas?.destroy(true); this.canvas = null; this.renderedOverlay = ''; this.overlayKey = '';
    const page = this.vm.page; const run = this.save.activeRun ?? this.lastRun;
    if (page === 'battle' && run) {
      this.root.innerHTML = `${this.notice()}${battleShell(run, this.save.preferences.battleSpeed)}`;
      this.sceneReady = false;
      document.getElementById('battle-canvas')!.insertAdjacentHTML('beforeend', '<div id="battle-loading" class="battle-loading" role="status">正在載入戰場 · 0%</div>');
      this.canvas = createBattleCanvas(document.getElementById('battle-canvas')!, () => this.save.activeRun!, this.audio, () => this.save.preferences.reducedEffects, {
        ready: () => { this.sceneReady = true; this.assetFailure = false; this.lastFrame = performance.now(); this.accumulator = 0; document.getElementById('battle-loading')?.remove(); if (run.pauseReasons.includes('error')) void this.persist().then(() => { if (this.vm.saveStatus === '已儲存在本機') { command(run, { type: 'pause', reason: 'user' }); command(run, { type: 'resume', reason: 'error' }); this.overlay(); } }); },
        progress: ratio => { const el = document.getElementById('battle-loading'); if (el) el.textContent = `正在載入戰場 · ${Math.round(ratio * 100)}%`; },
        failed: paths => { this.assetFailure = true; this.vm.message = `有 ${paths.length} 個戰場素材未能載入。行動已暫停，請重新載入後繼續。`; command(run, { type: 'pause', reason: 'error' }); document.getElementById('battle-loading')?.remove(); this.root.insertAdjacentHTML('afterbegin', this.notice()); this.overlay(); void this.persist(); },
      });
      updateHud(run, this.save.preferences.battleSpeed); this.overlay(); this.audio.setMode(run.bossSpawned ? 'boss' : 'battle');
    } else {
      const screens = { home: () => home(this.save, this.vm), intel: () => intel(this.save, this.vm), roster: () => roster(this.save, this.vm), codex: () => codex(this.save, this.vm), stories: () => stories(this.save), settings: () => settings(this.save, this.vm.saveStatus), result: () => run ? result(run) : home(this.save, this.vm), battle: () => '' };
      this.root.innerHTML = `${header(page, this.vm.saveStatus)}${this.notice()}${screens[page]()}<footer class="site-footer"><span>星骸防線 / 黎明反攻</span><span>免登入 · 全角色開放 · ${this.temporary ? '暫時試玩，不儲存進度' : '進度保存在目前瀏覽器'}</span></footer><div id="global-overlay"></div>`;
      this.audio.setMode('lobby'); this.overlay();
    }
    this.root.classList.toggle('reduced-effects', this.save.preferences.reducedEffects);
    this.prepareImages(this.root);
  }
  private notice() { return this.vm.message ? `<div class="system-notice" role="alert"><span>${esc(this.vm.message)}</span>${this.temporary ? '' : this.assetFailure ? '<button data-action="reload">重新載入素材</button>' : '<button data-action="save-retry">重試儲存</button><button data-action="reload">讀取最新紀錄</button>'}<button data-action="dismiss-message" aria-label="關閉提示">×</button></div>` : ''; }
  private overlay() {
    const holder = document.getElementById(this.vm.page === 'battle' ? 'battle-overlay' : 'global-overlay'); if (!holder) return;
    const run = this.save.activeRun;
    const key = `${this.vm.page}:${this.vm.modal}:${this.vm.selectedCard}:${this.vm.showBuild}:${this.vm.saveStatus}:${run?.runId}:${run?.tick}:${run?.actionSeq}:${run?.draft?.id}:${run?.pauseReasons.join(',')}:${this.save.preferences.musicVolume}:${this.save.preferences.sfxVolume}:${this.save.preferences.reducedEffects}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    let html = '';
    if (this.vm.modal === 'reset' || this.vm.modal === 'abandon') {
      const reset = this.vm.modal === 'reset';
      html = `<div class="modal-backdrop"><section class="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><span class="eyebrow">${reset ? 'RESET LOCAL DATA' : 'ABANDON OPERATION'}</span><h2 id="confirm-title">${reset ? '重置這個瀏覽器的進度？' : '確定放棄本次行動？'}</h2><p>${reset ? '關卡紀錄、偏好設定與進行中的行動將被刪除。六位角色仍會全部開放。' : '本局改造將結束。妳可以立即重新出擊，不會失去任何戰力資源。'}</p><div class="result-actions"><button class="button secondary" data-action="cancel-confirm">保留紀錄</button><button class="button danger" data-action="${reset ? 'reset' : 'abandon'}">${reset ? '確認重置' : '確認放棄'}</button></div></section></div>`;
    } else if (this.vm.page === 'battle' && run) {
      if (run.pauseReasons.includes('tutorial')) html = tutorialDialog();
      else if (run.pauseReasons.some(r => r !== 'upgrade')) html = pauseDialog(run, this.save, this.vm);
      else if (run.draft) html = upgradeDialog(run, this.vm);
    }
    if (html === this.renderedOverlay) return;
    const focus = document.activeElement as HTMLElement | null; const focusId = focus?.id; const focusAction = focus?.dataset.action; const focusItem = focus?.dataset.id;
    const wasOpen = !!this.renderedOverlay; this.renderedOverlay = html; holder.innerHTML = html;
    const modal = holder.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
    this.prepareImages(holder);
    if (modal) {
      if (!wasOpen) this.lastFocused = focus;
      const replacement = focusId ? holder.querySelector<HTMLElement>(`#${focusId}`) : focusAction ? [...holder.querySelectorAll<HTMLElement>('[data-action]')].find(el => el.dataset.action === focusAction && el.dataset.id === focusItem) : null;
      (replacement ?? modal.querySelector<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled)'))?.focus({ preventScroll: true });
    } else if (wasOpen && this.lastFocused?.isConnected) this.lastFocused.focus({ preventScroll: true });
  }
  private prepareImages(root: HTMLElement) { root.querySelectorAll<HTMLImageElement>('img').forEach(img => { if (img.complete) keyInterfaceImage(img); else img.addEventListener('load', () => keyInterfaceImage(img), { once: true }); img.addEventListener('error', () => { img.classList.add('asset-error'); img.alt = `${img.alt || '圖片'}：素材載入失敗`; }, { once: true }); }); }
  private go(page: Page) { this.vm.page = page; this.vm.modal = null; this.vm.showBuild = false; this.render(); window.scrollTo(0, 0); const title = this.root.querySelector('h1'); if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); } }
  private seed() { const data = new Uint32Array(1); crypto.getRandomValues(data); return data[0] || 101; }
  private async start(config?: RunConfig) {
    if (this.save.activeRun && this.save.activeRun.phase !== 'ended' && !config) { this.vm.message = '已有進行中的行動，請先繼續或放棄。'; this.go('home'); return; }
    const prefs = this.save.preferences;
    const run = createRun(config ?? { stageId: this.vm.stageId, squadIds: [...prefs.squadIds], captainId: prefs.captainId, preferredBranches: { ...prefs.branches }, seed: this.vm.retrySeed ?? this.seed(), challengeId: this.vm.challengeId });
    this.save.activeRun = run; this.lastRun = null; this.vm.selectedCard = null; this.vm.retrySeed = null; this.endedId = ''; this.saveBoundary = '';
    if (!this.save.preferences.tutorialSeen) command(run, { type: 'pause', reason: 'tutorial' });
    this.audio.feedback('start'); this.go('battle'); this.orientation(); await this.persist();
  }
  private execute(cmd: Command) {
    const run = this.save.activeRun; if (!run) return false;
    const accepted = command(run, cmd);
    if (accepted) { if (cmd.type === 'choose') { this.vm.selectedCard = null; this.audio.feedback('choose'); } this.overlay(); updateHud(run, this.save.preferences.battleSpeed); void this.persist(); }
    return accepted;
  }
  private pauseFor(reason: 'hidden' | 'orientation') {
    if (this.vm.page !== 'battle' || !this.save.activeRun || this.save.activeRun.phase === 'ended') return;
    command(this.save.activeRun, { type: 'pause', reason }); this.overlay();
  }
  private orientation() {
    if (!this.ready || !this.save.activeRun || this.vm.page !== 'battle') return;
    const mobileLandscape = matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight;
    if (mobileLandscape) this.pauseFor('orientation');
    else if (this.save.activeRun.pauseReasons.includes('orientation')) { command(this.save.activeRun, { type: 'pause', reason: 'user' }); command(this.save.activeRun, { type: 'resume', reason: 'orientation' }); this.overlay(); }
  }
  private visibility() {
    this.audio.setActive(!document.hidden);
    if (document.hidden) { this.pauseFor('hidden'); void this.persist(); }
    else { this.lastFrame = performance.now(); this.accumulator = 0; this.overlay(); }
  }
  private frame(time: number) {
    requestAnimationFrame(t => this.frame(t));
    const rawElapsed = time - this.lastFrame; const elapsed = Math.max(0, rawElapsed); this.lastFrame = time;
    const run = this.save.activeRun;
    if (!this.ready || this.vm.page !== 'battle' || !run || !this.sceneReady) return;
    if (run.phase === 'running' && rawElapsed > 500 && !document.hidden) { command(run, { type: 'pause', reason: 'user' }); this.accumulator = 0; this.vm.message = '畫面曾短暫停頓，確認後繼續行動。'; const old = this.root.querySelector('.system-notice'); if (old) old.outerHTML = this.notice(); else this.root.insertAdjacentHTML('afterbegin', this.notice()); void this.persist(); }
    if (run.phase === 'running') {
      const speed = this.save.preferences.battleSpeed;
      // Keep fixed 30 Hz rule steps; scale wall-clock time, including catch-up capacity.
      const maxSteps = 5 * speed;
      this.accumulator = Math.min(maxSteps * 1000 / 30, this.accumulator + elapsed * speed);
      let steps = 0;
      while (this.accumulator >= 1000 / 30 && run.phase === 'running' && steps++ < maxSteps) { stepRun(run); this.accumulator -= 1000 / 30; }
    }
    else this.accumulator = 0;
    updateHud(run, this.save.preferences.battleSpeed); this.overlay();
    let discovered = false;
    for (const id of run.stats.encountered) if (!this.save.profile.seenEnemies.includes(id)) { this.save.profile.seenEnemies.push(id); discovered = true; }
    if (discovered) void this.persist();
    const boundary = `${Math.floor(run.tick / 1350)}:${run.draft?.id ?? '-'}:${run.bossSpawned}`;
    if (boundary !== this.saveBoundary) { this.saveBoundary = boundary; void this.persist(); }
    this.audio.setMode(run.bossSpawned ? 'boss' : 'battle');
    if (run.phase === 'ended') { void this.finish(); return; }
    if (time - this.lastAutosave >= 5000) { this.lastAutosave = time; void this.persist(); }
  }
  private async finish() {
    const run = this.save.activeRun; if (!run || this.endedId === run.runId) return;
    this.endedId = run.runId; this.lastRun = run; completeRun(this.save, run); this.audio.feedback(run.outcome === 'victory' ? 'win' : 'lose'); this.go('result'); await this.persist();
  }
  private persist() {
    if (!this.ready || this.temporary) return Promise.resolve();
    for (const id of this.save.activeRun?.stats.encountered ?? []) if (!this.save.profile.seenEnemies.includes(id)) this.save.profile.seenEnemies.push(id);
    const copy = structuredClone(this.save);
    this.saveQueue = this.saveQueue.catch(() => {}).then(async () => {
      try {
        const revision = await this.repository.save(copy); this.save.revision = revision;
        this.vm.saveStatus = '已儲存在本機'; this.updateSaveStatus();
      } catch (error) {
        this.vm.saveStatus = '尚未儲存'; this.vm.message = error instanceof SaveConflictError ? '另一個分頁已有較新的紀錄。本頁已暫停，請讀取最新紀錄後繼續。' : `儲存未完成：${error instanceof Error ? error.message : String(error)}。請保留此頁並重試。`;
        if (this.save.activeRun?.phase !== 'ended') { if (this.save.activeRun) command(this.save.activeRun, { type: 'pause', reason: 'error' }); }
        this.updateSaveStatus(); this.overlay();
        const old = this.root.querySelector('.system-notice'); if (old) old.outerHTML = this.notice(); else this.root.insertAdjacentHTML('afterbegin', this.notice());
      }
    }); return this.saveQueue;
  }
  private updateSaveStatus() { this.root.querySelectorAll('.local-status').forEach(el => { el.innerHTML = `<i></i>${esc(this.vm.saveStatus)}`; }); const status = this.root.querySelector('.save-information h2'); if (status) status.textContent = this.vm.saveStatus; }
  private async action(action: string, id?: string) {
    if (['home', 'intel', 'roster', 'codex', 'stories', 'settings'].includes(action)) {
      if (this.vm.page === 'battle') { this.execute({ type: 'pause', reason: 'user' }); return; }
      this.go(action as Page); return;
    }
    switch (action) {
      case 'stage': this.vm.stageId = id as StageId; this.vm.challengeId = null; this.vm.retrySeed = null; this.render(); break;
      case 'challenge': this.vm.challengeId = (id || null) as ChallengeId; this.render(); break;
      case 'character': this.vm.characterId = id as CharacterId; this.go('codex'); break;
      case 'toggle-character': {
        const cid = id as CharacterId; const prefs = this.save.preferences;
        if (prefs.squadIds.includes(cid)) prefs.squadIds = prefs.squadIds.filter(c => c !== cid);
        else if (prefs.squadIds.length < (this.vm.challengeId === 'four' ? 4 : 5)) prefs.squadIds.push(cid);
        if (!prefs.squadIds.includes(prefs.captainId) && prefs.squadIds[0]) prefs.captainId = prefs.squadIds[0];
        this.render(); void this.persist(); break;
      }
      case 'captain': if (this.save.preferences.squadIds.includes(id as CharacterId)) { this.save.preferences.captainId = id as CharacterId; this.render(); void this.persist(); } break;
      case 'build': { const build = BUILDS.find(b => b.id === id)!; this.save.preferences.squadIds = [...build.squadIds].slice(0, this.vm.challengeId === 'four' ? 4 : 5); this.save.preferences.captainId = this.save.preferences.squadIds.includes(build.captainId) ? build.captainId : this.save.preferences.squadIds[0]; build.routes.forEach(r => { this.save.preferences.branches[r.slice(0, 3) as CharacterId] = r.slice(-1) as Branch; }); this.render(); void this.persist(); break; }
      case 'start': await this.start(); break;
      case 'continue': if (this.save.activeRun) { this.go('battle'); this.orientation(); } break;
      case 'speed': {
        const run = this.save.activeRun;
        if (this.vm.page !== 'battle' || run?.phase !== 'running') break;
        const speed = this.save.preferences.battleSpeed;
        this.save.preferences.battleSpeed = speed === 3 ? 1 : speed === 2 ? 3 : 2;
        this.lastFrame = performance.now(); this.accumulator = 0;
        updateHud(run, this.save.preferences.battleSpeed); void this.persist(); break;
      }
      case 'cast': this.execute({ type: 'cast' }); break;
      case 'pause': this.execute({ type: 'pause', reason: 'user' }); break;
      case 'resume': if (this.save.activeRun && !this.save.activeRun.pauseReasons.includes('error') && !this.save.activeRun.pauseReasons.includes('orientation')) { for (const reason of ['user', 'hidden'] as const) command(this.save.activeRun, { type: 'resume', reason }); if (this.vm.message.startsWith('畫面曾短暫停頓')) { this.vm.message = ''; this.root.querySelector('.system-notice')?.remove(); } this.overlay(); void this.persist(); } break;
      case 'select-card': this.vm.selectedCard = id!; this.overlay(); break;
      case 'confirm-card': if (this.save.activeRun?.draft && this.vm.selectedCard) this.execute({ type: 'choose', offerId: this.save.activeRun.draft.id, nodeId: this.vm.selectedCard }); break;
      case 'reroll': if (this.save.activeRun?.draft) { if (this.execute({ type: 'reroll', offerId: this.save.activeRun.draft.id })) this.vm.selectedCard = null; this.overlay(); } break;
      case 'view-build': this.vm.showBuild = !this.vm.showBuild; if (!this.save.activeRun?.draft) this.execute({ type: 'pause', reason: 'user' }); this.overlay(); break;
      case 'tutorial-done': this.save.preferences.tutorialSeen = true; this.execute({ type: 'resume', reason: 'tutorial' }); break;
      case 'save-home': await this.persist(); this.go('home'); break;
      case 'abandon-confirm': this.vm.modal = 'abandon'; this.overlay(); break;
      case 'abandon': this.vm.modal = null; if (this.execute({ type: 'abandon' })) await this.finish(); break;
      case 'cancel-confirm': this.vm.modal = null; this.overlay(); break;
      case 'reset-confirm': this.vm.modal = 'reset'; this.overlay(); break;
      case 'reset': await this.reset(); break;
      case 'retry': if (this.lastRun) await this.start(structuredClone(this.lastRun.config)); break;
      case 'new-run': if (this.lastRun) await this.start({ ...structuredClone(this.lastRun.config), seed: this.seed() }); break;
      case 'adjust': if (this.lastRun) { this.vm.retrySeed = this.lastRun.config.seed; this.vm.stageId = this.lastRun.config.stageId; this.vm.challengeId = this.lastRun.config.challengeId ?? null; this.save.preferences.squadIds = [...this.lastRun.config.squadIds]; this.save.preferences.captainId = this.lastRun.config.captainId; } this.go('roster'); break;
      case 'next-stage': this.vm.stageId = id as StageId; this.vm.challengeId = null; this.vm.retrySeed = null; this.go('intel'); break;
      case 'save-retry': if (this.assetFailure) { location.reload(); break; } this.vm.message = ''; await this.persist(); if (this.vm.saveStatus === '已儲存在本機') { this.root.querySelector('.system-notice')?.remove(); if (this.save.activeRun?.pauseReasons.includes('error')) { command(this.save.activeRun, { type: 'pause', reason: 'user' }); command(this.save.activeRun, { type: 'resume', reason: 'error' }); this.overlay(); } } break;
      case 'dismiss-message': this.vm.message = ''; this.root.querySelector('.system-notice')?.remove(); break;
      case 'reload': location.reload(); break;
      case 'temporary-play': this.temporary = true; this.save = createDefaultSave(); this.ready = true; this.loadFailure = false; this.vm.message = '目前為暫時試玩，關閉或重新整理後進度不會保留。'; this.vm.saveStatus = '暫時試玩 · 未儲存'; this.go('home'); this.exposeTesting(); break;
      case 'discard-old-run': if (this.preservedSave) { this.save = this.preservedSave; this.save.activeRun = null; this.preservedSave = null; this.ready = true; this.loadFailure = false; this.vm.message = ''; await this.persist(); this.go('home'); this.exposeTesting(); } break;
    }
  }
  private change(input: HTMLInputElement | HTMLSelectElement) {
    const action = input.dataset.change; const run = this.save.activeRun;
    if (action === 'branch') this.save.preferences.branches[input.dataset.id as CharacterId] = input.value as Branch;
    if (action === 'music') this.save.preferences.musicVolume = Number(input.value);
    if (action === 'sfx') this.save.preferences.sfxVolume = Number(input.value);
    if (action === 'reduced') { this.save.preferences.reducedEffects = (input as HTMLInputElement).checked; this.root.classList.toggle('reduced-effects', this.save.preferences.reducedEffects); }
    if (action === 'focus-character') { this.vm.selectedCard = null; this.execute({ type: 'focus', characterId: input.value as CharacterId }); }
    if (action === 'focus-branch' && run?.draft) { this.vm.selectedCard = null; this.execute({ type: 'focus', characterId: run.draft.focusId, branch: input.value as Branch }); }
    if (action === 'evolution-choice') { this.vm.selectedCard = null; this.execute({ type: 'evolution', nodeId: input.value }); }
    this.audio.volumes(this.save.preferences.musicVolume, this.save.preferences.sfxVolume); void this.audio.unlock(); void this.persist();
  }
  private key(event: KeyboardEvent) {
    const dialog = this.root.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
    if (event.key === 'Tab' && dialog) {
      const nodes = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => el.offsetParent !== null);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.key === 'Escape') {
      if (this.vm.modal === 'reset' || this.vm.modal === 'abandon') { this.vm.modal = null; this.overlay(); return; }
      if (this.vm.page === 'battle' && !this.save.activeRun?.draft && !this.save.activeRun?.pauseReasons.includes('tutorial')) { event.preventDefault(); void this.action(this.save.activeRun?.phase === 'running' ? 'pause' : 'resume'); }
    }
    if (event.code === 'Space' && this.vm.page === 'battle' && !dialog && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); if (!event.repeat) void this.action('cast'); }
  }
  private async reset() {
    try { await this.saveQueue; await this.repository.reset(); this.save = createDefaultSave(); this.lastRun = null; this.temporary = false; this.ready = true; this.vm.message = ''; this.vm.saveStatus = '已儲存在本機'; this.vm.stageId = 'S01'; this.vm.challengeId = null; this.vm.retrySeed = null; this.go('home'); await this.persist(); }
    catch (error) { this.vm.message = `無法重置：${String(error)}`; if (this.ready) this.render(); else this.renderLoadError(); }
  }
  private exposeTesting() {
    if (!import.meta.env.DEV) return;
    Object.defineProperty(window, '__game', { configurable: true, value: {
      state: () => this.save.activeRun ?? this.lastRun,
      getSave: () => this.save,
      audio: () => this.audio.stats(),
      command: (cmd: Command) => this.execute(cmd),
      ticks: (count: number) => { if (this.save.activeRun) { stepRun(this.save.activeRun, count); this.lastFrame = performance.now(); this.overlay(); updateHud(this.save.activeRun, this.save.preferences.battleSpeed); if (this.save.activeRun.phase === 'ended') void this.finish(); } },
      start: (config: RunConfig) => this.start(config),
      save: () => this.persist(),
      route: (page: Page) => this.go(page),
    } });
  }
}
