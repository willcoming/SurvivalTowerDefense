# 敵人逐格動畫更新

> 歷史更新紀錄：本頁描述該次功能與當時量測，內文的新局版本、選卡規則、演出時長及素材數量不全部代表現況。現行 0.3.0-dev.1 規格與驗證請見 [文件總覽](README.md)、[介面與音訊](UI_AUDIO.md)及[交付報告](DELIVERY.md)。歷史命令對應當時的腳本；目前重現方式見 [測試策略](TEST_POLICIES.md)。

更新日期：2026-09-04。補上八種普通／精英敵人及三隻 Boss 的實際逐格動作，沿用 `0.1.0-dev.2` 戰鬥規則與本地存檔。

## 動作與觸發

每種敵人提供 12 張重新繪製的姿勢：兩張待機、六張移動、準備、出手及兩張蓄力。戰鬥場景直接切換透明圖集的格位；移動時的腿、鉗、甲片與浮游翼會改變姿勢。原有受擊閃白、短距離震動及倒下消散接續目前格位播放。

| 敵人 | 移動特徵 | 1× 基礎步態 FPS |
| --- | --- | --- |
| E01 爬行者 | 多足交替爬行、前鉗前伸 | 8 |
| E02 迅刃 | 低伏奔跑、四肢收放與長尾擺動 | 11 |
| E03 重裝 | 重型前肢交替支撐、層甲隨步幅展開 | 6 |
| E04 護盾哨兵 | 浮游甲片交替傾轉 | 7 |
| E05 孢子砲手 | 支腳踏步、砲架穩定，停下蓄力後射擊 | 7 |
| E06 縫合工蜂 | 觸肢交替伸縮、修復時展開 | 7 |
| E07 精英鐵脊 | 沉重踏步、肩甲與重爪收放 | 5.5 |
| E08 精英迅刃 | 急速跨步、刀翼收放與衝刺蓄勢 | 11 |
| B01 群巢播種者 | 重型多足爬行與前鉗交替 | 5 |
| B02 棱盾監工 | 冠狀甲片與推進翼交替開合 | 6 |
| B03 降臨核心 | 穩定爪交替踏步、外環甲片偏轉 | 5.5 |

Boss 原規則是在 y=150 停駐，受位移後才走回原位置；停駐使用待機，沒有為展示步態改成不停前進。E05 在原有 y=250 停下，其他普通敵人在防線前停下。

移動循環依類型、減速和衝刺狀態調整，速度倍率對步態最多乘 1.75，最終上限 **14 FPS**。因此 3× 下仍看得見腿部循環；實際座標、移動速度、傷害、冷卻與波次仍依原 3× 規則運行。

蓄力姿勢由真實 `chargeUntil` 或近戰準備截止時間推進；出手由 `stepEnemies` 實際造成近戰、砲彈、Boss 攻擊、召喚、修復、護盾或衝刺時的標記觸發。一般出手及回復合計 180 ms，B02 連砲依原 0／0.3／0.6 模擬秒脈衝顯示。取消蓄力不會假裝射出攻擊。原有頂部警告、範圍圈與方向線維持最高圖層，低特效仍保留全部敵人的逐格動作。

暈眩定格目前姿勢；暫停、選卡及背景暫停停止動畫時鐘。超過 500 ms 的離開間隔不會追趕動畫。動畫只讀取規則狀態，不反向寫入碰撞、傷害或計時。

## 自動施放隊長技能

技能按鈕右側新增「自動施放」開關，設定頁與暫停設定亦可切換。預設關閉，選擇存入目前瀏覽器，跨戰局及重新整理保留。開啟後，戰鬥正在進行、場上有存活敵人且冷卻完成時，透過原本的 `cast` 指令施放；六位隊長都適用。

手動按鈕仍可使用，自動與手動共用同一冷卻；不會同一 tick 重複施放。暫停、選卡、背景暫停、結算與禁用技能挑戰均不會自動施放。這是固定冷卻的便利操作，沒有額外選擇最佳打斷時機。

舊設定缺少 `autoTactical` 時補為 `false`，戰局保持原樣。

## 本地存檔

敵人新增可省略的 `lastAction: { tick, kind }`，只記錄最近一次實際行動供畫面辨識。舊存檔沒有此欄位仍可恢復，無需升級存檔版本或清除進度。動畫格位與動畫時鐘不寫入存檔；載入時消化已保存的舊行動，避免重播舊射擊。蓄力仍沿用保存的原始截止 tick。

## 素材與重建

11 張原稿由 imagegen built-in 參照既有敵人生成，原始 1536×1024、4×3 格、洋紅背景。包裝腳本去背，按每一列的實際空隙分格，以每種敵人共用的縮放比例置中，保留完整肢體。每格有獨立雜湊；遇到缺格、重複圖像或裁切碰到肢體會停止。

- [實際 Canvas 動作與自動技能錄影](../artifacts/validation/enemy-motion/demo/enemy-motion-and-auto-skill.webm)（隔離測試情境）
- [132 格姿勢總覽](../artifacts/validation/enemy-motion/contact-sheet.png)
- [生成描述](../artifacts/enemy-motion-sources/prompts.json)、[生成紀錄](../artifacts/enemy-motion-sources/generated.json)
- [逐格裁切、雜湊與容量](../artifacts/validation/enemy-motion/assets.json)
- [包裝腳本](../scripts/pack-enemy-motion.cjs)、[執行素材清單](../public/assets/manifest.json)

正式素材是 `public/assets/enemy-animations/<ID>-motion.webp`：普通敵人每格 160²、圖集 640×480；Boss 每格 224²、圖集 896×672。透明 WebP quality 88、alpha quality 100，合計 1,567,864 bytes。一般遊玩、安裝及 build 不需 Sharp 或生成服務。

原稿保存在本機 `artifacts/enemy-motion-sources/`，不納入網站或 Git；正式圖集、生成記錄與包裝腳本納入專案。重建可設定 `SHARP_MODULE` 指向已安裝的 Sharp，再執行 `node scripts/pack-enemy-motion.cjs`。

## 驗證記錄

證據集中於 `artifacts/validation/enemy-motion/`，保留前版基準。動作測試明確使用隔離的敵人位置、大量 HP 和截止時間；它們驗證實際模擬／渲染狀態，不冒充合法構築勝率。平衡另用正式命令與原有固定策略驗證。

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| 規則／存檔 | 120/120 通過，包含 11 種動作、實際行動事件、六名隊長的自動施放條件及舊偏好遷移 | [規則結果](../artifacts/validation/enemy-motion/rule-results.json) |
| 雙瀏覽器流程 | Chromium／WebKit 76/76 通過：六人／12 E／技能、11 種敵人 1×與3×、暈眩／暫停／存檔、完整重播及自動技能 | [完整回歸](../artifacts/validation/enemy-motion/regression/browser-results/results.json) |
| 原規則與重播 | 30/30 通關，三套構築各十種子，所有逐局欄位及最終摘要與原版完全一致 | [比對](../artifacts/validation/enemy-motion/gameplay-regression.json)、[完整 30 局](../artifacts/validation/enemy-motion/final-simulation/balance-runs.json) |
| 3× 實際迴圈壓測 | 120 敵人、400 彈體、12 區域、三把 E、Boss、開啟自動技能；60 秒 P95 26.1 ms，約 89.99 tick/s，預警遺漏 0 frame | [最終壓測](../artifacts/validation/enemy-motion/performance-optimized/live-3x-performance.json) |
| 素材／容量 | 61 項必要素材、62 筆清單；首場保守傳輸 7.85 MB、解碼上界估計 81.34 MB，原門檻通過 | [容量](../artifacts/validation/enemy-motion/asset-budget.json) |
| 正式建置與自動技能 | TypeScript／build 通過；主頁 658 ms、首次戰場 3357 ms；正式版自動施放、實際取得改造、刷新後保留開關／冷卻／候選牌，無 JS／HTTP 錯誤 | [正式驗收](../artifacts/validation/enemy-motion/production/smoke.json) |

壓測為 Apple M4、桌面 Chromium／SwiftShader、390×844。119 名普通敵人以八種原有速度持續移動，到路徑末端才回收位置以維持數量；Boss 持續蓄力，400 發固定敵方彈維持繪圖壓力。規則更新、自動武器、選用的自動隊長技能、區域效果與本地保存持續執行。記錄中每個取樣畫面都保留 119 名移動敵人，八種移動姿勢均完整輪播；400 發敵方彈體圖像也實際存在。此為人工壓力情境，不是合法取得的構築或手機效能。

首次壓測 P95 35.0 ms 超過 33.3 ms，報告保留在 [初次壓測](../artifacts/validation/enemy-motion/performance/live-3x-performance.json)。修正為將相同敵方彈體核心預先繪成小圖，再用可重用 Image 顯示，移動尾跡仍依速度繪製；沒有減少主要彈體、敵人、動畫格或預警。最終最長影格 61.3 ms，未宣稱每一格均低於門檻。

自動技能測試首次因情境未更新已取得改造數量而等待超時；隨後情境過早開啟選卡，遮住要按的開關，該次測試中止。修正測試的初始化與操作順序，沒有繞過選卡遮罩或放寬技能條件。[初次報告](../artifacts/validation/enemy-motion/auto-first/browser-results/results.json)、[中止報告](../artifacts/validation/enemy-motion/auto-retry/browser-results/results.json) 皆保留。

真實 iPhone、Android、實際 Safari 應用程式與真人的可讀性／趣味性驗證依原分工留待後續。桌面 WebKit 不等於實體 iPhone。

[正式版自動施放畫面](../artifacts/validation/enemy-motion/production/auto-tactical-battle.png)。正式載入在 10 Mbps／100 ms RTT、空白瀏覽器環境、HTTP 快取關閉下量測；不使用開發版測試入口。

## 重現

開發服務啟動後：

```sh
npm run typecheck
npm run test:rules
VALIDATION_OUTPUT_DIR=artifacts/validation/enemy-motion/regression npx playwright test tests/e2e/game.spec.ts tests/e2e/animation.spec.ts tests/e2e/enemy-motion.spec.ts tests/e2e/auto-tactical.spec.ts
VALIDATION_OUTPUT_DIR=artifacts/validation/enemy-motion/performance npx playwright test tests/e2e/animation-performance.spec.ts --project=chromium
VALIDATION_OUTPUT_DIR=artifacts/validation/enemy-motion npm run test:simulation
npm run build
VALIDATION_OUTPUT_DIR=artifacts/validation/enemy-motion npm run test:assets
```

壓測時不要同時執行其他瀏覽器工作。停止 dev 後執行 `npm run preview`，再執行 `VALIDATION_OUTPUT_DIR=artifacts/validation/enemy-motion/production npm run test:production`。本機預覽：[開啟遊戲](http://localhost:5173/)。既有頁面重新整理即可載入新動作。
