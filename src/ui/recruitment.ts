import { assetUrl } from '../assets';
import { CHARACTER_MAP } from '../data/content';
import { POOL, FORM_MAP, formPortrait, ELEMENTS } from '../data/forms';
import { RECRUIT_RULES, recruitmentRate } from '../data/recruitment';
import { missingForms } from '../storage/collection';
import type { GameSave } from '../storage/repository';
import type { FormId } from '../sim/types';
import { esc } from './format';

export type RecruitView='draw'|'exchange';
function recruitImage(id:FormId,className='',lazy=false){
  const form=FORM_MAP[id],name=`${CHARACTER_MAP[form.ownerId].name}・${form.name}`;
  return `<button type="button" class="recruit-image-button ${className}" data-action="recruit-preview" data-id="${id}" aria-label="查看${esc(name)}全螢幕大圖" aria-haspopup="dialog"><img src="${formPortrait(id)}" alt="${esc(name)}" ${lazy?'loading="lazy"':''}></button>`;
}
export function recruitmentPreview(id:FormId){
  const form=FORM_MAP[id],name=`${CHARACTER_MAP[form.ownerId].name}・${form.name}`;
  return `<section class="recruit-art-viewer" role="dialog" aria-modal="true" aria-labelledby="recruit-art-title"><header><h2 id="recruit-art-title">${esc(name)}</h2><button type="button" class="icon-button" data-action="recruit-preview-close" aria-label="關閉大圖">×</button></header><div class="recruit-art-stage"><img src="${formPortrait(id)}" alt="${esc(name)}完整立繪"></div></section>`;
}
export function recruitment(save:GameSave,busy=false,view:RecruitView='draw'){
  const c=save.collection,missing=missingForms(c),disabled=busy||!!save.activeRun;
  const receipt=c.lastReceipt,form=receipt?FORM_MAP[receipt.formId]:null;
  const untilNew=RECRUIT_RULES.guaranteeAt-(c.drawsSinceNew??0);
  const ticket=assetUrl('rewards/recruit-ticket-v2.webp');
  return `<main class="content-screen recruitment-screen recruitment-v2">
    <header class="recruit-v2-heading"><div><small>STARFALL / RECRUITMENT</small><h1>星際徵召</h1></div><button class="recruit-help" data-action="command-panel" data-id="recruit-rules" aria-label="獎池機率與規則">?</button></header>
    <nav class="recruit-v2-tabs" aria-label="招募分類">${([['draw','招募'],['exchange','兌換']] as const).map(([id,label])=>`<button data-action="recruit-tab" data-id="${id}" ${view===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav>
    <section class="recruit-v2-catalog" aria-label="${view==='draw'?'獎池內容':'指定兌換'}">
      ${view==='draw'&&receipt&&form?`<section class="recruitment-receipt recruit-v2-receipt" role="status" tabindex="-1" aria-live="polite">${recruitImage(form.id,'recruit-receipt-image')}<div><small>${receipt.kind==='exchange'?'兌換成功':receipt.guaranteed?'保底招募':receipt.duplicate?'重複轉換':'NEW / 新收藏'}</small><strong>${esc(CHARACTER_MAP[form.ownerId].name)} · ${esc(form.name)}</strong><span>${receipt.duplicate?`共鳴點數 +${receipt.pointsGained??10}`:'已加入收藏'}</span></div></section>`:''}
      <div class="recruit-catalog-meta"><span>收藏 <b>${POOL.length-missing.length} / ${POOL.length}</b></span><span>${view==='draw'?'角色 30% · 造型 70%':`共鳴點數 ${c.points}`}</span></div>
      <div class="recruit-card-grid">${POOL.map(f=>{
        const owned=c.owned.includes(f.id),element=ELEMENTS[f.damageType];
        return `<article class="recruit-item ${owned?'is-owned':''}">
          <div class="recruit-item-art">${recruitImage(f.id,'',true)}<span class="recruit-item-kind">${f.theme==='original'?'角色':'造型'}</span>${owned?'<b aria-label="已收藏">✓</b>':''}</div>
          <div class="recruit-item-copy"><h2>${esc(CHARACTER_MAP[f.ownerId].name)}</h2><p>${esc(f.name)}</p><span class="recruit-item-element" style="color:${element.color}">${element.icon} ${element.name}</span>
            ${view==='draw'?`<strong class="recruit-item-rate">${recruitmentRate(f)}%</strong>`:`<button data-action="exchange" data-id="${f.id}" ${disabled||owned||c.points<RECRUIT_RULES.exchangeCost?'disabled':''}>${owned?'已收藏':`${RECRUIT_RULES.exchangeCost} 點兌換`}</button>`}
            <details><summary>能力</summary><p>${esc(f.passive)}</p></details>
          </div>
        </article>`;
      }).join('')}</div>
    </section>
    ${view==='draw'?`<footer class="recruit-purchase-panel">
      <div class="recruit-guarantee"><span>${!missing.length?'本期收藏完成':untilNew===1?'本次必得未持有內容':`再 ${untilNew} 抽內必得未持有內容`}</span><div aria-hidden="true">${Array.from({length:10},(_,i)=>`<i class="${i<(c.drawsSinceNew??0)?'filled':''}"></i>`).join('')}</div></div>
      <div class="recruit-v2-action"><button class="button primary" data-action="draw" ${disabled||!missing.length||c.tickets<1&&c.points<RECRUIT_RULES.drawCost?'disabled':''}><img src="${ticket}" alt=""><span>${busy?'招募中…':!missing.length?'已全收集':'招募 1 次'}<small>${c.tickets>0?'招募券 ×1':`共鳴點數 ×${RECRUIT_RULES.drawCost}`}</small></span></button>${save.activeRun?'<span class="recruit-blocked">作戰中無法招募</span>':''}</div>
    </footer>`:''}
  </main>`;
}

export function recruitmentRules(){
  return `<div class="recruit-rules"><h3>招募機率</h3><table><thead><tr><th>類型</th><th>項目</th><th>單項機率</th><th>合計</th></tr></thead><tbody><tr><td>角色</td><td>2</td><td>15%</td><td>30%</td></tr><tr><td>造型</td><td>8</td><td>8.75%</td><td>70%</td></tr></tbody></table><h3>保底與兌換</h3><p>10 抽內必得一項未持有內容。取得新品後重新計數；保底僅從未持有內容依原權重抽取。</p><p>重複內容轉成 20 共鳴點數，100 共鳴點數可指定兌換任一未持有項目。兌換不消耗保底次數。</p><h3>招募資源</h3><p>每次使用 1 張招募券；沒有券時使用 100 共鳴點數。全收集後停止扣除資源。</p><p>耐久 1%／50%／100% 各有一格獎勵。簡單為 25／25／50 共鳴點數，困難為 1／2／3 張招募券，挑戰為 3／6／9 張招募券。每關、每難度、每項挑戰分開計算，每格只領一次；達成多格會一起發放。舊版已領格與收藏保留。</p><p>首頁「簡單、困難」後的「挑戰」入口，在通關本關困難模式後解鎖。挑戰固定以困難模式為基準，再加上指定限制；完成全部 51 個通關與挑戰目標，仍可補齊所有缺少收藏。</p></div>`;
}
