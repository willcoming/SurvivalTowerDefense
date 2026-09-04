# 六人戰鬥動畫更新

最新已加入 11 種敵人逐格移動與行動動畫，以及可保存的隊長技能自動施放開關，見 [敵人動畫與自動技能更新](ENEMY_ANIMATION_UPDATE.md)。本頁原有測量保留為歷史基準。

更新日期：2026-09-04。沿用內容版本 `0.1.0-dev.2`、30 Hz 規則與現有本地存檔。這次增加角色動作、武器與技能演出，以及敵人受擊／死亡的視覺反應。

## 已確認的交付範圍

六人各有六格重新繪製的 2D 姿勢：待機、準備、瞄準、射擊、後座與回復。射擊、後座、回復各保留約 40 ms，整段 120 ms；1×、2×、3× 都以實際時間播放。瞄準方向跟隨目標，凜月對準最大 HP 最高的敵人。局內 I／II 沿用基礎動畫，E 增加獨立 A／B 武器模組與攻擊形狀。

| 角色／武器 | 可辨識的操作 | 彈道與命中 | E-A／E-B | 隊長技能 |
| --- | --- | --- | --- | --- |
| 璃音／脈衝卡賓槍 | 雙手舉槍、抵肩、槍托後座 | 青色脈衝彈與放射火花 | 三向散射／橙色貫穿晶矛 | 天際掃射：區域鎖定，實際傷害脈衝帶斜向落光 |
| 雷娜／電弧發射器 | 抬起雙叉、充能、放電回彈 | 折線電弧、節點與電磁爆點 | 多節連鎖／六角電磁囚籠 | 電磁靜默：橫向電網與掃描線 |
| 凜月／質量加速狙擊槍 | 蹲姿架槍、貼腮瞄準、長槍後座 | 細長軌道光束、斜向穿刺命中 | 多段貫穿／粗束核心狙擊 | 核心一擊：光束直達實際最大 HP 最高的目標及準星 |
| 米菈／重力投射器 | 雙手托舉、展開浮環、推送晶核 | 引力橢圓、旋轉晶核與菱形命中 | 漩渦場／向上反轉箭紋 | 時差力場：多重引力環與向上推移線 |
| 芙蕾／熔核迫擊砲 | 肩扛重砲、抬高砲口、壓低重心承受後座 | 拋物線熔核彈、火焰與爆炸環 | 燃燒尾焰／超新星大彈核 | 熔星空投：落點爆環、熱浪與放射碎光 |
| 希雅／棱鏡無人機 | 抬起控制器、手勢指令、無人機展開 | 分節棱鏡光束與六角命中 | 雙無人機連線／六角壁壘 | 棱鏡防幕：防線護壁與無人機連結 |

六種技能都使用下方約 **500 ms 的隊長特寫**；傷害、冷卻、敵人行動持續依原規則運行。特寫不延後傷害、不插入戰鬥暫停。原本的手動暫停、選卡、背景暫停會連同動畫時鐘一起停止。勝利時立即記錄通關並保存進度，再保留約 700 ms 讓最後一名敵人倒下消散後進入結算；此時規則 tick 已停止，重新整理不會遺失已保存的勝利。

八種普通／精英敵人與三隻 Boss 都有受擊閃白、短距離震動、倒下縮落、傾斜與消散。一般敵人死亡約 360 ms，Boss 約 650 ms，並有不同輪廓的碎光。敵人動畫使用既有完整圖像加程序變形；不宣稱敵人新增逐格素材或分件骨架。

## 3× 可讀性與效能

敵人預警文字與方向幾何使用獨立最高圖層；隊長特寫位於戰場 y=343–435，預警文字在頂部。攻擊姿勢與技能演出使用未平滑的實際經過時間，避免 WebKit 初期影格平滑拉長 500 ms 特寫。

當敵人達 65、彈體達 100、近期影格變慢，或玩家開啟低特效時，減少火焰、粒子、碎片與電弧裝飾。所有實際彈體、技能區域與預警仍繪製。特效事件有容量上限，重要技能／Boss 死亡及主要攻擊另行保留。

新動畫不寫入戰局存檔。載入時從快照的武器攻擊計數及最新事件序號開始，不會重播已保存的舊技能；新視覺事件欄位皆可省略，既有存檔可沿用。

## 美術來源與重建

六張動作表以 imagegen built-in 實際生成，參照既有角色身份與武器，每張包含六個不同姿勢。原稿為 1536×1024、洋紅背景；包裝階段去背、依格線裁切、統一縮放並對齊腳底。

- 執行素材：`public/assets/animations/C01-motion.webp` 至 `C06-motion.webp`，每張 768×512、3×2 格、每格 256×256、透明 lossless WebP。
- 新增六張共 **1,565,042 bytes**；正常遊玩與 build 不需要生成工具或 Sharp。
- [生成描述](../artifacts/animation-sources/prompts.json)、[生成紀錄](../artifacts/animation-sources/generated.json)、[素材清單](../public/assets/manifest.json)。
- [包裝腳本](../scripts/pack-animation-assets.cjs)；重建需要本機 Sharp，以 `SHARP_MODULE` 指向其模組路徑。
- 原始 PNG 保留在本機 `artifacts/animation-sources/`，不納入網站與 Git；生成描述、腳本、正式素材納入專案。
- [36 格姿勢總覽](../artifacts/validation/animation-update/all-36-poses.png)、[素材裁切與雜湊記錄](../artifacts/validation/animation-update/assets.json)。

## 驗證記錄

所有動畫、流程與效能證據置於 `artifacts/validation/animation-update/`，不覆寫首版交付報告。

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| 規則／存檔 | 97/97 通過；含主要攻擊保留、傷害／XP 帳、目標資訊與暫停契約 | [規則結果](../artifacts/validation/animation-update/rule-results.json) |
| 雙瀏覽器流程與動畫 | Chromium／WebKit 54/54；六人各六格、六技能 1×／3×、12 E 各 1×／3×、11 種敵人、暫停／刷新、五次完整重播 | [瀏覽器結果](../artifacts/validation/animation-update/browser-results.json) |
| 最後一擊與結算 | 新增 4 項雙瀏覽器邊界檢查，並重跑 4 項暫停／完整重播；8/8 通過。演出期間 tick 不增加、通關立即保存、刷新只記錄一次勝利 | [結算邊界結果](../artifacts/validation/animation-update/finale-results.json)、[實際倒下畫面](../artifacts/validation/animation-update/screenshots/chromium-final-boss-mid-collapse.png) |
| 原規則回歸 | 三套構築 × 十種子共 30/30 通關，全部逐局欄位與原版完全相同，含傷害、時間、指令及最終模擬摘要 | [比對結果](../artifacts/validation/animation-update/simulation/gameplay-regression.json)、[30 局](../artifacts/validation/animation-update/simulation/balance-runs.json) |
| 3× 動態壓力 | 120 敵人、至少 400 彈體、12 區域、三把 E、Boss，60 秒實際 3× 規則與繪圖；P95 **30.1 ms**，門檻 33.3 ms；每秒 90.01 tick，預警遺漏 0 frame，無自動暫停或 JavaScript 錯誤 | [完整壓測](../artifacts/validation/animation-update/live-3x-performance.json) |
| 正式 build／預覽 | TypeScript 與 Vite build 通過；正式包無開發入口，3× 真實遊玩取得改造、選卡與刷新恢復通過。主頁 658 ms、首場就緒 3,386 ms，無 JS／HTTP 錯誤 | [正式驗收](../artifacts/validation/animation-update/production/smoke.json) |
| 素材／容量 | 50 項必要素材、51 筆 manifest，無缺檔；首場保守傳輸 6.19 MB、解碼估計 64.29 MB，皆低於原門檻 | [容量報告](../artifacts/validation/animation-update/asset-budget.json) |

本次壓測在 Apple M4、macOS ARM64、Chromium 151、SwiftShader 軟體繪圖、390×844 上執行。以不死固定敵人與靜止敵方彈維持壓力；真實模擬迴圈、自動武器、隊長技能、受擊動畫、區域傷害與存檔持續運作。這與原版暫停規則的純繪圖壓測不同；它仍是人工高密度情境，不代表手機實際戰鬥效能。最長單一影格 47.9 ms，P95 30.1 ms，沒有宣稱所有影格均低於門檻。

[六種技能畫面](../artifacts/validation/animation-update/six-skills-contact.png)、[12 種進化畫面](../artifacts/validation/animation-update/twelve-evolutions-contact.png)、[3× 壓力畫面](../artifacts/validation/animation-update/screenshots/live-3x-pressure.png)。以上流程合計 58 個不同瀏覽器案例。來源雜湊隨效能／平衡報告保存；報告的 `sourceRevision` 是執行前的 Git 基準，實際測試來源以 `sourceDigest` 為準。

六人技能測試使用正常戰鬥與 DOM 按鈕；12 種 E 與 11 種敵人使用明列的視覺測試情境，不當作合法取得進化或平衡勝率證據。規則回歸另用正式命令重播與三套構築、十種固定種子。

初次瀏覽器驗證為 44/54 通過，失敗報告保留在 [browser-results-initial.json](../artifacts/validation/animation-update/browser-results-initial.json)。修正項目為未平滑的動畫計時、按指定敵人 ID 等待受擊／死亡，以及測試報告輸出目錄建立；沒有調低敵人數值、改動技能冷卻或放寬 500 ms 演出規格。

真實 iPhone／Android、實際 Safari 應用程式與真人可讀性／趣味性驗證尚未執行。桌面 Chromium／WebKit 的通過結果不等於實體手機測量。


## 重現與啟動

開發伺服器啟動後，執行：

```sh
npm run test:rules
VALIDATION_OUTPUT_DIR=artifacts/validation/animation-update/regression npx playwright test tests/e2e/animation.spec.ts tests/e2e/game.spec.ts
npx playwright test tests/e2e/animation-performance.spec.ts --project=chromium
VALIDATION_OUTPUT_DIR=artifacts/validation/animation-update/simulation npm run test:simulation
npm run build
VALIDATION_OUTPUT_DIR=artifacts/validation/animation-update npm run test:assets
```

停止 dev 後執行 `npm run preview`，再用 `VALIDATION_OUTPUT_DIR=artifacts/validation/animation-update/production npm run test:production` 檢查正式版。dev 與 preview 共用 5173，不能同時占用。

本機：[開啟遊戲](http://localhost:5173/)；手機與電腦同一個 Wi-Fi 時：[區網遊戲](http://192.168.68.110:5173/)。網址來源不同會使用不同本地存檔。已有頁面請重新整理載入新素材。
