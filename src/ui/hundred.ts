import { CURRENT_BALANCE_VERSION } from '../data/assault-balance';
import { operationProfile } from '../data/progression';
import { HUNDRED_NAME, type HundredScore } from '../data/hundred';
import type { GameSave } from '../storage/repository';
import { num, portrait } from './format';
export function hundredRecord(best?:HundredScore){
 return `<section class="hundred-record" aria-label="百波最高成績"><span class="eyebrow">LOCAL BEST / 本機最高成績</span><h2>${best?`${best.waves} <small>/ 100 波</small>`:'尚未挑戰'}</h2><p>${best?`擊殺 ${num(best.kills)} · 防線耐久 ${num(best.wallHp)}`:'突破第一波，留下妳的第一筆紀錄。'}</p></section>`;
}
export function hundredPage(save:GameSave){
 const profile=operationProfile({config:{stageId:'S03',difficulty:'easy',mode:'hundred',squadIds:save.preferences.squadIds,captainId:save.preferences.captainId,seed:0},operationVersion:3,balanceVersion:CURRENT_BALANCE_VERSION});
 return `<main class="content-screen hundred-screen"><div class="page-intro"><span class="eyebrow">SURVIVAL / 100 WAVES</span><h1>${HUNDRED_NAME}</h1><p>一支小隊，一百波攻勢。看看這道防線能守到哪裡。</p></div>${hundredRecord(save.profile.hundredBest)}<button class="button primary" data-action="start-hundred" ${save.preferences.squadIds.length?'':'disabled'}>開始百波挑戰 →</button><p class="hundred-summary">100 波 · 清場後配點 · 每 10 波增強</p><details class="hundred-rules"><summary>挑戰規則與計分方式</summary><p>本波敵人全部清除後統一配置技能，可保留點數；確認後才開始下一波，每 10 波提高敵人強度。第 100 波首領降臨，清除全部敵人即通關，沒有時間限制。</p><p>共 ${profile.enemies} 隻常規敵人；擊殺取得經驗，最多 ${profile.points} 點本局技能，每名角色可取得 1 個終極。</p><p>以完成波數排名，同波數比較擊殺數，再比較剩餘防線耐久。成績自動存於目前瀏覽器；本局離開後結束，最高紀錄保留。</p><p>使用目前編隊與指揮官技能，固定挑戰規則。此模式專門挑戰紀錄，不發放主線首通獎勵。</p></details><section class="hundred-squad" aria-label="出擊編隊">${save.preferences.squadIds.map(id=>portrait(id)).join('')}</section><div class="action-bar"><button class="button secondary" data-action="home">返回作戰中心</button><button class="button secondary" data-action="roster">調整編隊</button></div></main>`;
}
