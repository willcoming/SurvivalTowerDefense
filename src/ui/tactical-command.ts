import { stageProfile } from '../data/progression';
import { ENEMY_CODE, ENEMY_MAP, STAGE_MAP } from '../data/content';
import { stageArt } from '../data/campaign';
import { WEAKNESSES } from '../data/forms';
import { assetUrl } from '../assets';
import { selectedDifficulty, difficultyName } from '../storage/mission-rewards';
import type { GameSave } from '../storage/repository';
import type { ViewModel } from './model';
import { esc, clock } from './format';
import { elementBadge } from './collection';

export const TACTICAL_VIEWS = ['intel','waves','enemies'] as const;
export type TacticalView = typeof TACTICAL_VIEWS[number];
const labels:Record<TacticalView,string> = {intel:'情報',waves:'波次',enemies:'敵情'};

export function tacticalCommand(save:GameSave,vm:ViewModel) {
  const stage=STAGE_MAP[vm.stageId],view=vm.commandView??'intel';
  const boss=ENEMY_MAP[stage.bossId],profile=stageProfile(stage.id);
  const content=view==='intel'?`
    <div class="tactical-location" style="background-image:url('${stageArt(stage.id)}')"><span>${stage.id}</span><h2>${esc(stage.name)}</h2></div>
    <p class="tactical-description">${esc(stage.description)}</p>
    <dl class="tactical-facts"><div><dt>敵群波次</dt><dd>${profile.waves.length} 波</dd></div><div><dt>首領進場</dt><dd>${clock(profile.bossAt*30)}</dd></div><div><dt>作戰期限</dt><dd>${clock(profile.deadline*30)}</dd></div><div><dt>常規敵人</dt><dd>${profile.enemies} 隻</dd></div><div><dt>技能預算</dt><dd>${profile.points} 點</dd></div><div><dt>終極大招</dt><dd>每個 2 點</dd></div></dl><p class="tactical-caption">清除常規敵群可取得 ${profile.points*30} 經驗；每 60 經驗獲得 2 點。完整終極路線需 6 點，最多培養 ${Math.min(3,Math.floor(profile.points/6))} 名終極角色，其餘 ${profile.points-Math.min(3,Math.floor(profile.points/6))*6} 點可配置其他技能。共用技能由指揮官等級另計。首領護衛與召喚敵人另計，不提供經驗。</p>
    <section class="tactical-priority"><small>優先目標</small><h3>${esc(boss.name)}</h3><p>${esc(boss.mechanic)}</p><p class="tactical-counter">${esc(boss.counter)}</p></section>`
  :view==='waves'?`<p class="tactical-caption">基礎波次編成 · 出擊時另有變異與戰場事件</p><div class="tactical-wave-list">${profile.waves.map((wave,i)=>`<article><div class="tactical-wave-index"><strong>${String(i+1).padStart(2,'0')}</strong><time>${clock(i*profile.interval*30)}</time></div><div><h2>第 ${i+1} 波 · ${profile.waveXp[i]} 經驗</h2><div class="tactical-wave-units">${wave.split(' ').map(token=>`<span>${esc(ENEMY_MAP[ENEMY_CODE[token[0]]].name)} <b>×${token.slice(1)}</b></span>`).join('')}</div></div></article>`).join('')}</div>`
  :`<div class="tactical-enemy-list">${stage.enemyIds.map(id=>{const enemy=ENEMY_MAP[id];return `<article><header><img src="${assetUrl(`enemies/${id}.webp`)}" alt=""><div><small>${id===stage.bossId?'首領':'敵方單位'}</small><h2>${esc(enemy.name)}</h2></div>${elementBadge(WEAKNESSES[id],true)}</header><p>${esc(enemy.mechanic)}</p><p class="tactical-counter">${esc(enemy.counter)}</p></article>`;}).join('')}</div>`;
  return `<main class="tactical-command-screen" aria-labelledby="tactical-title">
    <header class="tactical-heading"><button class="icon-button" data-action="home" aria-label="返回作戰">‹</button><div><h1 id="tactical-title">戰術指揮台</h1><p>${stage.id} · ${esc(stage.name)} <span>${difficultyName(selectedDifficulty(save,stage.id))}</span></p></div></header>
    <div class="tactical-tabs" role="tablist" aria-label="戰術情報分類">${TACTICAL_VIEWS.map(id=>`<button role="tab" id="tactical-tab-${id}" data-action="tactical-tab" data-id="${id}" aria-controls="tactical-content" aria-selected="${id===view}" tabindex="${id===view?0:-1}">${labels[id]}</button>`).join('')}</div>
    <section id="tactical-content" class="tactical-content" role="tabpanel" aria-labelledby="tactical-tab-${view}" tabindex="0">${content}</section>
  </main>`;
}
