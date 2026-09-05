# 星骸防線：黎明反攻 — 可玩版交付

> 歷史快照：2026-09-05 文件同步前保存。下列「目前／尚未」及數值描述當時狀態，不是現行需求或驗收結論。現行文件見 [文件總覽](../README.md) 與 [DELIVERY.md](../DELIVERY.md)。

最新已加入 11 種敵人逐格移動與行動動畫，以及可保存的隊長技能自動施放開關，見 [敵人動畫與自動技能更新](../ENEMY_ANIMATION_UPDATE.md)。本頁原有測量保留為歷史基準。

後續已加入最高 3× 加速及六人戰鬥動畫，操作與新增驗證見 [戰鬥加速更新](../SPEED_UPDATE.md) 與 [動畫更新](../ANIMATION_UPDATE.md)。以下保留首版交付的測量與版本基準。

交付日期：2026-09-04。套件版本 `0.1.0`，遊戲內容 `0.1.0-dev.2`，自動策略 `policy-v3`。遊戲程式基準為 Git `34c6002`；後續交付提交只補測試選擇器、文件與驗證證據。

## 開始遊玩

- 電腦：[開啟遊戲](http://localhost:5173/)
- 手機連接與電腦相同 Wi-Fi：[開啟區網遊戲](http://192.168.68.110:5173/)

本次交付已啟動正式 `dist/` 的預覽服務。主機需保持開機且服務持續執行；區網 IP 可能隨網路改變。日後重新啟動，請在專案資料夾執行：

```sh
npm ci --no-audit --no-fund
npm run build
npm run preview
```

原始碼、鎖定依賴、測試、文件與本機素材皆在專案內；`dist/` 是已產生的靜態網站。尚未公開部署。完整操作與開發命令見 [README](../../README.md)。

## 已交付內容

六位成年美少女、自由選擇 1–5 人與隊長、六把專屬外星科技武器、12 條改造路線、三關與三個 Boss。武器自動攻擊，玩家以選卡、組隊及施放隊長技能決策；成功局的有效戰鬥時間為六至八分鐘，暫停與選卡不計時。

角色與武器路線初始開放，沒有永久戰力等級、抽卡、體力或刷材料。通關解鎖後續關卡、故事與挑戰。主頁、情報、編隊、教學、戰鬥、改造、暫停、結果、圖鑑、設定與恢復流程均已整合。

IndexedDB 保存進度與完整戰局，包括敵人、彈體、狀態效果、冷卻、隨機狀態及原候選牌。每五秒與關鍵操作保存，重新開啟可繼續最近成功保存點。多分頁使用修訂版本阻止舊頁覆寫；損壞或不相容資料會保留並提供恢復選項。不同瀏覽器、localhost 與區網 IP 各有獨立存檔，沒有雲端同步。

## 工程驗收

| 項目 | 實際結果 | 證據 |
| --- | --- | --- |
| 規則與存檔 | 86/86 通過，包含確定性、武器／敵人時序、候選牌保存、交易與分頁衝突 | [測試報告](../../artifacts/validation/0.1.0-dev.2/rule-results.json) |
| 瀏覽器流程 | Chromium／WebKit 共 10/10 通過；各五局合法命令重播及主頁循環，結算後戰場 Canvas 與 activeRun 清除 | [流程報告](../../artifacts/validation/0.1.0-dev.2/browser-results/results.json)、[Chromium](../../artifacts/validation/0.1.0-dev.2/browser-results/chromium-replay-cycles.json)、[WebKit](../../artifacts/validation/0.1.0-dev.2/browser-results/webkit-replay-cycles.json) |
| 最終平衡與重播 | 三套構築各十種固定種子，S03 共 30/30 通關，30/30 完成三個核心 E；命令重播一致 | [30 局報告](../../artifacts/validation/0.1.0-dev.2/balance-runs.json)、[重播](../../artifacts/validation/0.1.0-dev.2/replay-results.json) |
| 決策對照 | 三項有效技能時機比較，防線損血改善 25%、30%、33.33%；另外兩項假說失敗並保留 | [完整對照](../../artifacts/validation/0.1.0-dev.2/comparisons.json)、[策略與失敗解讀](TEST_POLICIES_AB.md) |
| 桌面動態繪圖壓力 | 120 敵人、400 彈體、12 區域、三把 E、Boss，持續 60 秒；P95 26.5 ms，門檻 33.3 ms | [動態壓測](../../artifacts/validation/0.1.0-dev.2/browser-results/desktop-render-performance-dynamic.json) |
| 純模擬壓力 | 1,800 次高密度核心更新，P95 2.491 ms | [模擬壓測](../../artifacts/validation/0.1.0-dev.2/simulation-pressure.json) |
| 美術與容量 | 44 項必要圖像完整，另有 1 項備用圖集；沒有缺檔或無效清單 | [素材容量報告](../../artifacts/validation/0.1.0-dev.2/asset-budget.json)、[素材說明](../ART_ASSETS.md) |
| 乾淨安裝與建置 | 新暫存目錄 `npm ci` 成功；TypeScript 與正式 build 通過 | [乾淨安裝](../../artifacts/build/clean-install.json) |
| 正式預覽 | 無開發測試入口；主頁可操作 619 ms、首次戰場就緒 2,858 ms；真實時間取得改造後刷新，原候選牌／隨機狀態／tick 還原，選卡及暫停保存成功；無 JavaScript 或 HTTP 錯誤 | [正式驗收](../../artifacts/validation/0.1.0-dev.2/production/smoke.json)、[主頁](../../artifacts/validation/0.1.0-dev.2/production/home.png)、[實際改造](../../artifacts/validation/0.1.0-dev.2/production/earned-upgrade.png) |

正式預覽的載入時間來自桌面 Chromium、390×844、10 Mbps／100 ms RTT 模擬網路、空白瀏覽器環境與停用 HTTP 快取的單次測量，門檻分別為 5 秒與 10 秒。測試只讀取 IndexedDB 驗證快照，沒有使用加速入口或改寫戰局。

容量採保守上界：主頁傳輸約 1.24 MB、首次戰鬥約 4.59 MB；全部素材及去背副本與戰場快取的解碼估算約 54.85 MB。估算包含所有素材而非僅當局素材，程式使用實測 gzip；不包含瀏覽器與 GPU 配置額外開銷。

## 證據的適用範圍

上述自動化在 Apple M4、macOS ARM64、Node 22.22.3 上執行。Chromium 壓測使用 ANGLE SwiftShader 軟體繪圖。動態壓測固定高密度、暫停遊戲規則並以 30 Hz 改變位置及事件，驗證畫面更新；純模擬壓測另測核心運算。兩項不能相加推算手機實際 FPS，也不代表已量過連續真實戰鬥的最差手機效能。

瀏覽器流程以開發版限定命令加速合法戰局，並對照純模擬結果；沒有修改戰鬥數值來通關。正式建置不公開測試入口。平衡結果只涵蓋記錄的隊伍、策略與種子，不表示所有自由搭配均能過關，也不取代真人的理解度與趣味性驗證。

先前兩次桌面壓測超標、CMP02／CMP04 對照失敗與初次正式煙霧測試的重複選擇器錯誤，都保留在驗證資料夾。最後修正包含戰場繪圖快取與 HUD 更新快取，並沒有降低壓測數量或放寬門檻。

實際 iPhone Safari、中階 Android Chrome、實際 Safari 應用程式及五位真人測試尚未執行；後續使用 [真機與真人測試表](../EXTERNAL_PLAYTEST.md)。目前交付結論為可玩且完成上述工程驗證。

## 文件與素材

- [遊戲規格](MVP_SPEC_INITIAL.md)、[原執行計劃](EXECUTION_PLAN_INITIAL.md)、[完成狀態](IMPLEMENTATION_STATUS_INITIAL.md)
- [最終實作決策](../DECISIONS.md)、[驗收矩陣](VALIDATION_MATRIX_INITIAL.md)、[UI 與音訊](../UI_AUDIO.md)
- [畫面驗證截圖](../../artifacts/ui/)、[素材來源與整合方式](../ART_ASSETS.md)

原規格中的初始武器數值已依合法構築測試調整；最終數值與例外在實作決策中記錄。Boss 使用完整原創圖像加程序狀態效果，沒有宣稱核心與外殼已拆圖。備用特效圖集尚未接入戰場，實際戰鬥特效由程序繪圖完成。圖像原稿及生成紀錄保存在本機 `artifacts/art-sources/`，不進入網站 `public/` 或 Git；執行遊戲所需素材已全部納入專案。
