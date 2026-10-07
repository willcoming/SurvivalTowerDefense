import { CAPTAIN_BONUSES } from '../data/reworked-skills';
import { BUILDS, CHARACTERS, CHARACTER_MAP } from '../data/content';
import { deepTreesFor } from '../data/deep-trees';
import { FORMS, FORM_MAP, formPortrait, originalForm, STARTER_FORMS } from '../data/forms';
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

export function roster(save: GameSave, vm: ViewModel, dirty = false, busy = false, temporary = false): string {
  const prefs = save.preferences;
  const max = vm.challengeId === 'four' ? 4 : 5;
  const selectedId = vm.rosterSelectedId ?? prefs.captainId;
  const character = CHARACTER_MAP[selectedId];
  const currentId = ownedForm(save.collection, selectedId);
  const chosen = prefs.squadIds.includes(selectedId);
  const captain = chosen && prefs.captainId === selectedId;
  const full = prefs.squadIds.length >= max;
  const tags = [...new Set(prefs.squadIds.flatMap(id => roleTags[id]))];
  return `<main class="content-screen roster-screen roster-command formation-workspace" aria-label="一頁式編隊">
    <header class="formation-heading"><div><span class="eyebrow">SQUAD / FORMATION</span><h1>小隊編成</h1></div><span class="formation-count"><b>${prefs.squadIds.length}</b> / ${max} 出戰</span></header>
    <div class="formation-content">
      <section class="formation-lineup" aria-label="目前出戰隊伍" style="--slot-count:${Math.max(max, prefs.squadIds.length)}">${Array.from({ length: Math.max(max, prefs.squadIds.length) }, (_, index) => {
        const id = prefs.squadIds[index];
        return id ? `<button data-action="roster-select" data-id="${id}" aria-label="查看出戰隊員${esc(CHARACTER_MAP[id].name)}" aria-pressed="${id === selectedId}" class="${id === prefs.captainId ? 'is-captain' : ''}">${portrait(id)}<span>${id === prefs.captainId ? '★ ' : ''}${esc(CHARACTER_MAP[id].name)}</span></button>` : `<span class="formation-vacancy"><b>＋</b><small>空位 ${index + 1}</small></span>`;
      }).join('')}</section>
      <div class="formation-catalog-heading"><h2>選擇隊員</h2><span>已招募 ${CHARACTERS.filter(c => isPlayable(save.collection, c.id)).length} / ${CHARACTERS.length}</span></div>
      <section class="formation-catalog" aria-label="全員總覽">${CHARACTERS.map(c => {
        const active = prefs.squadIds.includes(c.id);
        return `<button id="roster-card-${c.id}" class="formation-member ${active ? 'in-squad' : ''} ${!isPlayable(save.collection, c.id) ? 'unrecruited' : ''}" data-action="roster-select" data-id="${c.id}" aria-label="查看${esc(c.name)}，${statusLabel(save, c.id)}" aria-pressed="${c.id === selectedId}" style="--character:${c.color}"><span class="formation-member-art">${portrait(c.id)}<small>${active ? prefs.captainId === c.id ? '★ 隊長' : '✓ 出戰' : statusLabel(save, c.id)}</small></span><strong>${esc(c.name)}</strong><span>${roleTags[c.id].join(' · ')}</span></button>`;
      }).join('')}</section>
      <section class="formation-inspector" aria-label="隊員配置" style="--character:${character.color}">
        <div class="formation-member-heading"><div><h2>${esc(character.name)}<span>${esc(character.role)}</span></h2><span>${esc(character.weaponName)} · ${esc(RANGE_LABEL[selectedId])}</span></div><button class="formation-detail-button" data-action="roster-open" data-id="${selectedId}">能力詳情 ↗</button></div>
        <div class="formation-controls"><button class="button ${chosen ? 'secondary' : 'primary'}" data-action="toggle-character" data-id="${selectedId}" ${busy || !currentId || !chosen && full ? 'disabled' : ''}>${chosen ? '移至待命' : currentId ? '加入出戰' : '尚未招募'}</button><button class="button secondary" data-action="captain" data-id="${selectedId}" aria-pressed="${captain}" ${busy || !chosen || captain ? 'disabled' : ''}>${captain ? '★ 目前隊長' : '設定隊長'}</button><label class="formation-outfit">造型<select id="formation-outfit" data-change="formation-form" data-id="${selectedId}" aria-label="${esc(character.name)}的造型" ${busy || !currentId || temporary || save.activeRun ? 'disabled' : ''}>${characterForms(selectedId).map(form => `<option value="${form.id}" ${form.id === (currentId ?? originalForm(selectedId)) ? 'selected' : ''} ${save.collection.owned.includes(form.id) ? '' : 'disabled'}>${esc(form.name)}${save.collection.owned.includes(form.id) ? '' : ' · 未取得'}</option>`).join('')}</select></label></div>
        ${!currentId ? '<p class="formation-hint">尚未招募此隊員，可在能力詳情查看造型與取得方式。</p>' : !chosen && full ? `<p class="formation-hint">出戰已滿 ${max} 人，先將一位隊員移至待命即可換人。</p>` : ''}
        <div class="formation-bonus"><span>隊長加成 · ${esc(CAPTAIN_BONUSES[selectedId].name)}</span><p>${esc(CAPTAIN_BONUSES[selectedId].description)}</p></div>
        ${currentId ? `<details class="formation-ability"><summary>造型效果 · ${esc(FORM_MAP[currentId].name)}</summary><p>${esc(formEffect(currentId))}</p></details>` : ''}
      </section>
      <details class="formation-extras"><summary>隊伍分工與推薦</summary><div class="formation-capabilities">${['清群', '對甲', '對盾', '控場', '支援'].map(tag => `<span class="${tags.includes(tag) ? 'present' : 'absent'}">${tags.includes(tag) ? '✓' : '—'} ${tag}</span>`).join('')}</div><div class="recommendations">${BUILDS.map(build => `<button data-action="build" data-id="${build.id}" ${build.squadIds.slice(0, max).every(id => isPlayable(save.collection, id)) ? '' : 'disabled'}>${esc(build.name)} ↗</button>`).join('')}</div></details>
    </div>
    <footer class="formation-footer"><span role="status">${busy ? '正在儲存…' : dirty ? '有未確認的變更' : temporary ? '暫時試玩 · 未儲存' : '編隊已儲存'}<small>${prefs.squadIds.length > max ? `此挑戰最多 ${max} 人` : prefs.squadIds.length ? '隊員、隊長與造型一起套用' : '至少選擇 1 位出戰隊員'}</small></span><button class="formation-reset" data-action="roster-reset" ${!dirty || busy ? 'disabled' : ''}>還原</button><button class="button primary" data-action="roster-commit" ${!dirty || busy || !prefs.squadIds.length || prefs.squadIds.length > max ? 'disabled' : ''}>確認編隊</button></footer>
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
      <div class="roster-character-links"><button class="button secondary" data-action="roster-wardrobe">${count > 1 ? '造型換裝' : '查看造型'} · ${count} / ${forms.length} ↗</button><button class="button secondary" data-action="personnel-skills" data-id="${character.id}" aria-haspopup="dialog">${deepTreesFor(character.id).reduce((total,tree)=>total+tree.nodes.length,0)} 節點技能樹 ↗</button></div>
      <div class="roster-ability"><h3>${esc(character.weaponName)}</h3><span>${esc(RANGE_LABEL[character.id])}</span><dl><dt>固有被動</dt><dd>${esc(character.passive)}</dd>${current?.theme === 'summer' ? `<dt>造型效果 · ${esc(current.name)}</dt><dd>${esc(current.passive)}</dd>` : ''}<dt>隊長加成 · ${esc(CAPTAIN_BONUSES[character.id].name)}</dt><dd>${esc(CAPTAIN_BONUSES[character.id].description)}<small>開場生效 · 不消耗技能點 · 換裝不改變隊長加成</small></dd></dl></div>
      <p class="roster-biography">${esc(character.description)}</p>
    `}</div>
    <footer class="roster-panel-footer">${wardrobe ? `<p class="roster-equip-reason" id="roster-equip-reason" aria-live="polite">${equipReason}</p><button id="roster-equip" class="button primary roster-equip-button" data-action="roster-equip" data-id="${previewId}" aria-describedby="roster-equip-reason" ${equipDisabled ? 'disabled' : ''}>${busy ? '儲存中…' : equipped ? '已選用' : '加入草稿'}</button>` : !editing ? '<button class="button primary" data-action="roster-edit">編隊與換裝</button>' : `<p class="roster-team-reason">${!current ? '尚未招募 · 可先查看造型與取得方式' : !chosen && save.preferences.squadIds.length >= max ? `出戰已滿 ${max} 人，請先將一位隊員移至待命。` : chosen ? `出戰 ${save.preferences.squadIds.length} / ${max} · ${captain ? '目前為隊長' : '可任命為隊長'}` : `出戰 ${save.preferences.squadIds.length} / ${max} · 有空位可加入`}</p><div class="roster-team-actions"><button class="button ${chosen ? 'secondary' : 'primary'}" data-action="toggle-character" data-id="${character.id}" aria-label="${chosen ? '移除' : '選擇'}${esc(character.name)}" ${addDisabled ? 'disabled' : ''}>${chosen ? '移至待命' : current ? '加入出戰' : '未招募'}</button><button class="button secondary captain-button ${captain ? 'selected' : ''}" data-action="captain" data-id="${character.id}" aria-pressed="${captain}" ${!chosen || busy || captain ? 'disabled' : ''}>${captain ? '目前隊長' : '設定隊長'}</button></div>`}</footer>
  </section></div>`;
}
