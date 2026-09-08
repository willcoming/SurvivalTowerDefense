import { assetUrl } from '../assets';
import { STAGES, STAGE_MAP } from '../data/content';
import { CHALLENGES, MAIN_IDS, chapterName, stageArt, stageUnlocked } from '../data/campaign';
import type { GameSave } from '../storage/repository';
import type { StageId } from '../sim/types';
import type { ViewModel } from './model';
import { claimedTier, difficultyName, rewardMode, rewardName, rewardAmount, hardUnlocked, challengesUnlocked, selectedDifficulty } from '../storage/mission-rewards';
import { esc, clock } from './format';

export const CHALLENGE_NAMES: Record<string, string> = {
  four: '四人小隊', 'no-skill': '禁用隊長技能', 'two-evolutions': '最多兩個終極',
};

export function challengeChoices(save:GameSave,vm:ViewModel) {
  if(!MAIN_IDS.includes(vm.stageId))return '';
  const unlocked=challengesUnlocked(save,vm.stageId),overCapacity=vm.challengeId==='four'&&save.preferences.squadIds.length>4;
  return `<section class="tactical-challenges" aria-labelledby="challenge-title"><h3 id="challenge-title">${vm.stageId} · ${esc(STAGE_MAP[vm.stageId].name)} · 困難模式</h3><p>${unlocked?'以困難模式為基準，再加入下列限制。耐久 1%／50%／100% 三格獎勵分別為 3／6／9 張招募券，每項挑戰分開計算，每格只領一次。':'通關本關困難模式後解鎖，各耐久門檻可領 3／6／9 張招募券。'}</p>
    <div class="tactical-challenge-grid" role="group" aria-label="選擇出擊規則"><button data-action="challenge" data-id="" aria-pressed="${!vm.challengeId}"><strong>困難標準行動</strong><small>不加額外限制</small></button>${CHALLENGES.map(id=>`<button data-action="challenge" data-id="${id}" aria-pressed="${vm.challengeId===id}" ${unlocked?'':'disabled'}><strong>${CHALLENGE_NAMES[id]}</strong><small>${!unlocked?'通關困難後解鎖':claimedTier(save.collection,vm.stageId,'hard',id)>=3?'✓ 三格獎勵已領':`已領 ${claimedTier(save.collection,vm.stageId,'hard',id)} / 3 格 · 3／6／9 張券`}</small></button>`).join('')}</div>
    ${overCapacity?'<p class="tactical-challenge-notice">目前編隊超過 4 人，請先調整編隊。</p><button class="button secondary" data-action="roster">調整編隊</button>':`<button class="button primary" data-action="start" ${save.preferences.squadIds.length?'':'disabled'}>${vm.challengeId?'開始挑戰':'開始標準行動'}</button>`}
  </section>`;
}

/** The later three-stage chapters intentionally share a location model. */
export function operationModel(id: StageId) {
  const location = id === 'S01' ? 'city' : id === 'S02' ? 'lab' : id === 'S03' ? 'impact'
    : id.startsWith('X') ? 'summer' : MAIN_IDS.indexOf(id) < 6 ? 'coast'
    : MAIN_IDS.indexOf(id) < 9 ? 'resonance' : 'hive';
  return assetUrl(`operations/${location}-v1.webp`);
}

export function operationHome(save: GameSave, vm: ViewModel) {
  const stage = STAGE_MAP[vm.stageId];
  const index = STAGES.findIndex(s => s.id === stage.id);
  const previous = STAGES[index - 1], next = STAGES[index + 1];
  const difficulty=selectedDifficulty(save,stage.id),hardAvailable=hardUnlocked(save,stage.id);
  const tier=claimedTier(save.collection,stage.id,difficulty,vm.challengeId);
  const capacity = vm.challengeId === 'four' ? 4 : 5;
  const overCapacity = save.preferences.squadIds.length > capacity;
  return `<main class="operation-select mission-lobby" style="--operation-backdrop:url('${stageArt(stage.id)}')" data-stage="${stage.id}">
    <header class="mission-heading">
      <div class="mission-title"><h1><small>${stage.id}</small> ${esc(stage.name)}</h1><button class="mission-intel" data-action="command" aria-label="作戰功能與說明">?</button></div>
    </header>
    <section class="mission-difficulty" aria-label="作戰難度">
      <div class="difficulty-options" role="group" aria-label="選擇難度">${(['easy','hard'] as const).map(d=>`<button data-action="difficulty" data-id="${d}" aria-pressed="${!vm.challengeId&&difficulty===d}" ${d==='hard'&&!hardAvailable?'disabled title="通關本關簡單模式後解鎖" aria-label="困難，通關本關簡單模式後解鎖"':''}>${d==='hard'&&!hardAvailable?'<svg aria-hidden="true" width="15" height="17" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="8" width="12" height="9" rx="2"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg> ':''}${difficultyName(d)}</button>`).join('')}<button data-action="command-panel" data-id="challenges" aria-pressed="${!!vm.challengeId}" aria-haspopup="dialog" ${challengesUnlocked(save,stage.id)?'':`disabled title="${MAIN_IDS.includes(stage.id)?'通關本關困難模式後解鎖':'支線沒有挑戰作戰'}" aria-label="挑戰，${MAIN_IDS.includes(stage.id)?'通關本關困難模式後解鎖':'支線沒有挑戰作戰'}"`}>${challengesUnlocked(save,stage.id)?'':'<svg aria-hidden="true" width="15" height="17" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="8" width="12" height="9" rx="2"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></svg>'}挑戰</button></div>
    </section>
    <section class="mission-theater" aria-label="${esc(stage.name)}戰場模型">
      <div class="mission-model"><img src="${operationModel(stage.id)}" alt="${esc(stage.name)}作戰區域模型" class="mission-diorama" fetchpriority="high" decoding="async"></div>
      <button class="stage-arrow stage-arrow-previous" data-action="stage" data-id="${previous?.id ?? stage.id}" aria-label="上一關" ${!previous || !stageUnlocked(previous.id, save.profile.cleared) ? 'disabled' : ''}>‹</button>
      <button class="stage-arrow stage-arrow-next" data-action="stage" data-id="${next?.id ?? stage.id}" aria-label="下一關" ${!next || !stageUnlocked(next.id, save.profile.cleared) ? 'disabled' : ''}>›</button>
    </section>
    <section class="mission-launch" aria-label="作戰獎勵與出擊">
      <div class="durability-rewards" role="group" aria-label="通關耐久獎勵">${[1,50,100].map((percent,i)=>{
        const claimed=tier>=i+1,mode=rewardMode(difficulty,vm.challengeId),amount=rewardAmount(mode,i+1);
        return `<button class="durability-reward ${claimed?'is-claimed':''}" data-action="preview-reward" data-id="${i+1}" aria-haspopup="dialog" aria-label="耐久 ${percent}%，${rewardName(mode)} ${amount} ${mode==='easy'?'點':'張'}"><span class="durability-case" aria-hidden="true"><img class="${claimed?'chest-open':'chest-closed'}" src="${assetUrl(claimed?'rewards/chest-open-v3.webp':'rewards/chest-closed-v2.webp')}" alt="" decoding="async"></span><strong>耐久 ${percent}%</strong></button>`;
      }).join('')}</div>
    <section class="operation-panel mission-deployment">
      <button class="button primary deploy-button mission-start" data-action="start" aria-label="開始作戰" ${!save.preferences.squadIds.length || overCapacity ? 'disabled' : ''}>${vm.challengeId ? `<small>${CHALLENGE_NAMES[vm.challengeId]}${overCapacity ? ' · 請先調整編隊' : ''}</small>` : ''}<span class="mission-start-label"><strong>START</strong><b>開始作戰</b></span></button>
    </section>
    </section>
  </main>`;
}

export function operationObjectives(save: GameSave, id: StageId) {
  const stage = STAGE_MAP[id], cleared = save.profile.cleared.includes(id), challengeReady=challengesUnlocked(save,id);
  const best = save.profile.best[id];
  return `<div class="mission-objective-heading"><span>${id} / ${esc(chapterName(id))}</span><h3>${esc(stage.name)}</h3><p>${esc(stage.description)}</p></div>
    <div class="mission-objective-reward"><div><strong>通關評價 · 作戰獎勵</strong><p>通關後，一級：防線耐久至少 1%；二級：至少 50%；三級：100%。簡單各格 25／25／50 共鳴點數；困難各格 1／2／3 張招募券；挑戰各格 3／6／9 張招募券。</p><p>每關每難度、每項挑戰的各耐久門檻只領取一次；一次達成多格，會一併發放尚未領過的獎勵。未通關不發獎勵。</p><p>通關本關簡單模式後，即可解鎖本關困難模式，不限通關耐久。困難：所有敵人生命 ×1.5、對防線傷害 ×1.25。</p></div></div>
    ${MAIN_IDS.includes(id) ? `<h3>挑戰作戰 <small>耐久獎勵 3／6／9 張券</small></h3><p>${challengeReady ? '選擇本次出擊規則。' : '先通關本關困難模式，即可解鎖以下挑戰。'}</p><div class="mission-challenge-options"><button data-action="challenge" data-id="">標準行動 <small>完整小隊與技能</small></button>${CHALLENGES.map(ch => `<button data-action="challenge" data-id="${ch}" ${challengeReady ? '' : 'disabled'}>${CHALLENGE_NAMES[ch]}<small>${`已領 ${claimedTier(save.collection,id,'hard',ch)} / 3 格獎勵`}</small></button>`).join('')}</div>` : '<p>海岸支線同樣提供兩種難度的評價獎勵與行動紀錄。</p>'}
    <div class="mission-record"><h3>戰地紀錄</h3><p>${cleared ? `已解鎖「${esc(stage.name)}」行動故事。${best ? `最佳完成時間 ${clock(best.time)}，該次防線 ${Math.ceil(best.hp)}。` : ''}` : '首次通關後，可在「紀錄」閱讀完整行動故事。'}</p>${cleared ? '<button class="button secondary" data-action="stories">閱讀行動紀錄 →</button>' : ''}</div>`;
}
