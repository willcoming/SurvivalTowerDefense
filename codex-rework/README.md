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
├── 03-PHASE2_CRISIS_AND_COMMANDER.md   # 第二階段規格：防線心跳警報 + EMP 擊退
├── 04-PHASE3_COMBAT_SKILLS_AND_RESTORE.md # 第三階段規格：回歸星圖點選 + 純自動戰鬥 + 角色技能連鎖特效
├── 05-PHASE3_VISUAL_REFINEMENT_NO_LINES.md # 畫面精煉規格：去線條化 + 粒子光暈升級
├── 06-ULTIMATE_VFX_REWORK.md               # 終極技能視覺效果與能量累積徹底重構規格
├── ULTIMATE_VFX_CODEX_PROMPT.md            # 提供給 Codex 的大招視覺重構一鍵複製指令
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
   * 波末配點回歸清晰直觀的 24 節點專家星圖單項點選彈窗（點擊開啟簡介、單項扣點確認、支援拖曳縮放）。

2. **戰鬥緊湊刺激（Tactical Excitement & Hit Impact）**：
   * **打破純觀戰**：實裝「點擊手動集火（Focus Fire）」，點選怪物全隊拉出雷射優先斬首！
   * **感官刺激升級**：暴擊與擊殺加入 3~5 幀頓挫（Hit-stop）與相機輕微震動（Screen Shake）。
   * **防線心流**：防線 HP < 30% 全屏心跳紅光警告，破盾觸發緊急被動 EMP 擊退衝擊波（全自動無手動按鈕負擔）。

3. **策略深度動腦（Strategic Brain Burn）**：
   * **角色技能化學反應**：四大雙元素連鎖反應（烈焰黑洞、超導貫穿、電磁引爆、等離子過載）。
   * **全自動角色技能演出**：由角色普通攻擊、終極技與屬性碰撞在戰場上打出震撼粒子光效與連鎖字樣標籤。
   * **隊伍編成策略**：玩家策略重心回歸出戰隊伍的屬性搭配（熱能 + 重力、電漿 + 動能等）。

---

## 🛠️ Codex 執行工作流程

當 Codex 開始執行本任務時，請依序進行：

1. **閱讀 `01-MASTER_PLAN.md`**：了解專案全貌與核心架構邊界。
2. **按照 Phase 階段執行**：
   * **第一階段**：執行 `02-PHASE1_VISUAL_AND_FOCUS.md`。
   * **第二階段**：執行 `03-PHASE2_CRISIS_AND_COMMANDER.md`。
   * **第三階段**：執行 `04-PHASE3_COMBAT_SKILLS_AND_RESTORE.md`。
   * **畫面精煉**：執行 `05-PHASE3_VISUAL_REFINEMENT_NO_LINES.md`。
3. **驗證指令**：
   * 靜態類型檢查：`npm run typecheck`
   * 核心規則驗證：`npm run test:rules`
   * 模擬平衡驗證：`npm run test:simulation`
   * 瀏覽器 E2E 測試：`npx playwright test tests/e2e/ui-review.spec.ts`
   * 建置驗證：`npm run build`
