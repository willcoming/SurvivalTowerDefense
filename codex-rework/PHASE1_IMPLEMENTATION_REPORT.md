# 第一階段實作與驗證紀錄

日期：2026-10-07

已依 `README.md`、`01-MASTER_PLAN.md` 與 `02-PHASE1_VISUAL_AND_FOCUS.md` 實作四項第一階段功能，保留工作區原有修改。

## 實作結果

- **燃燒降噪**：移除 `StatusEffects` 的 12 個中文文字物件；火光移至敵人身軀，保留現有元素染色與控場提示。
- **合併傷害**：每個敵人的持續傷害以 300ms 視窗合併成 12px 半透明數字；一般傷害也合併，最多使用 24 個文字物件、精簡模式 10 個。跳字跟隨敵人，死亡後留在最後位置；暫停時結清尚未顯示的視窗。
- **暴擊特寫**：既有規律暴擊、直接弱點命中與破盾事件使用 22px 金色深色描邊、最高 1.3 倍縮放、24px 上升與 400ms 淡出。新增的事件旗標只傳递已發生的暴擊，不變更傷害倍率或亂數。
- **手動集火**：點敵人鎖定，再點一次取消；死亡時清除。各武器優先攻擊射程內的鎖定目標，包含原本另行挑選最高血量目標的狙擊手。保留穿透、連鎖、射程與冷卻規則。集火指令記入既有 action log；歷史快照可省略新欄位。
- **集火提示**：旋轉紅色菱形準星、從所有出戰隊員槍口出發的淡紅導引線，以及取消／死亡時的擴散淡出。觸控區至少 44 CSS px；鍵盤方向鍵切換目標，Enter 鎖定或取消。
- **警戒與打擊回饋**：在 `WORLD.wallY - 220`（Y=230）顯示紅色虛線，存活敵人越線後呼吸高亮。重大直接命中與終極技觸發 100ms／0.005 微震，間隔至少 350ms，避免連續抖動。
- **減少動態效果**：遊戲的減少特效選項與系統的減少動態效果偏好皆會停用新震屏、跳字縮放及準星旋轉，保留狀態提示。

## 驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `npm run test:rules` | 40 個檔案、783 項通過，包含 11 項新增規則測試 |
| `npm run build` | 通過；16 組角色動作與 14 個其他圖集檢查通過；仍有 bundle 大小提示 |
| `npx playwright test tests/e2e/phase1-visual-focus.spec.ts tests/e2e/ui-review.spec.ts tests/e2e/burn-follow.spec.ts` | Chromium + WebKit 共 40 項通過 |
| 手機／桌面瀏覽器 | 320、375、390、430、768、1024、1440px；手機使用觸控事件；驗證鍵盤、取消、死亡清除、實際射擊方向、跳字、警戒線與減少動態效果 |
| `npm run test:wave-flow:simulation` | 66 個關卡／模式案例及 1 個百波案例完成，無逾時；關卡 4 勝，百波結果為防線失守，並非全勝平衡驗收 |
| `git diff --check` | 通過 |
| `npm run test:simulation` | 未通過，見下方既有問題 |

瀏覽器報告與截圖：`artifacts/validation/phase1-final/browser-results/`。
目前波次模擬報告：`artifacts/validation/phase1-wave-flow/simulation.md`。

## 既有模擬驗證器問題

`npm run test:simulation` 呼叫 `scripts/validate-collection.ts`，其 `playDeep` helper 固定使用舊版 `PRE_REWORK_VERSION` 與舊技能配點策略；於 S07 的配點流程出現 `Policy rejected undefined`，無法跑完。完整命令在 S01–S06 的 90 個案例後失敗。

已在獨立暫存目錄，用 Git HEAD 的原始 `src/sim` 改動檔重跑同一驗證器（`--quick`）：同樣失敗，且修改前後已完成的 30 個案例之結果與防線血量完全相同。這是原有驗證策略問題；本次沒有更改策略、調整戰鬥倍率或放寬成功条件。

- 基線紀錄：`artifacts/validation/phase1/baseline-simulation.log`
- 修改後紀錄：`artifacts/validation/phase1/current-simulation.log`

因此第一階段功能與上述回歸驗證已完成，但主計畫要求的原始模擬驗證命令尚未全綠，不能將其記為通過。
