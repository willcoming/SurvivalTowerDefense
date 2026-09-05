# 可玩版交付與驗證

> 本文件保留 0.3 基礎規格／驗證。0.4 現行獎池、八人、15 關、186 節點及新增驗證以 [星際夏日更新](COLLECTION_UPDATE.md) 為準；下文的六人、三關、無招募等描述不再代表現行完整範圍。

**星骸防線：黎明反攻 · 內容版本 0.3.0-dev.1 · 2026-09-05**

自由技能樹工程版已完成，可在本機或同 Wi-Fi 手機遊玩。規則、流程、本地存檔、畫面與自動化驗證均已交付；本頁數據引用既有驗證報告，文件同步沒有產生新的測量。初版 0.1 交付數據另存於 [歷史報告](history/DELIVERY_INITIAL.md)。

## 開始遊玩

```sh
npm ci --no-audit --no-fund
npm run build
npm run preview
```

電腦開啟 [本機遊戲](http://localhost:5173/)，手機使用 preview 終端輸出的 `Network` 網址，主機需保持開機且預覽服務運行。區網 IP 會隨網路改變，請以當次輸出為準。dev 與 preview 共用固定 5173 埠，不同時啟動；完整啟動及測試命令見 [README](../README.md)。

`dist/` 是已建置的靜態網站，尚未公開部署。載入最新網站後，新開一局才使用 0.3 自由技能樹；目前未完成的舊局繼續原版本規則，不清除關卡進度或偏好。

## 已交付內容

- 六位角色自由選擇 1–5 人出戰、六把專屬武器、三關與三位 Boss，維持靠搭配取勝的單人六至八分鐘流程。
- 14 條不對稱角色樹，138 個角色節點＋12 個共用節點；25 終極、每人最多一個、全隊最多三個。
- 每 60 XP 自動開樹並提供 2 點，全局 24 點；從完整樹預覽並確認取得，本次點數必須花完，可暫存半途配置。
- 隊長開局先冷卻 45／50 秒，支援手動／自動與 1×–3×；固定敵情、波次變體與事件可供配點判斷。
- 六人射擊與技能、武器彈道、實際範圍及狀態、敵人移動／受擊／死亡、三個 Boss 出場，3× 維持預警優先。
- IndexedDB 完整戰局、定期與事件保存、分頁衝突保護及舊版本續玩；沒有登入、永久戰力或刷取資源。

25 個終極使用既有武器／角色素材與程序特效表現機制，並非 25 套新插畫動畫。詳細玩法見 [MVP 規格](MVP_SPEC.md)與[自由技能樹規格](FREE_SKILLS.md)。

## 驗證結果

彙總時間：2026-09-05 03:57:58 UTC（台北 11:57:58）。[機器可讀交付摘要](../artifacts/validation/free-skills/release-summary.json)記錄內容版本、逐案例來源與 sourceDigest。

| 項目 | 本次結果 | 證據 |
| --- | --- | --- |
| 規則與存檔 | **254 項通過** | [規則日誌](../artifacts/validation/free-skills/rules-final.log) |
| 瀏覽器回歸 | **150 個獨立案例：147 通過、3 跳過**；三項為 WebKit 不適用的 Chromium 桌面效能情境 | [逐案例合併摘要](../artifacts/validation/free-skills/release-summary.json) |
| 正式構築研究 | **1,500／1,500 通關**，有效時間 373.5–415.0 秒；全局 24 點，受測角色投入符合 5／7 點 | [完整分組與逐局資料](../artifacts/validation/free-skills/balance.json) |
| 保存與命令重播 | 1,500 場皆在第 7 點保存／恢復成功；50 份完整命令重播摘要一致 | [研究結果](FREE_SKILL_VALIDATION.md) |
| 機制診斷 | **200 個合成探針**，25 終極 × 八種情境；與正式通關分開 | [探針資料](../artifacts/validation/free-skills/matchups.json) |
| 3× 活動戰鬥壓力 | 60 秒桌面量測，影格 p95 **26.6 ms**、約 **90.0084 tick／秒**，預警遺失 **0**；至少 120 敵人、400 敵彈、13 場域 | [活動壓測](../artifacts/validation/free-skills/pressure-final/live-3x-performance.json) |
| 正式 preview | 10 Mbps／100 ms RTT：主頁 **698 ms**、首場 **3,401 ms**；真實取得 XP、花 1 點後重載續配成功；首次自動技能第 **50 秒**，無提前施放、頁面錯誤或失敗請求 | [正式版驗證](../artifacts/validation/free-skills/production/smoke.json) |
| 素材 | 61 項必要素材、62 筆 manifest，無缺失／無效；保守首頁 1,276,272 bytes、首場 7,882,038 bytes、解碼估計 81,340,864 bytes | [素材與容量](../artifacts/validation/free-skills/final-assets/asset-budget.json) |
| 型別與建置 | typecheck、正式 build、差異格式檢查通過；正式版無開發測試 API | [交付摘要](../artifacts/validation/free-skills/release-summary.json)及[正式版驗證](../artifacts/validation/free-skills/production/smoke.json) |

瀏覽器總數依同一檔案、案例名稱與瀏覽器去重，採最後一次結果；不是把重跑次數相加。初次回歸的失敗與修正報告仍保留，索引為 `regression`、`fixes`、`captain-final`、`pressure-final`。其中舊測試的立即施放／18 點假設與隊長等待流程已修正；方法見 [驗收矩陣](VALIDATION_MATRIX.md)。

## 結論的適用範圍

正式 1,500 場使用固定代表性隊伍及配對種子，支持這些構築可玩、預算合法且可重播。全勝可能受強力隊友與勝率飽和影響，不能證明任意搭配、任意單人隊伍或每條樹同等強度。技能樹總數目前保留不對稱，研究下一步見 [測試策略](TEST_POLICIES.md)。

3× 活動壓測使用桌面 M4 的 Chromium／SwiftShader，包含高生命移動敵人與無傷害壓力敵彈，武器、技能、渲染及保存正常運行。它用來驗證負載與時鐘，不是合法關卡通關或手機效能證據。正式載入量測使用 Chromium 151.0.7922.34、390×844 手機模擬視窗與停用快取。

活動壓測開始後曾調亮 HUD 事件文字顏色，模擬與幾何未變；後續暫停及動態渲染檢查使用最終 CSS。來源雜湊與這項時間差保留在交付摘要的 `performanceSourceNote`，不將所有量測描述成完全同時的來源快照。

真實 iPhone／Android、實際 Safari 應用程式及五位真人測試仍待執行；使用 [外部測試表](EXTERNAL_PLAYTEST.md) 記錄。工程完成狀態與後續工作分別見 [實作狀態](IMPLEMENTATION_STATUS.md)及[執行計劃](EXECUTION_PLAN.md)。
