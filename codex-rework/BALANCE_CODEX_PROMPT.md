# 給 Codex 的「平衡性與逐步升級體驗優化」指令 (Prompt)

請直接將以下整段 Markdown 內容複製並發送給 Codex（或 Cursor Composer 等 AI 助理）：

---

```markdown
請根據專案中的 `codex-rework/08-BALANCE_AND_EXPERIENCE_REWORK.md` 規格，針對《星骸防線》的難度平衡與升級體驗進行修復與優化：

### 🚨 現況痛點與任務目標：
1. **升級曲線不夠平滑**：雖然底層已經有逐步增加經驗的要求，但玩家希望波次間的「逐步升級」體驗能更舒服，不至於前期給太多點數、後期卡點。
2. **S03 之後的 Hard/挑戰模式出現卡關死胡同**：自動化測試 (`test:simulation`) 顯示 S03~S06 的 Hard / Four-man / No-skill 模式防線 HP 歸零（失敗）。容錯率過低。
3. **部分測試回放損壞**：`test:simulation:free` 噴出 `Replay command rejected` 與 `Policy rejected` 錯誤。

---

### 🎯 核心實裝步驟：

#### 1. 優化「逐步升級」的經驗分配 (`src/data/battle-experience.ts`)
* 檢查並優化 `pacedExperienceProfile` 函數。
* 確保 `waveXp` 的波次分配權重（`progress` 的指數計算等）能讓玩家每一兩波都有穩定的點數入帳，完美對齊 `battleLevelCost`（30, 35, 40...）的線性成長。

#### 2. 下修進階難度的高壓與菁英怪生成 (`src/data/progression.ts` & `src/data/assault-balance.ts`)
* 在 `stageProfile` 或難度配置中，將 `balanceVersion === 4` 或 `5` 針對 `Hard`、`Four-man`、`No-skill` 等進階挑戰的敵人加成（如 `bossScale` 或擴充係數）下調約 10%~15%。
* 減少重甲與高爆發菁英怪在同一波次的同框數量，給予防線與 AI 自動操作合理的緩衝與容錯空間。
* **注意**：Easy 模式維持原狀，確保新手體驗不被破壞。技能樹參數（24點預算、各節點傷害）**請勿更動**，以防破壞已經通過的技能平衡。

#### 3. 修復自動化測試的回放與策略 (`tests/helpers/deep-build.ts` 等)
* 找出造成 `Replay command rejected` 與 `Policy rejected` 的原因（通常是因為技能樹/解鎖順序有微調但舊 replay json 沒更新，或是 AI 選點策略寫死導致的報錯）。
* 更新測試檔的 dummy 策略或補齊缺失的防禦代碼，讓它能順利通過新的平衡數值。

---

### 🧪 驗證指令要求：
請在修改後依序執行並確保以下檢查 100% 通過：
1. `npm run test:simulation` （必須看到 S01~S06 所有模式皆為 victory，無 wall/HP 0）
2. `npm run test:simulation:free` （不能再報錯）
3. `npm run test:rules`
```
