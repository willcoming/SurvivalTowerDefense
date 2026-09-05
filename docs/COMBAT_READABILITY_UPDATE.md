# 普攻射程、狀態與 Boss 登場更新

> 歷史更新紀錄：本頁描述該次功能與當時量測，內文的新局版本、選卡規則、演出時長及素材數量不全部代表現況。現行 0.3.0-dev.1 規格與驗證請見 [文件總覽](README.md)、[介面與音訊](UI_AUDIO.md)及[交付報告](DELIVERY.md)。歷史命令對應當時的腳本；目前重現方式見 [測試策略](TEST_POLICIES.md)。

新戰局內容版本為 `0.1.0-dev.3`。此文件補充原 MVP 規格，取代原全域普攻索敵及 Boss 直接出現的行為。敵人、波次、傷害數值、攻擊間隔、改造路線和解鎖政策維持原資料；射程改變帶來新的出手時機。

## 射程與操作

| 角色 | 距離分類 | 實際半徑 |
| --- | --- | --- |
| 璃音 C01 | 中程 | 410 |
| 雷娜 C02 | 近程 | 335 |
| 凜月 C03 | 遠程 | 560 |
| 米菈 C04 | 近程 | 335 |
| 芙蕾 C05 | 遠程 | 530 |
| 希雅 C06 | 中程 | 410 |

距離依 390×520 戰場上的共同邏輯發射點 `(195,490)` 計算，目標碰撞圓接觸範圍即能索敵。角色左右編隊順序仍不改變戰力；顯示的槍口與動作保持角色各自位置。遠程武器可提早攔截，近程武器等待敵人靠近；等待不消耗攻擊或冷卻。最短射程仍能碰到三位 Boss 的固定位置及砲擊兵停駐點，沒有強制帶遠程角色的距離死局。

射程只限制普攻主目標。電弧從合法目標繼續跳躍、爆炸與地面場依自己的半徑擴散；隊長技能保留原規則。璃音的穿透彈另有飛行距離上限，凜月的直線貫穿也不越過射程索敵，光束畫到實際最遠命中目標。

戰鬥下方每人顯示射程分類與武器等級。點頭像開啟覆蓋線，再點關閉，另一人會取代當前選擇；沒有合法目標時顯示「等待敵人進入射程」。新增獨立「構築」按鈕，保留原查看路線功能。

## 命中與狀態

- 爆炸從生效起保留固定的實際範圍圓；外擴火花只是裝飾。事件記錄當次真正命中的敵人 ID，密集場景仍可一起閃白。
- 火場、重力場的外緣依實際半徑繪製，持續到場真正結束，沿用每場最多 20 目標等既有規則。
- 燃燒顯示四格附著火焰與橘色傷害數字，修正舊攻擊事件占滿佇列後壓掉新燃燒提示的問題；數字只取實際 burn hit，包含盾及 HP 的實際扣除。全特效最多 12 組、簡化最多 6 組；700 ms 內同敵人或鄰近區域合併，避免重疊，每幀每組只更新一次文字。
- 緩速顯示腳下環；暈眩顯示頭頂符號並停止步態；曝露顯示四角鎖定框。全部依狀態到期時間移除，持續燃燒不會憑空生成地面火場。
- 狀態圖樣事先打包成同一張圖集，持續動畫重用圖片；避免每種狀態切換獨立紋理，並只在動畫換格時更新影格。保留原密集場景簡化與預警最高圖層。

## Boss 登場與存檔

在第 10,800 tick 完成當前結算後，建立 Boss 並暫停戰鬥。警示、傳送門、放大現身、名稱依序呈現，B01 使用三角環繞、B02 使用六角護環、B03 使用放射裂光。每次共 1500 ms 現實時間，1×／2×／3× 相同；完成後才開始下一個規則 tick。

登場期間武器、敵人、彈體、場、DoT、倒數、技能冷卻及自動技能均不前進。手動／背景／方向／選卡等其他暫停優先，會保留剩餘登場時間；大於 500 ms 的畫面中斷不會直接跳過動畫。Boss 的 ID 與剩餘毫秒一起保存，載入後接續；完成命令只接受一次並納入可重播操作紀錄。

`0.1.0-dev.2` 戰局繼續使用舊全域索敵、彈道及 Boss 出現結算位置，不插入新登場暫停。純視覺改善仍可套用。schema 維持 1，角色／關卡解鎖與本地偏好不變；未知內容版本仍保留資料並提示恢復。

## 驗證紀錄

- 規則與存檔 141 項通過，包括六人邊界、無目標不消耗冷卻、次生攻擊越界、穿透彈終點、Boss 可達、登場中斷／恢復。[規則報告](../artifacts/validation/combat-readability/final-rule-results.json)。三套更新前 `cbb2128` 的保存快照與完整操作重播，最終狀態雜湊逐一相同。
- 三套構築各 10 個固定種子，共 30/30 通關且完成核心三 E；有效戰鬥時間 407.77–468.53 秒。完整指令純模擬重播通過：[正式平衡與重播](../artifacts/validation/combat-readability/ship/)。
- 初次對照只有兩項通過，原結果保留：[初次對照](../artifacts/validation/combat-readability/formal/comparisons.json)。依事前新增 CMP06 政策重跑後，三種構築的合法調整分別降低防線損血 40%、46.15%、25%；另外三個假說仍標記失敗：[完整六項對照](../artifacts/validation/combat-readability/ship/comparisons.json)。沒有調高傷害或更改敵人來取得通過：[原始內容與敵人來源比對](../artifacts/validation/combat-readability/unchanged-data.json)。

桌面瀏覽器與高密度測試使用明確標記的呈現用情境；它們不當作合法通關證據，也不等於手機真機效能或真人趣味性評價。正式平衡僅使用正常建立的戰局與合法命令。

瀏覽器回歸初次 118 項中 114 項通過；4 項近程動作測試原本假設混合隊伍在前 12 秒內每人都射擊，但遠程隊友會先清掉目標。改用正常單人隊伍，仍要求實際遊戲循環呈現全部六格動作、1×／3× 技能與暫停行為，複驗 4/4 通過。原始失敗保留於 [回歸報告](../artifacts/validation/combat-readability/regression/browser-results/results.json)，修正後見 [動作複驗](../artifacts/validation/combat-readability/pose-recheck/browser-results/results.json)。

新功能在兩個瀏覽器各 9 項情境通過，包含三位 Boss 在 1×／3× 的 1500 ms 出場、模擬凍結、保存續播、自動技能延後、真實範圍命中、四種狀態及到期。320／768／1024／1440px 的射程操作無水平溢出，新增按鈕皆至少 44×44px：[版面複驗](../artifacts/validation/combat-readability/layout-recheck/browser-results/results.json)。

最後的圖集、持續事件與渲染調整後，針對新功能及密集預警再跑雙瀏覽器 **20/20** 通過：[最終畫面驗證](../artifacts/validation/combat-readability/final-visual/browser-results/results.json)。[320px 射程](../artifacts/validation/combat-readability/final-visual/screenshots/chromium-range-320.png)、[範圍與狀態](../artifacts/validation/combat-readability/final-visual/screenshots/chromium-statuses-fire.png)、[Boss 登場](../artifacts/validation/combat-readability/final-visual/screenshots/chromium-S03-3x-entrance.png)。

60 秒高密度實測維持 **120 敵人、400 彈體、12 持續區域、3× 與自動隊長技能**。最終 P95 **26.1 ms**、最長影格 **26.7 ms**，約 **90.01 tick/s**，預警遺漏 **0 frame**，場上仍有 115 個帶狀態的敵人：[最終效能報告](../artifacts/validation/combat-readability/performance-ship/live-3x-performance.json)。

前面三次壓測的 P95 為 34.0、34.4、34.0 ms，超過 33.3 ms 門檻，結果保留於 `performance/`、`performance-atlas/`、`performance-final/`。最終採同一張狀態圖集、每幀合併文字、密集時減少次要命中光暈，並關閉 WebGL 多重取樣，保留角色貼圖線性過濾；未減少壓測數量、改變模擬速度或提高門檻。正式瀏覽器雙引擎畫面複驗已涵蓋這些調整。

正式 build 與 61 項必要素材檢查通過。正式 preview 在 10 Mbps／100 ms RTT、空白瀏覽器快取下，首頁可互動約 **633 ms**、戰場就緒約 **3358 ms**。以正常操作實際取得第一次升級、確認選牌，再重載恢復同一戰局、RNG、3× 與自動技能設定，沒有 JS 或 HTTP 錯誤，且正式版沒有開發測試入口：[正式版煙霧測試](../artifacts/validation/combat-readability/production/smoke.json)。

交付來源與最終平衡／效能量測來源雜湊一致：[來源一致性](../artifacts/validation/combat-readability/final-source-check.json)。正式版使用 `npm run preview`，固定在 [localhost:5173](http://localhost:5173/)；重新整理後開新局即可體驗全部新規則。
