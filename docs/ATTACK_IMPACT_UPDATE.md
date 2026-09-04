# 攻擊特效與打擊回饋更新

原本的命中火花只維持 110 ms，光束與彈體偏細，槍口效果還位於角色下方。本次加強六把武器的開火、飛行與命中輪廓，保留原本的傷害、冷卻、碰撞與存檔。

- 槍口新增有方向的亮芯噴焰，特效圖層由 6 移至 9，位於角色 7 上方；敵人預警仍在 90／100 層。
- 脈衝彈的尾跡拉長、增加白色亮芯；砲彈放大並有橙色尾焰。
- 電弧、軌道狙擊及棱鏡光束加粗，保留各自的折線、直線與分節形狀。
- 重力波增加填色與厚輪廓；砲擊增加爆心、放射火焰碎片與衝擊環。
- 命中持續 260 ms，光束／電弧 300 ms，重力／電磁爆發 380 ms，砲擊爆炸 460 ms；先保留清楚輪廓再淡出。以上均採實際時間，3× 不會將它們壓縮成三分之一。
- 敵人受擊反應延長至 180 ms，依實際命中強度短暫壓縮與偏移；只移動畫面，碰撞座標不變。沒有加入全畫面震動。

六種隊長特寫仍為 500 ms，低特效仍保留主要光束、命中爆點與預警。特效仍沿用既有事件容量上限，沒有透過無限堆疊粒子增加強度。

## 畫面

[六把武器 3× 實際演出錄影](../artifacts/validation/attack-impact/demo/six-weapons-3x.webm)（隔離測試情境）。

[狙擊更新前](../artifacts/validation/attack-impact/before-C03.png)／[更新後](../artifacts/validation/attack-impact/after-C03.png)。這些是實際 Canvas 的隔離敵人情境截圖，並非逐像素同步對照。

[3× 砲擊命中](../artifacts/validation/attack-impact/browser/screenshots/chromium-C05-3x-impact.png)、[3× 電弧命中](../artifacts/validation/attack-impact/browser/screenshots/chromium-C02-3x-impact.png)。測試敵人有大量 HP，讓攻擊與命中可重複觀察，不作為通關勝率證據。

## 驗證

- TypeScript、正式 build、120 項規則／存檔測試通過：[規則報告](../artifacts/validation/attack-impact/rule-results.json)。
- Chromium／WebKit 共 70 個不同案例通過，包含六武器在 1×／3× 的命中保留與暫停、六技能、12 E、敵人受擊／死亡與預警：[合併覆蓋結果](../artifacts/validation/attack-impact/browser-coverage.json)。
- 120 敵人、400 彈體、12 區域、三把 E、Boss、自動隊長技能，60 秒真實 3× 迴圈：P95 **27.0 ms**（門檻 33.3 ms），約 90.01 tick/s，最長影格 43.9 ms，預警遺漏 0 frame：[壓測](../artifacts/validation/attack-impact/performance/live-3x-performance.json)。這是 Apple M4、桌面 Chromium／SwiftShader 的人工高密度情境。
- 正式版在 10 Mbps／100 ms RTT 模擬網路下，首頁 654 ms、進入戰鬥 3361 ms；實際取得升級後重新載入，恢復局面、升級選項、3× 與自動隊長技能設定，無 JavaScript 或 HTTP 錯誤：[正式版驗證](../artifacts/validation/attack-impact/production/smoke.json)。

首輪瀏覽器為 69/70 通過；凜月的測試在固定 1.8 秒內沒有觀察到短暫的後座格。改為等待真實戰鬥中完整出現六格，再使用原本的完整斷言，兩個瀏覽器重測通過。初次報告與失敗紀錄保留：[完整首輪](../artifacts/validation/attack-impact/browser/browser-results/results.json)、[針對性重測](../artifacts/validation/attack-impact/pose-recheck/browser-results/results.json)。

模擬、內容、存檔及輸入政策與 Git `7ace394` 逐檔一致：[來源比對](../artifacts/validation/attack-impact/gameplay-source-check.json)。這次沒有重新調整戰鬥數值。

真實手機與真人對打擊感的評價仍需實際遊玩；桌面瀏覽器的通過結果不代表所有手機的效能。
