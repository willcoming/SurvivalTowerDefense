# 01. 重構主計畫書 (Master Plan)

## 1. 系統現狀與架構對照

《星骸防線》的核心運行管線如下：

```
[玩家輸入 / 事件]
       │
       ▼
[src/sim/engine.ts] ──(stepRun / tick)──► [src/sim/combat.ts] (傷害/索敵/狀態)
       │                                          │
       ▼                                          ▼
[src/game/scene.ts] (Phaser 3 畫面渲染) ◄── [VisualEvent 佇列]
       │
       ▼
[src/ui/battle.ts & game-shell.ts] (DOM HUD / 波末配點 / 彈窗)
```

### 既有架構約束（不可破壞項）
1. **IndexedDB 存檔結構**（`src/storage/repository.ts`）：
   * `GameSave.preferences`、`GameSave.collection`、`GameSave.commander` 欄位型別必須向後相容。
   * 新增欄位需具備安全預設值（Fallback）。
2. **135+ 項規則測試**（`tests/rules/`）：
   * 戰鬥核心數學模型不得產生未定義 NaN 或突發崩潰。
   * 既有波次產生（`wave-flow.ts`）與傷害公式（`computeDamage`）需保持基本倍率守恆。
3. **手機直向響應式支援**：
   * 支援 320px、375px、390px、430px 直向解析度，所有可觸控按鈕需符合 ≥ 44×44px 點擊熱區標準。

---

## 2. 核心痛點與設計方案對應表

| 痛點編號 | 現況診斷 | 解決方案 | 影響模組 |
|---|---|---|---|
| **V-01** | 怪群聚時頭頂「燃燒 X.X」中文字與多種幾何標記互相疊蓋成色塊噪音 | 移除中文文字，改以 Sprite Shader 體表著火粒子與顏色描邊呈現；簡化弱點圖示 | `src/game/status-effects.ts`<br>`src/game/weakness-markers.ts` |
| **V-02** | 傷害數字過於零碎，缺乏爆擊打擊感 | 引入 300ms 傷害聚合視窗，持續傷害整併；暴擊 22px 金色黑邊彈跳演出 | `src/game/effects.ts` |
| **V-03** | 戰場中間 60% 空間空曠冷清，缺乏縱深與危機感 | 在距離防線上方 200px 繪製「動態威脅警戒紅線」，最前排逼近時觸發邊界呼吸紅光 | `src/game/scene.ts`<br>`src/ui/battle.ts` |
| **V-04** | 手機 390px 上 24 節點星圖縮小看不清字、放大看不清全貌 | 頂層提供「三大推薦流派卡片」，一鍵配置；保留展開 24 節點專家星圖開關 | `src/ui/skill-constellation.ts`<br>`src/ui/battle.ts` |
| **A-01** | 全自動戰鬥導致玩家雙手閒置，純觀戰乏味 | 實裝「點擊手動集火（Focus Fire）」，點擊怪物全隊拉出雷射優先斬首 | `src/sim/types.ts`<br>`src/sim/combat.ts`<br>`src/game/scene.ts` |
| **A-02** | 缺乏打擊重量感，消滅怪潮爽度低 | 暴擊、Boss破盾、終極技加入 3~5 幀頓挫（Hit-stop）與 0.1s 相機微震 | `src/game/scene.ts` |
| **A-03** | 防線受創只有綠條微縮，缺乏危機心流 | 防線 HP < 30% 觸發全屏心跳紅光；破盾觸發緊急保底 EMP 衝擊波將怪震退 200px | `src/ui/battle.ts`<br>`src/sim/combat.ts` |
| **S-01** | 屬性剋制僅是死板 1.5 倍數值，缺乏連攜 | 實裝雙元素連鎖反應：熱能+重力=烈焰黑洞，電漿+物理=超導貫穿 | `src/sim/combat.ts` |
| **S-02** | 局內戰術手段單一 | 指揮官主動戰術槽：全息磁暴牆（定身3s）、軌道滅殺砲 | `src/sim/engine.ts`<br>`src/ui/battle.ts` |

---

## 3. 模組改動影響矩陣

```
src/
├── sim/
│   ├── types.ts              ── 新增 focusTargetId, emergencyPulseUsed, elementalState
│   ├── combat.ts             ── 索敵優先級判定、元素連鎖反應計算、EMP 擊退
│   └── engine.ts             ── 指揮官戰術技能冷卻與指令轉發
├── game/
│   ├── scene.ts              ── 點擊敵人事件綁定、集火導引雷射、震屏、警戒線
│   ├── status-effects.ts     ── 移除頭頂燃燒中文、優化體表微光 Shader
│   ├── effects.ts            ── 傷害跳字聚合與暴擊特寫
│   └── weakness-markers.ts   ── 弱點標記層級精簡
└── ui/
    ├── battle.ts             ── 防線瀕危心跳紅光、指揮官手動戰術按鈕、流派卡片按鈕
    └── skill-constellation.ts── 流派卡片導向 UI 封裝
```

---

## 4. 階段式推進驗證準則

每完成一個 Phase，Codex 必須依序通過以下檢核點：
1. `npm run typecheck`：零 TypeScript 報錯。
2. `npm run test:rules`：所有戰鬥與存檔規則測試 100% 通過。
3. `npm run test:simulation`：戰鬥模擬不中斷。
4. `npm run build`：Vite 建置零錯誤產出。
