# 08 - 平衡性與體驗優化 (Balance & Experience Refinement)

## 1. 核心目標

在我們最新的平衡與系統體檢中，確認了以下三項重點狀況：
1. **升級經驗配置（逐步升級）**：目前底層邏輯 (`battleLevelCost`) 具備平滑升級的潛力，但需要在實際關卡波次體驗中更加突顯「逐步、穩定」的升級回饋，避免後期卡等。
2. **技能間的平衡**：14 條技能樹與 24 點預算系統目前表現良好，各具戰術價值，應當**保持現狀**，不作破壞性改動。
3. **高難度關卡牆（Difficulty Wall）**：在近期的 `test:simulation` 自動化測試中，S03 之後的 Hard（困難）、Four-man（四人）、No-skill（無技能）等挑戰模式出現了防線無法守住（HP 歸零）的挫折體驗。

**本階段使命**：微調高難度的容錯率與敵軍擴展公式，確保挑戰模式具備可行性，並讓玩家在單局戰鬥中的升級過程達到真正舒適的「逐步升級」心流。

---

## 2. 實作規格與範圍

### A. 平滑化「逐步升級」曲線 (`src/data/battle-experience.ts`)
* 確認並強化 `pacedExperienceProfile` 裡的波次 XP 分配演算法。確保玩家在波次推進時，獲得 XP 的速率能跟上 `battleLevelCost` 線性成長（30, 35, 40...）的速度。
* 若有必要，微調指數參數（例如將 `Math.pow(progress, 1.05)` 調整為更平滑的數值，如 `1.0` 均勻分配，或根據早期建立防線的需要適度調整分配權重），保證前期不會點數氾濫，後期不會陷入長時間無點可用的枯燥期。

### B. 突破高難度死胡同 (`src/data/progression.ts` / `src/data/assault-balance.ts`)
* 針對 `stageProfile` 中的 `balanceVersion === 4` 或 `5`：
  * 將敵群擴增系數（如 1.3x 敵人數量或波次）根據難度做差異化調整。例如 Hard 模式維持較高壓力，但減少特定血牛型菁英怪（重甲）的同時生成數量。
  * 稍微下修 `bossScale` 或是進階挑戰（如 Four-man, No-skill）下的敵軍基礎傷害/血量加成（調降約 10%~15%），讓純 AI 或一般玩家操作時，有合理的戰術容錯空間。
* 保持 Easy 模式目前的平穩狀態。

### C. 修復損壞的測試回放 (`scripts/validate-free-skills.ts` / `tests/helpers/deep-build.ts`)
* 解決 `test:simulation:free` 遇到的 `Error: Replay command rejected` 與 `Policy rejected`。
* 這些錯誤通常是因為先前的技能前置條件、花費或節點順序有微調，導致舊的測試重播指令失效。需要重新錄製或更新這些測試檔的 expected commands，確保 CI/CD 再次亮綠燈。

---

## 3. 驗證標準

* 執行 `npm run test:simulation`：S03~S06 的 Hard / Four-man / No-skill 挑戰必須全數顯示 `victory`，防線 HP > 0。
* 執行 `npm run test:simulation:free`：不能再拋出 `Replay command rejected` 錯誤。
* 執行 `npm run test:tactical:matrix`：維持全數通過。
