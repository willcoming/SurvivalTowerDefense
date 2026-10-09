# 戰鬥特效完整巡檢與修正

日期：2026-10-08

前一輪只完成集火、元素連鎖與防線 EMP，漏掉 Boss 進場、蓄力、攻擊釋放，以及以貼圖拉長的電弧。此次沿 BattleScene 的實際呼叫路徑檢查所有戰鬥渲染器，並以三關 Boss 的真實進場、蓄力與防線受傷事件驗證。

## 線條來源與處理

| 來源 | 原本效果 | 本次結果 |
| --- | --- | --- |
| `boss-entrance.ts` | 雙層橢圓、旋轉多邊形、放射線、標題分隔線 | 移除，改為少量不規則煙霧與局部柔光 |
| `scene.ts / drawWarnings` | 全場三角投影、描邊圓、蓄力進度弧、底部橢圓 | 移除，保留頂部名稱與倒數、小型提示及敵人局部微光；蓄力結束即清除 |
| `boss-assault.ts` | Boss 連到防線的長線、全寬受擊色帶 | 移除，真實受傷時才在防線命中位置顯示煙霧、火星與傷害數字 |
| `material-effects.ts` | 電漿／電弧以數段拉長貼圖連接全場 | 移除長條片段，保留短小飛行彈體及局部命中效果 |
| `combo-effects.ts` | 疊圓光核、規則粒子環造成靶心／傳送門觀感 | 改為連續漸層貼圖、不規則煙霧、收斂火星、短閃光與碎片；同目標同類反應合併標籤 |
| `crisis-effects.ts` | 幾何衝擊環 | 改為低透明度擴散柔光及零散火星 |
| `range-overlay.ts` | 手動查看射程時的弧形邊線 | 移除描邊，保留低透明度範圍填色與範圍內目標小點 |
| `scene.ts` | 戰場底部青色直線 | 移除 |
| `skill-effects.ts`、`effects.ts` 舊工具 | 未使用的雷射、閃電折線、多邊形等繪圖程式 | 確認無呼叫後移除 |

另檢查 `focus-overlay.ts`、`area-effects.ts`、`projectile-visuals.ts`、`status-effects.ts`、`actors.ts` 與 `captain-cutin.ts`。集火仍採小角標，普通彈體、角色動作與局部受擊貼圖維持原有功能。

沒有宣稱所有可见邊緣都消失：弱點圖示的小方框、文字描邊、介面邊框、原始角色／場景美術仍在。C08 的 34 × 16 武器局部蓄能貼圖也保留；它不連接敵人或橫跨戰場。射程填色仍使用路徑頂點，但不描邊。`src/game` 已無 `lineStyle`、`strokeCircle`、`strokeEllipse`、`strokePath`、`lineBetween` 的呼叫。

## 實作與驗證

`natural-effects.ts` 共用一張 128px 連續徑向漸層 CanvasTexture，搭配有上限的 Image 物件池。視覺隨機變化不消耗模擬 RNG；四種連鎖名稱、診斷介面與傷害規則保留。

- TypeScript 型別檢查：通過。
- 規則測試：42 個檔案、814 項通過。
- 正式建置與離線快照：通過，128 個檔案、17.9 MB；既有大型 JavaScript 區塊警告仍在。
- Chromium / WebKit：72 項全部通過，無略過。涵蓋三關 Boss × 手機／桌面、集火、被動 EMP、元素反應、星圖及角色無圓環檢查。
- 視覺檢查：人工檢視三隻 Boss 的手機進場、蓄力、命中截圖、桌面蓄力及元素連鎖截圖。自動測試確認進場暫停模擬、蓄力警告、真實防線扣血、傷害標籤與無頁面例外；外觀另以截圖確認。

檢查素材位於 `artifacts/validation/natural-vfx/evidence/`，包含 `S01`、`S02`、`S03` 的三階段截圖及完整測試錄影。各項指令輸出位於同層 `typecheck.log`、`rules.log`、`build.log`、`e2e.log`。

本機預覽：<http://127.0.0.1:5173/>。本次沒有部署線上版本。
