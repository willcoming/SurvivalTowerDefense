import { CURRENT_BALANCE_VERSION } from '../data/assault-balance';
import { isHundred, runName } from '../data/hundred';
import { operationProfile, stageProfile } from '../data/progression';
import { CHARACTER_MAP, ENEMY_MAP, ENEMY_CODE, STAGE_MAP } from '../data/content';
import { stageArt } from '../data/campaign';
import { nextIntel, VARIANT_INFO, EVENT_INFO } from '../sim/operations';
import { weaponStats } from '../sim/weapons';
import { WEAKNESSES } from '../data/forms';
import { weaponRange, RANGE_LABEL } from '../sim/range';
import { elementBadge } from './collection';
import { esc, clock, portrait } from './format';
import { commandButtons } from './game-shell';
import { assetUrl } from '../assets';
import type { GameSave } from '../storage/repository';
import type { ViewModel } from './model';
import { operationObjectives, challengeChoices } from './operation-home';
import { recruitmentRules } from './recruitment';
import { difficultyName, rewardMode, rewardName, rewardAmount, selectedDifficulty } from '../storage/mission-rewards';

export type CommandPanel = 'shortcuts' | 'intel' | 'waves' | 'auto' | 'squad' | 'weapons' | 'enemies' | 'objectives' | 'reward' | 'recruit-rules' | 'challenges';
const titles: Record<CommandPanel, string> = { challenges:'挑戰作戰', shortcuts: '戰術指揮台', intel: '戰場情報', waves: '波次與敵情', auto: '自動戰鬥', squad: '編隊配置', weapons: '武器選擇', enemies: '敵人圖鑑', objectives: '作戰目標與獎勵', reward:'獎勵一覽', 'recruit-rules':'獎池機率與規則' };

export function commandPanel(save: GameSave, vm: ViewModel, selectedRange: string | null) {
  const kind = vm.commandPanel!;
  if(kind==='reward'&&vm.rewardPreview){
    const preview=vm.rewardPreview,difficulty=selectedDifficulty(save,vm.stageId);
    const mode=rewardMode(difficulty,vm.challengeId),amount=rewardAmount(mode,preview.tier);
    const left=Math.max(12,Math.min(innerWidth-244,preview.x-116)),top=Math.max(12,Math.min(innerHeight-216,preview.y+6));
    return `<div class="modal-backdrop reward-preview-backdrop"><section class="dialog reward-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="reward-preview-title" style="left:${left}px;top:${top}px"><header><h2 id="reward-preview-title">獎勵一覽</h2><button data-action="command-close" aria-label="關閉獎勵一覽">×</button></header><p class="reward-preview-condition">${mode==='challenge'?'挑戰':difficultyName(difficulty)} · 耐久 ${[1,50,100][preview.tier-1]}%</p><div class="reward-preview-item"><span class="reward-ticket-icon ${mode==='easy'?'reward-points-icon':''}">${mode==='easy'?'<i aria-hidden="true">✦</i>':`<img src="${assetUrl('rewards/recruit-ticket-v2.webp')}" alt="招募券">`}<b>${amount}</b></span><strong>${rewardName(mode)}</strong></div></section></div>`;
  }
  const run = vm.page === 'battle' ? save.activeRun : null;
  const hundred=run?isHundred(run):vm.page==='hundred';
  const stage = STAGE_MAP[hundred?'S03':run?.config.stageId ?? vm.stageId];
  const name=hundred?'百波挑戰':run?runName(run):stage.name;
  const profile=run?operationProfile(run):hundred?operationProfile({config:{mode:'hundred',stageId:'S03',difficulty:'easy',squadIds:[],captainId:'C01',seed:0},balanceVersion:CURRENT_BALANCE_VERSION,operationVersion:3}):stageProfile(stage.id,vm.challengeId?'hard':selectedDifficulty(save,stage.id),{challengeId:vm.challengeId,balanceVersion:CURRENT_BALANCE_VERSION});
  const waveFlow=!run||!!run.waveFlow;
  const bossTiming=waveFlow?(hundred?'第 100 波':'完成常規波次後'):clock(profile.bossAt*30);
  const ids = run?.config.squadIds ?? save.preferences.squadIds;
  const boss = ENEMY_MAP[stage.bossId];
  const enemyContent = `    <p>${esc(name)} · 已知敵方情報</p><div class="command-enemies">${stage.enemyIds.map(id => { const e = ENEMY_MAP[id]; return `<article><img src="${assetUrl(`enemies/${id}.webp`)}" alt="${esc(e.name)}"><div><h3>${esc(e.name)}</h3>${elementBadge(WEAKNESSES[id], true)}<p>${esc(e.mechanic)}</p><p class="command-counter">${esc(e.counter)}</p></div></article>`; }).join('')}</div>`;
  const content = kind === 'challenges' ? challengeChoices(save,vm) : kind === 'recruit-rules' ? recruitmentRules() : kind === 'objectives' ? hundred?'<h3>百波挑戰</h3><p>完成 100 波並清除首領；最高完成波數、擊殺數與防線耐久自動記錄於本機。此模式不發放主線首通獎勵。</p>':operationObjectives(save, stage.id) : kind === 'shortcuts' ? `<div class="command-menu-grid">${commandButtons(!!run, vm.page === 'home' ? 'left' : undefined)}</div>${vm.page === 'home' ? '<button class="button secondary" data-action="intel">作戰說明與挑戰設定 →</button>' : ''}` : kind === 'intel' ? `
    <div class="command-stage-art" style="background-image:url('${stageArt(stage.id)}')"><small>${stage.id} / 作戰區域</small><h3>${esc(name)}</h3></div>
    <p>${esc(hundred?'100 波攻勢，清場後統一配點、每 10 波增強。第 100 波擊破首領並清除殘敵，挑戰本機最高紀錄。':stage.description)}</p><div class="command-metrics"><span><small>敵群</small><b>${profile.waves.length} 波</b></span><span><small>首領</small><b>${bossTiming}</b></span><span><small>期限</small><b>${profile.unlimited?'不限時':clock(profile.deadline*30)}</b></span><span><small>常規敵人</small><b>${profile.enemies} 隻</b></span><span><small>技能預算</small><b>${profile.points} 點</b></span></div>
    <h3>優先目標 · ${esc(boss.name)}</h3><p>${esc(boss.mechanic)}</p><p class="command-counter">${esc(boss.counter)}</p>` : kind === 'waves' ? `
    <p>${run ? '接下來的敵群與戰場事件' : '預定波次與威脅組合；按敵情調整技能配置。'}</p><div class="wave-preview-list">${run ? nextIntel(run).map(row => `<article><span>${waveFlow?'清場後推進':clock(row.at)}</span><div><h3>第 ${row.wave} 波 · ${esc(row.name??'敵群推進')} · ${VARIANT_INFO[row.brief?.variant ?? 'standard'].name}</h3><p>${row.counts.map(([id, count]) => `${esc(ENEMY_MAP[id].name)} ×${count}`).join('、') || '本波已部署'}</p><small>${EVENT_INFO[row.brief?.event ?? 'none'].description}</small>${row.hint?`<p class="command-counter">${esc(row.hint)}</p>`:''}</div></article>`).join('') || '<p>所有常規波次已進場，準備迎戰首領。</p>' : profile.waves.map((wave, i) => `<article><span>第 ${i+1} 波</span><div><h3>第 ${i + 1} 波 · ${esc(profile.waveNames?.[i]??'敵群推進')} · ${profile.waveXp[i]} 經驗</h3><p>${wave.split(' ').map(token => { return `${esc(ENEMY_MAP[ENEMY_CODE[token[0]]].name)} ×${token.slice(1)}`; }).join('、')}</p><small>${esc(profile.waveHints?.[i]??'')}</small></div></article>`).join('')}</div><h3>敵方情報與弱點</h3>${enemyContent}` : kind === 'auto' ? `
    <div class="command-emblem" aria-hidden="true">↻</div><h3>自動戰鬥</h3><p>武器自動攻擊。分支終極取得後先完成一次冷卻，並在有有效目標時自動施放；暫停時冷卻也會暫停。隊長加成從開場生效。</p>` : kind === 'squad' ? `
    <p>${run ? '本局已部署的小隊。編隊與裝備在出擊前決定。' : '檢查隊長與角色配置，再進入戰場。'}</p><div class="command-squad">${ids.map(id => `<article>${portrait(id)}<div><h3>${esc(CHARACTER_MAP[id].name)} ${(run?.config.captainId ?? save.preferences.captainId) === id ? '<small>★ 隊長</small>' : ''}</h3><p>${esc(CHARACTER_MAP[id].role)}</p><small>${esc(CHARACTER_MAP[id].weaponName)}</small></div></article>`).join('')}</div><button class="button secondary" data-action="${run ? 'roster' : 'command-edit-squad'}">${run ? '返回基地調整編隊' : '編輯小隊配置 →'}</button>` : kind === 'weapons' ? `
    <p>${run ? '選擇角色，返回戰場查看武器射程。' : '已裝備的角色武器；射程可在戰鬥中查看。'}</p><div class="command-weapons">${ids.map(id => { const w = run?.weapons.find(weapon => weapon.id === id); const stats = run && w ? weaponStats(run, w) : null; return `<button data-action="${run ? 'command-weapon' : 'command-character'}" data-id="${id}" aria-pressed="${selectedRange === id}">${portrait(id)}<span><strong>${esc(CHARACTER_MAP[id].weaponName)}</strong><small>${esc(CHARACTER_MAP[id].name)} · ${RANGE_LABEL[id]}</small><small>傷害 ${stats ? stats.damage.toFixed(1) : CHARACTER_MAP[id].damage} · ${stats ? (stats.interval / 30).toFixed(2) : CHARACTER_MAP[id].interval} 秒${run ? ` · 射程 ${weaponRange(run, id)}` : ''}</small></span><b aria-hidden="true">⌖</b></button>`; }).join('')}</div>` : `
${enemyContent}`;
  return `<div class="modal-backdrop command-backdrop"><section class="dialog command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-title"><header class="command-dialog-header"><div><small>${run ? 'Ⅱ 戰鬥暫停' : 'STARFALL / 指揮系統'}</small><h2 id="command-title">${titles[kind]}</h2></div><button class="icon-button" data-action="command-close" aria-label="關閉指揮面板">×</button></header><div class="command-dialog-body">${content}</div><footer><button class="button secondary" data-action="command-close">${run ? '返回戰場' : '返回'} →</button></footer></section></div>`;
}
