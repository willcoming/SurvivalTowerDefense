# 《星骸防線》體驗重構與畫面優化：Codex 執行指導手冊

> **本目錄為專門提供給 OpenAI Codex / AI Agent / 工程師執行的獨立重構指引與規格包。**
>
> 本次重構核心宗旨：**「畫面簡單易懂、戰鬥緊湊刺激、策略深度動腦」**。
> 保持現有 135+ 規則測試與 IndexedDB 存檔向下相容，不破壞既有架構，分階段演進。

---

## 📂 目錄結構一覽

```
codex-rework/
├── README.md                           # 本指南：專案背景、目標與執行順序
├── 01-MASTER_PLAN.md                   # 完整重構總計畫（系統架構、數值公式、技術約束）
├── 02-PHASE1_VISUAL_AND_FOCUS.md       # 第一階段規格：畫面降噪 + 手動集火 + 震屏反饋
├── 03-PHASE2_CRISIS_AND_COMMANDER.md   # 第二階段規格：防線心跳警報 + EMP 擊退 + 指揮官戰術
├── 04-PHASE3_ELEMENT_COMBOS_AND_CARDS.md # 第三階段規格：雙元素連鎖共鳴 + 流派卡片化
└── mockups/
    ├── battle-redesign-mockup.svg      # 戰鬥畫面前後對比高解析度向量圖
    ├── skill-cards-mockup.svg          # 波末流派卡片視覺向量圖
    └── interactive-preview.html        # 瀏覽器可開啟的互動式完整原型
```

---

## 🎯 重構三大核心目標

1. **畫面簡單易懂（Visual De-cluttering）**：
   * 移除怪物頭頂的「燃燒 20.3」等中文與雜亂標記堆疊，改為體表粒子微光與顏色狀態。
   * 傷害跳字改為 300ms 視窗合流（暴擊金色大字彈跳、普通傷害輕量化）。
   * 戰場劃出「威脅警戒線（Threat Line）」，善用空曠道路空間。
   * 手機波末配點提供「流派標籤卡片導向」，新手一眼看懂，保留底層 24 節點專家星圖。

2. **戰鬥緊湊刺激（Tactical Excitement & Hit Impact）**：
   * **打破純觀戰**：實裝「點擊手動集火（Focus Fire）」，點選怪物全隊拉出雷射優先斬首！
   * **感官刺激升級**：暴擊與擊殺加入 3~5 幀頓挫（Hit-stop）與相機輕微震動（Screen Shake）。
   * **防線心流**：防線 HP < 30% 全屏心跳紅光警告，破盾觸發緊急 EMP 擊退衝擊波。

3. **策略深度動腦（Strategic Brain Burn）**：
   * **雙元素連鎖化學反應**：熱能+重力=烈焰黑洞（聚怪擴散燃燒），電漿+物理=超導貫穿（100%暴擊+電弧）。
   * **指揮官主動戰術槽**：每場可用手動主動技能（全息磁暴牆、軌道轟炸）。
   * **特化怪物戰術拆解**：重盾怪正面減傷需引力背刺、自爆怪需警戒線外手動集火。

---

## 🛠️ Codex 執行工作流程

當 Codex 開始執行本任務時，請依序進行：

1. **閱讀 `01-MASTER_PLAN.md`**：了解專案全貌與核心架構邊界。
2. **按照 Phase 階段執行**：
   * **第一階段**：執行 `02-PHASE1_VISUAL_AND_FOCUS.md`（優先級最高，立即見效且改動安全）。
   * **第二階段**：執行 `03-PHASE2_CRISIS_AND_COMMANDER.md`。
   * **第三階段**：執行 `04-PHASE3_ELEMENT_COMBOS_AND_CARDS.md`。
3. **驗證指令**：
   * 靜態類型檢查：`npm run typecheck`
   * 核心規則驗證：`npm run test:rules`
   * 模擬平衡驗證：`npm run test:simulation`
   * 瀏覽器 E2E 測試：`npx playwright test tests/e2e/ui-review.spec.ts`
   * 建置驗證：`npm run build`
