import { CHARACTER_MAP } from '../data/content';
import { CHAPTERS, CHALLENGES, stageUnlocked } from '../data/campaign';
import { ELEMENTS, FORMS, FORM_MAP, POOL, formPortrait } from '../data/forms';
import { isPlayable, missingForms, ownedForm, REWARD_GOALS } from '../storage/collection';
import type { GameSave } from '../storage/repository';
import type { CharacterId, DamageType, StageId } from '../sim/types';
import { esc } from './format';

export function elementBadge(type:DamageType,weakness=false){const e=ELEMENTS[type];return `<span class="element-badge" style="--element:${e.color}">${e.icon} ${weakness?'弱點・':''}${e.name}${weakness?' ×1.5':''}</span>`;}
export function formControls(save:GameSave,id:CharacterId){
  const selected=ownedForm(save.collection,id),playable=isPlayable(save.collection,id);
  return `<div class="form-controls"><label for="form-${id}">出戰形態 ${playable?'':'・尚未招募'}</label><select id="form-${id}" data-change="form" ${save.activeRun?'disabled':''}>${!playable?'<option value="">取得任一形態即可出戰</option>':''}${FORMS.filter(f=>f.ownerId===id).map(f=>`<option value="${f.id}" ${selected===f.id?'selected':''} ${save.collection.owned.includes(f.id)?'':'disabled'}>${esc(f.name)}${save.collection.owned.includes(f.id)?'':'・未取得'}</option>`).join('')}</select>${selected?elementBadge(FORM_MAP[selected].damageType)+`<small>${esc(FORM_MAP[selected].passive)}</small>`:''}</div>`;
}
export function campaignSelector(save:GameSave,selected:StageId){return CHAPTERS.map((chapter,index)=>`<section class="chapter-group"><h3><span>${index===4?'EX':String(index+1).padStart(2,'0')}</span>${chapter.name}</h3><div class="stage-selector">${chapter.ids.map(id=>{
  const unlocked=stageUnlocked(id,save.profile.cleared),cleared=save.profile.cleared.includes(id),claimed=save.collection.claimed.includes(`stage:${id}`);
  return `<button data-action="stage" data-id="${id}" class="${selected===id?'selected':''}" ${unlocked?'':'disabled'}><span>${id}</span>${esc(stageNames[id])}<small>${!unlocked?'▣ 尚未解鎖':cleared?'✓ 已奪回':'可出擊'} · ${claimed?'首通獎勵已領':'首通 1 張券'}</small></button>`;
}).join('')}</div></section>`).join('');}
// Imported at module scope, outside rendering paths; no save or side effects here.
import { STAGE_MAP } from '../data/content';
const stageNames=Object.fromEntries(Object.values(STAGE_MAP).map(s=>[s.id,s.name]));
export function recruitment(save:GameSave,busy=false){
  const c=save.collection,missing=missingForms(c),disabled=busy||!!save.activeRun,receipt=c.lastReceipt,form=receipt?FORM_MAP[receipt.formId]:null;
  return `<main class="content-screen recruitment-screen"><div class="page-intro"><span class="eyebrow">PERMANENT COLLECTION / 01</span><h1>星際夏日</h1><p>八套夏日武裝，兩位全新夥伴。每個形態都是另一種搭配，不是永久戰力升級。</p></div>
  <section class="recruitment-banner"><div><span class="eyebrow">SUMMER, UNDER THE STARS</span><h2>把海風帶上戰場。</h2><p>常駐混合獎池 · 10 項各 10% · 完全免費</p><p>新角色的原裝與夏日裝分開收集；先得到夏日裝，就能以夏日形態出戰。</p></div><img src="${formPortrait('C01-summer')}" alt="璃音・浪潮救援" loading="lazy"></section>
  <section class="recruitment-console" aria-label="招募資源"><div class="currency-row"><span><b>${c.tickets}</b> 招募券</span><span><b>${c.points}</b> 招募點數</span><span><b>${c.fragments}</b> 共鳴碎片</span></div><button class="button primary" data-action="draw" ${disabled||!missing.length||c.tickets<1&&c.points<100?'disabled':''}>${busy?'正在保存招募結果…':!missing.length?'本期已全收集':c.tickets>0?'使用 1 張招募券 →':'使用 100 招募點數 →'}</button><p class="quiet-note">${save.activeRun?'請先完成或放棄進行中的行動，再招募或換裝。':!missing.length?'保留所有剩餘券、點數與碎片，不再扣款。':'優先使用招募券。結果完成本機保存後才揭曉；重複同一形態獲得 10 碎片。'}</p></section>
  ${receipt&&form?`<section class="recruitment-receipt" role="status" tabindex="-1" aria-live="polite"><img src="${formPortrait(form.id)}" alt="${esc(CHARACTER_MAP[form.ownerId].name)}・${esc(form.name)}"><div><span class="eyebrow">已保存結果 #${receipt.id} · ${receipt.kind==='exchange'?'指定兌換':'招募'}</span><h2>${esc(CHARACTER_MAP[form.ownerId].name)}・${esc(form.name)}</h2><p>${receipt.duplicate?'重複形態 → 共鳴碎片 +10':'新形態已加入收藏，可在小隊編成裝備。'}</p>${elementBadge(form.damageType)}</div></section>`:''}
  <section class="collection-progress"><h2>本期收集 ${10-missing.length} / 10</h2><progress max="51" value="${c.claimed.length}" aria-label="一次性獎勵目標"></progress><p>已完成 ${c.claimed.length} / 51 個獎勵目標。${c.completionGranted?'全目標保底已發放，所有缺少形態已補齊。':'全部完成後，直接補齊本期所有缺少形態。'}</p></section>
  <div class="collection-grid">${POOL.map(f=>{const owned=c.owned.includes(f.id);return `<article class="collection-card ${owned?'owned':''}"><img src="${formPortrait(f.id)}" alt="${esc(CHARACTER_MAP[f.ownerId].name)}・${esc(f.name)}" loading="lazy"><div><span class="eyebrow">${f.theme==='summer'?'SUMMER FORM':'NEW CHARACTER'} · 10%</span><h2>${esc(CHARACTER_MAP[f.ownerId].name)}・${esc(f.name)}</h2>${elementBadge(f.damageType)}<p>${esc(f.passive)}</p><button class="button secondary" data-action="exchange" data-id="${f.id}" ${disabled||owned||c.fragments<100?'disabled':''}>${owned?'✓ 已收藏':'100 碎片・指定兌換'}</button></div></article>`;}).join('')}</div>
  <details class="reward-ledger"><summary>如何取得招募機會？${c.claimed.length} / ${REWARD_GOALS.length}</summary><p>15 關首通各 1 張券；12 關主線各 3 個挑戰，首次成功各 25 點。合計 15 券＋900 點，相當於 24 抽。全目標保底後不必用完，剩餘資源會保留。重打、換隊、失敗不增加獎勵；不需要新角色或造型才能通關。</p>${CHAPTERS.map(ch=>`<h3>${ch.name}</h3><ul>${ch.ids.map(id=>`<li>${stageNames[id]}：${c.claimed.includes(`stage:${id}`)?'✓ 首通券已領':'首通 1 張券'}${id.startsWith('S')?`<small>${CHALLENGES.map((key,i)=>`${['四人','禁隊長技能','兩終極'][i]} ${c.claimed.includes(`challenge:${id}:${key}`)?'✓':'○'} 25 點`).join(' · ')}</small>`:''}</li>`).join('')}</ul>`).join('')}</details><p class="quiet-note">免登入、本地收藏。清除網站資料會失去進度；本地防重複領取不是伺服器防作弊。沒有付費抽獎、每日任務或刷關收益。</p></main>`;
}
