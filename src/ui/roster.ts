import { BUILDS, CHARACTERS, CHARACTER_MAP } from '../data/content';
import { deepTreesFor } from '../data/deep-trees';
import { ELEMENTS, FORMS, FORM_MAP, formPortrait, originalForm, STARTER_FORMS } from '../data/forms';
import { RANGE_LABEL } from '../sim/range';
import type { CharacterId, FormId } from '../sim/types';
import { isPlayable, ownedForm } from '../storage/collection';
import type { GameSave } from '../storage/repository';
import { elementBadge } from './collection';
import { esc, portrait, roleTags } from './format';
import type { ViewModel } from './model';

export interface RosterPanel {
  ownerId: CharacterId;
  view: 'character' | 'wardrobe';
  previewFormId: FormId;
}

const characterForms = (id: CharacterId) => FORMS.filter(form => form.ownerId === id);
const ownedCount = (save: GameSave, id: CharacterId) => characterForms(id).filter(form => save.collection.owned.includes(form.id)).length;
const statusLabel = (save: GameSave, id: CharacterId) => save.preferences.squadIds.includes(id) ? '已出戰' : isPlayable(save.collection, id) ? '待命' : '未招募';
const formImage = (id: FormId, className = '') => `<img class="${className}" src="${formPortrait(id)}" alt="${esc(CHARACTER_MAP[FORM_MAP[id].ownerId].name)}・${esc(FORM_MAP[id].name)}">`;
const formEffect = (id: FormId) => FORM_MAP[id].theme === 'original' ? CHARACTER_MAP[FORM_MAP[id].ownerId].passive : FORM_MAP[id].passive;

export function roster(save: GameSave, vm: ViewModel): string {
  if (!vm.rosterEditing) return squadOverview(save, vm);
  const prefs = save.preferences;
  const max = vm.challengeId === 'four' ? 4 : 5;
  const recruited = CHARACTERS.filter(character => isPlayable(save.collection, character.id)).length;
  const tags = [...new Set(prefs.squadIds.flatMap(id => roleTags[id]))];
  return `<main class="content-screen roster-screen roster-command">
    <div class="page-intro roster-heading"><div><span class="eyebrow">SQUAD FORMATION</span><h1>小隊編成</h1></div></div>
    <div class="roster-summary" aria-label="隊員與出戰人數"><span>已招募 <b>${recruited} / ${CHARACTERS.length}</b></span><span>出戰 <b>${prefs.squadIds.length} / ${max}</b></span></div>
    <section class="roster-lineup" aria-label="目前出戰隊伍"><div class="formation-slots">${Array.from({ length: max }, (_, index) => {
      const id = prefs.squadIds[index];
      return id ? `<button id="roster-slot-${id}" data-action="roster-open" data-id="${id}" class="filled-slot" aria-label="查看出戰隊員${esc(CHARACTER_MAP[id].name)}${prefs.captainId === id ? '，隊長' : ''}">${portrait(id)}<span>${prefs.captainId === id ? '★ ' : ''}${esc(CHARACTER_MAP[id].name)}</span></button>` : `<span class="empty-slot" aria-label="空出戰位置 ${index + 1}"><span>${String(index + 1).padStart(2, '0')}</span><small>空位</small></span>`;
    }).join('')}</div></section>
    <section class="roster-overview" aria-label="全員總覽">${CHARACTERS.map(character => {
      const count = ownedCount(save, character.id);
      const selected = prefs.squadIds.includes(character.id);
      const label = statusLabel(save, character.id);
      return `<button id="roster-card-${character.id}" class="roster-tile ${selected ? 'in-squad' : ''} ${count === 0 ? 'unrecruited' : ''} ${count > 1 ? 'can-change' : ''}" data-action="roster-open" data-id="${character.id}" style="--character:${character.color}" aria-label="查看${esc(character.name)}，${label}，已擁有 ${count} 套造型${count > 1 ? '，可換裝' : ''}"><span class="roster-tile-art">${portrait(character.id)}${prefs.captainId === character.id && selected ? '<span class="roster-captain-mark" aria-hidden="true">★</span>' : ''}${count > 1 ? '<span class="roster-change-mark">可換裝</span>' : ''}</span><strong>${esc(character.name)}</strong><span class="roster-tile-state">${label}</span><span class="roster-tile-forms">造型 ${count} / ${characterForms(character.id).length}</span></button>`;
    }).join('')}</section>
    <details class="roster-help"><summary>編隊說明與推薦</summary><div class="roster-help-copy"><p>點選隊員查看能力、調整出戰或換裝。選擇 1–${max} 人，並任命一位隊長；★ 為目前隊長。每人各有技能樹，戰鬥中可自由搭配。</p><p>造型數量代表已擁有／全部造型；擁有 2 套以上會顯示「可換裝」。造型先預覽，按下「裝備」才會套用。</p><div class="formation-capabilities"><b>目前能力覆蓋</b>${['清群', '對甲', '對盾', '控場', '支援'].map(tag => `<span class="${tags.includes(tag) ? 'present' : 'absent'}">${tags.includes(tag) ? '✓' : '—'} ${tag}</span>`).join('')}</div><div class="recommendations"><span>搭配靈感</span>${BUILDS.map(build => `<button data-action="build" data-id="${build.id}">${esc(build.name)} ↗</button>`).join('')}</div></div></details>
    <div class="action-bar sticky-action roster-deploy"><span><b>${prefs.squadIds.length} / ${max}</b> 位隊員<small>編輯草稿 · 確認後一起套用</small></span><button class="button primary" data-action="roster-commit" ${prefs.squadIds.length < 1 || prefs.squadIds.length > max ? 'disabled' : ''}>確認編隊</button></div>
  </main>`;
}

function squadOverview(save: GameSave, vm: ViewModel): string {
  const { squadIds, captainId } = save.preferences;
  const selected = squadIds.includes(vm.rosterSelectedId!) ? vm.rosterSelectedId! : captainId;
  const character = CHARACTER_MAP[selected];
  return `<main class="squad-lobby" aria-label="目前小隊總覽">
    <h1 class="sr-only">小隊編成</h1>
    <section class="squad-portraits" aria-label="目前出戰隊伍">${Array.from({length:5}, (_, index) => {
      const id = squadIds[index];
      return id ? `<button class="squad-strip ${id === selected ? 'selected' : ''} ${id === captainId ? 'is-captain' : ''}" data-action="roster-select" data-id="${id}" aria-label="查看${esc(CHARACTER_MAP[id].name)}${id === captainId ? '，隊長' : ''}" aria-pressed="${id === selected}">${portrait(id)}<span>${id === captainId ? '<small>隊長</small>' : ''}${esc(CHARACTER_MAP[id].name)}</span></button>` : '<div class="squad-strip empty"><span>空位</span></div>';
    }).join('')}</section>
    <div class="squad-status"><span>目前小隊 <b>${squadIds.length} / 5</b></span><span>隊長 <b>${esc(CHARACTER_MAP[captainId].name)}</b></span></div>
    <section class="squad-hero" aria-label="${esc(character.name)}角色展示">${portrait(selected, 'squad-hero-art')}<div class="squad-hero-copy"><h2>${esc(character.name)}</h2><span>${selected === captainId ? '隊長' : '出戰隊員'}</span><p>${esc(character.role)}</p><button class="button secondary" data-action="roster-open" data-id="${selected}">角色詳情 ↗</button></div></section>
    <div class="squad-edit-action"><button class="button primary" data-action="roster-edit">編 隊</button></div>
  </main>`;
}

export function rosterDialog(save: GameSave, panel: RosterPanel, busy: boolean, temporary: boolean, max = 5, message = '', editing = false): string {
  const character = CHARACTER_MAP[panel.ownerId];
  const forms = characterForms(character.id);
  const currentId = ownedForm(save.collection, character.id);
  const current = currentId ? FORM_MAP[currentId] : null;
  const previewId = forms.some(form => form.id === panel.previewFormId) ? panel.previewFormId : currentId ?? originalForm(character.id);
  const preview = FORM_MAP[previewId];
  const count = ownedCount(save, character.id);
  const chosen = save.preferences.squadIds.includes(character.id);
  const captain = save.preferences.captainId === character.id && chosen;
  const wardrobe = panel.view === 'wardrobe';
  const title = `${character.name}・${wardrobe ? '造型換裝' : '隊員詳情'}`;
  const owned = save.collection.owned.includes(previewId);
  const equipped = currentId === previewId;
  const equipReason = !editing ? '請先進入編隊，再調整造型。' : busy ? '正在儲存裝備…' : !owned ? '尚未取得，解鎖後即可裝備。' : temporary ? '暫時試玩無法儲存換裝，請先恢復本機存檔。' : save.activeRun ? '請先完成或放棄進行中的行動，再換裝。' : equipped ? '目前已裝備這套造型。' : '加入編隊草稿，確認編隊後一起套用。';
  const tacticalDescription = current ? character.tacticalDescription.replaceAll(ELEMENTS[character.damageType].name, ELEMENTS[current.damageType].name) : character.tacticalDescription;
  const equipDisabled = busy || !owned || temporary || !!save.activeRun || equipped || !editing;
  const addDisabled = busy || !current || !chosen && save.preferences.squadIds.length >= max;
  return `<div class="modal-backdrop roster-backdrop"><section class="dialog roster-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}" data-roster-view="${panel.view}" style="--character:${character.color}">
    <header class="roster-panel-header">${wardrobe ? '<button class="icon-button" data-action="roster-back" aria-label="返回隊員詳情">‹</button>' : ''}<div><span class="eyebrow">${wardrobe ? 'WARDROBE / PREVIEW' : `${character.id} / ${esc(character.english)}`}</span><h2>${esc(title)}</h2></div><button class="icon-button" data-action="roster-close" aria-label="關閉${wardrobe ? '造型換裝' : '隊員詳情'}">×</button></header>
    ${message ? `<div class="roster-panel-alert" role="alert">${esc(message)}<small>關閉面板後可重試儲存或讀取最新紀錄。</small></div>` : ''}
    <div class="roster-panel-body">${wardrobe ? `
      <div class="wardrobe-preview"><div class="wardrobe-preview-art">${formImage(previewId)}<span>${equipped ? '目前裝備' : owned ? '造型預覽' : '未取得 · 可預覽'}</span></div><div class="wardrobe-preview-copy"><span class="eyebrow">${preview.theme === 'summer' ? 'SUMMER COLLECTION' : 'ORIGINAL UNIFORM'}</span><h3>${esc(preview.name)}</h3>${elementBadge(preview.damageType)}<p>${esc(character.role)}</p><span class="wardrobe-owned">${owned ? '✓ 已擁有' : '▣ 尚未取得'}</span><small>已擁有 ${count} / ${forms.length} 套造型</small></div></div>
      <div class="wardrobe-choices" role="group" aria-label="選擇預覽造型">${forms.map(form => {
        const hasForm = save.collection.owned.includes(form.id);
        return `<button class="wardrobe-choice ${form.id === previewId ? 'previewing' : ''}" data-action="roster-preview" data-id="${form.id}" aria-pressed="${form.id === previewId}" ${busy ? 'disabled' : ''}>${formImage(form.id)}<span><strong>${esc(form.name)}</strong><small>${form.id === currentId ? '✓ 已裝備' : hasForm ? '已擁有' : '▣ 未取得'}</small></span></button>`;
      }).join('')}</div>
      <section class="wardrobe-comparison" aria-label="造型能力比較"><div class="wardrobe-effect"><span>目前裝備${current ? ` · ${esc(current.name)}` : ''}</span>${current ? `${elementBadge(current.damageType)}<p>${esc(formEffect(current.id))}</p>` : '<p>尚未招募，取得任一造型即可加入編隊。</p>'}</div><div class="wardrobe-effect preview-effect"><span>${equipped ? '目前能力' : '預覽能力'} · ${esc(preview.name)}</span>${elementBadge(preview.damageType)}<p>${esc(formEffect(previewId))}</p></div></section>
      ${!owned ? `<section class="wardrobe-acquisition"><h3>▣ 取得方式</h3><p>${STARTER_FORMS.includes(previewId) ? '初始隊員的原始形態會隨新進度解鎖。' : '星際招募可取得此造型，也可使用 100 共鳴點數指定兌換。完成全部 51 項獎勵目標可補齊全收集。'}</p><button class="button secondary" data-action="recruitment">前往星際招募 ↗</button></section>` : ''}
    ` : `
      <div class="roster-personnel"><div class="roster-personnel-art">${formImage(currentId ?? originalForm(character.id))}<span>${esc(character.english)}</span></div><div class="roster-personnel-copy"><span class="roster-personnel-state">${captain ? '★ 隊長 · ' : ''}${statusLabel(save, character.id)}</span><h3>${esc(character.name)}</h3><p>${esc(character.role)}</p><div class="roster-role-tags">${roleTags[character.id].map(tag => `<span>${esc(tag)}</span>`).join('')}</div>${current ? `${elementBadge(current.damageType)}<small>${esc(current.name)}</small>` : ''}<strong class="roster-outfit-count">造型 ${count} / ${forms.length}${count > 1 ? ' · 可換裝' : ''}</strong></div></div>
      <div class="roster-character-links"><button class="button secondary" data-action="roster-wardrobe">${count > 1 ? '造型換裝' : '查看造型'} · ${count} / ${forms.length} ↗</button><button class="button secondary" data-action="personnel-skills" data-id="${character.id}" aria-haspopup="dialog">${deepTreesFor(character.id).length} 條技能樹 ↗</button></div>
      <div class="roster-ability"><h3>${esc(character.weaponName)}</h3><span>${esc(RANGE_LABEL[character.id])}</span><dl><dt>固有被動</dt><dd>${esc(character.passive)}</dd>${current?.theme === 'summer' ? `<dt>造型效果 · ${esc(current.name)}</dt><dd>${esc(current.passive)}</dd>` : ''}<dt>隊長技能 · ${esc(character.tacticalName)}</dt><dd>${esc(tacticalDescription)}<small>冷卻 ${character.cooldown} 秒${current?.theme === 'summer' ? ' · 以上為基礎數值，實際效果套用造型調整。' : ''}</small></dd></dl></div>
      <p class="roster-biography">${esc(character.description)}</p>
    `}</div>
    <footer class="roster-panel-footer">${wardrobe ? `<p class="roster-equip-reason" id="roster-equip-reason" aria-live="polite">${equipReason}</p><button id="roster-equip" class="button primary roster-equip-button" data-action="roster-equip" data-id="${previewId}" aria-describedby="roster-equip-reason" ${equipDisabled ? 'disabled' : ''}>${busy ? '儲存中…' : equipped ? '已選用' : '加入草稿'}</button>` : !editing ? '<button class="button primary" data-action="roster-edit">編隊與換裝</button>' : `<p class="roster-team-reason">${!current ? '尚未招募 · 可先查看造型與取得方式' : !chosen && save.preferences.squadIds.length >= max ? `出戰已滿 ${max} 人，請先將一位隊員移至待命。` : chosen ? `出戰 ${save.preferences.squadIds.length} / ${max} · ${captain ? '目前為隊長' : '可任命為隊長'}` : `出戰 ${save.preferences.squadIds.length} / ${max} · 有空位可加入`}</p><div class="roster-team-actions"><button class="button ${chosen ? 'secondary' : 'primary'}" data-action="toggle-character" data-id="${character.id}" aria-label="${chosen ? '移除' : '選擇'}${esc(character.name)}" ${addDisabled ? 'disabled' : ''}>${chosen ? '移至待命' : current ? '加入出戰' : '未招募'}</button><button class="button secondary captain-button ${captain ? 'selected' : ''}" data-action="captain" data-id="${character.id}" aria-pressed="${captain}" ${!chosen || busy ? 'disabled' : ''}>${captain ? '★ 隊長' : '☆ 任命隊長'}</button></div>`}</footer>
  </section></div>`;
}
