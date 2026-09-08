import {commanderProgress} from '../data/commander';
import {commanderState} from './commander';
import { operationProfile } from '../data/progression';
import { difficultyName } from '../storage/mission-rewards';
import { stageArt } from '../data/campaign';
import { missingForms } from '../storage/collection';
import type { GameSave } from '../storage/repository';
import type { Page } from './model';
import type { StageId } from '../sim/types';
import { esc, num, portrait } from './format';

export const destinationNames: Record<string, string> = {
  commander:'指揮官成長', home: '作戰', command:'戰術指揮台', intel: '作戰情報', roster: '編隊', recruitment: '招募', codex: '圖鑑', stories: '紀錄', settings: '設定',
};

export function gameHud(save: GameSave, status: string, page: Page) {
  const battle = page === 'battle';
  const run = battle ? save.activeRun : null;
  const captain = run?.config.captainId ?? save.preferences.captainId;
  return `<header class="masthead game-hud" aria-label="指揮官與資源">
    <button class="commander-profile" data-action="${battle ? 'battle-settings' : 'commander'}" aria-label="${battle?'編輯指揮官資料':'指揮官成長與共用技能'}">
      ${portrait(captain)}<span><small>${battle?`${difficultyName(run?.config.difficulty)} / 作戰中`:"STARFALL / 指揮官"}</small><strong>${esc(save.preferences.commanderName ?? '指揮官')}</strong></span>
      <b title="每升一級獲得 1 點共用技能點">Lv.${commanderProgress(commanderState(save)).level}</b>
    </button>
    <div class="hud-controls"><button class="icon-button" data-action="${battle ? 'battle-settings' : 'settings'}" aria-label="設定">⚙</button></div>
    ${page==='recruitment'?`<div class="hud-resources" aria-label="持有資源">
      <button data-action="recruitment" aria-label="招募券 ${save.collection.tickets}"><i aria-hidden="true">▱</i><span><small>招募券</small><b data-hud="tickets">${num(save.collection.tickets)}</b></span></button>
      <button data-action="recruitment" aria-label="共鳴點數 ${save.collection.points}"><i aria-hidden="true">✦</i><span><small>共鳴點數</small><b data-hud="points">${num(save.collection.points)}</b></span></button>
    </div>`:''}
    ${battle&&run?`<div class="hud-battle-progress"><span>技能已配置</span><b id="shell-skill-points">${run.choicesSpent} / ${operationProfile(run).points}</b></div>`:''}
    <span class="local-status sr-only" aria-live="polite"><i></i>${esc(status)}</span>
  </header>`;
}

export function gameNav(save: GameSave, page: Page) {
  const canRecruit = missingForms(save.collection).length > 0 && (save.collection.tickets > 0 || save.collection.points >= 100);
  const active = ['battle', 'intel', 'result', 'command'].includes(page) ? 'home' : page;
  return `<nav class="main-nav game-dock" aria-label="主選單">${[
    ['home', '⌖', '作戰中心'], ['roster', '◈', '小隊編成'], ['recruitment', '✦', '星際招募'],
  ].map(([id, icon, label]) => `<button data-action="${id}" aria-label="${label}" ${active === id ? 'aria-current="page" class="active"' : ''}><span class="game-nav-icon" aria-hidden="true">${icon}</span><span class="game-nav-label">${destinationNames[id]}</span>${id === 'recruitment' && canRecruit ? '<span class="nav-notification" aria-label="可招募或兌換"></span>' : ''}</button>`).join('')}</nav>`;
}

export const commandItems = [
  { id: 'intel', icon: '⌖', label: '戰場情報', side: 'left' },
  { id: 'waves', icon: '≋', label: '波次與敵情', side: 'left' },
  { id: 'auto', icon: '↻', label: '自動戰鬥', side: 'left' },
  { id: 'squad', icon: '◈', label: '編隊配置', side: 'left' },
  { id: 'skills', icon: '✦', label: '技能配置', side: 'right' },
  { id: 'weapons', icon: '⌁', label: '武器選擇', side: 'right' },
  { id: 'pause', icon: 'Ⅱ', label: '暫停／離開', side: 'right' },
] as const;
export function commandButtons(battle: boolean, side?: 'left' | 'right') {
  return commandItems.filter(item => !side || item.side === side).map(item => `<button data-action="command-panel" data-id="${item.id}" aria-label="${item.label}" aria-haspopup="dialog" ${item.id === 'pause' && !battle ? 'disabled' : ''}><span aria-hidden="true">${item.icon}</span><b>${item.label}</b></button>`).join('');
}
export function gameSurround(stageId: StageId, battle: boolean) {
  return `<div class="game-world" style="background-image:url('${stageArt(stageId)}')" aria-hidden="true"></div><div class="world-wordmark" aria-hidden="true"><span>STARFALL</span><strong>星骸防線</strong><small>DAWN COUNTERATTACK</small></div>${(['left', 'right'] as const).map(side => `<aside class="command-rail command-rail-${side}" aria-label="${side === 'left' ? '戰術' : '裝備'}快捷功能">${commandButtons(battle, side)}</aside>`).join('')}`;
}
