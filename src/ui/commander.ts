import { COMMON_TREE, COMMON_ROUTE_NAMES } from '../data/deep-trees';
import { commanderProgress, commanderSkillLock, COMMANDER_MAX_LEVEL, commanderLevelCost, type CommanderState } from '../data/commander';
import { migrateCommander } from '../storage/commander';
import type { GameSave } from '../storage/repository';
import { esc } from './format';

export const commanderState=(save:GameSave):CommanderState=>save.profile.commander??migrateCommander(save.profile.cleared);
export function commanderPage(save:GameSave){
  const state=commanderState(save),progress=commanderProgress(state),busy=!!save.activeRun;
  return `<main class="commander-screen" aria-labelledby="commander-title">
    <header class="commander-heading"><button class="icon-button" data-action="home" aria-label="返回作戰中心">‹</button><div><span class="eyebrow">COMMANDER DEVELOPMENT</span><h1 id="commander-title">指揮官成長</h1><p>${esc(save.preferences.commanderName??'指揮官')} · 共用技能設定</p></div></header>
    <section class="commander-progress" aria-label="指揮官等級與技能點">
      <div class="commander-level"><span>指揮官等級</span><strong>Lv.${progress.level}</strong><small>最高 Lv.${COMMANDER_MAX_LEVEL}</small></div>
      <div class="commander-experience"><div><b>${progress.required?'距離下一級':'已達最高等級'}</b><span>${progress.required?`${progress.current} / ${progress.required} 經驗`:'全部 12 點已解鎖'}</span></div><progress max="${progress.required||1}" value="${progress.required?progress.current:1}" aria-label="升級經驗"></progress><p>每升 1 級獲得 1 點，共用技能永久保留。</p></div>
      <div class="commander-points"><span>可用技能點</span><strong>${progress.available}</strong><small>已配置 ${state.skillIds.length} / ${progress.earned}</small></div>
    </section>
    <div class="commander-allocation-heading"><div><h2>共用技能</h2><p>每個技能 1 點，依序解鎖；配置於下一次出擊生效。</p></div><button class="button secondary" data-action="commander-reset" ${!state.skillIds.length||busy?'disabled':''}>免費重配</button></div>
    ${busy?'<p class="commander-status" role="status">請先結束目前作戰，再調整指揮官技能。</p>':''}
    <div class="commander-routes">${COMMON_ROUTE_NAMES.map((name,lane)=>`<section class="commander-route" aria-labelledby="commander-route-${lane}"><header><span>0${lane+1}</span><h3 id="commander-route-${lane}">${esc(name)}</h3></header><ol>${COMMON_TREE.nodes.filter(n=>n.lane===lane).map(node=>{
      const owned=state.skillIds.includes(node.id),lock=commanderSkillLock(state.skillIds,node.id),disabled=owned||!!lock||progress.available<1||busy;
      return `<li class="${owned?'owned':lock?'locked':'available'}"><span class="commander-node-mark" aria-hidden="true">${owned?'✓':node.layer+1}</span><div><h4>${esc(node.name)}</h4><p>${esc(node.description)}</p><button data-action="commander-upgrade" data-id="${node.id}" aria-label="${owned?`${node.name}，已升級`:`升級${node.name}，需要 1 點`}" ${disabled?'disabled':''}>${owned?'✓ 已升級':lock?'先升級上一階':progress.available<1?'等待升級取得點數':busy?'作戰中無法調整':'升級 · 1 點'}</button></div></li>`;
    }).join('')}</ol></section>`).join('')}</div>
    <details class="commander-rules"><summary>升級規則與經驗表</summary><p>簡單通關：40 ＋ 波次數 × 10 經驗。困難 × 1.25、挑戰 × 1.5（四捨五入）。每個關卡首次通關另加 40 經驗，跨難度只領一次。重複通關仍可累積一般通關經驗。</p><p>戰敗按擊殺進度給予最多 25% 通關經驗；主動離開不給經驗。同一局不會重複結算。既有通關關卡已補發首次通關經驗。最高等級後經驗不再增加。</p><p>指揮官點數與戰鬥中的隊員技能點各自計算。免費重配會返還已用點數；出擊後，本局套用的共用技能固定不變。</p><table><caption>每次升級需要的經驗</caption><thead><tr><th>等級</th><th>所需經驗</th><th>獲得技能點</th></tr></thead><tbody>${Array.from({length:COMMANDER_MAX_LEVEL-1},(_,i)=>`<tr><td>Lv.${i+1} → ${i+2}</td><td>${commanderLevelCost(i+1)}</td><td>＋1</td></tr>`).join('')}</tbody></table></details>
  </main>`;
}
