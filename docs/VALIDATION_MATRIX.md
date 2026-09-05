# 工程驗收矩陣

**0.3.0-dev.1 · 2026-09-05 同步**。本頁將現行需求對應到實際測試與證據；原 A/B 時代的 DRAFT、BAL、AC 等案例編號見 [歷史驗收矩陣](history/VALIDATION_MATRIX_INITIAL.md)，不將其中的三選一／18 點條件套用到新局。

## 1. 需求追溯

| 需求 | 現行驗證方式 | 狀態 |
| --- | --- | --- |
| R01 手機直向單人 | 320–1440 px 版面、鍵盤及瀏覽器完整流程；真機另測 | 工程通過，真機待測 |
| R02 原創外星反攻 | 三關故事、敵情、六人圖鑑與本機素材 | 已實作，真人理解待測 |
| R03 六人選 1–5 人 | 編隊合法性、隊長限制、完整遊戲流程 | 通過 |
| R04–R05 專屬武器與 14 樹 | 138 角色＋12 共用節點、前置、終極可達、六人無配點死路 | 通過 |
| R06 自動戰鬥＋自由配點 | 真實 XP 升級、預覽不扣點、明確購買、唯讀樹、手動技能 | 通過 |
| R07 六至八分鐘 | 1,500 場固定構築為 373.5–415.0 秒；暫停／加速／Boss 計時 | 代表樣本通過 |
| R08 XP 與強制消費 | 每 60 XP 得 2 點、12 次／24 點；不能留點返回，可半途存檔 | 通過 |
| R09–R10 組隊過關、局外解鎖 | 合法模擬與瀏覽器三關重播，結算只解鎖內容 | 工程通過，真人調整能力待測 |
| R11 本地存檔 | IndexedDB、完整快照、revision、錯誤恢復、版本相容 | 通過 |
| R12 動畫與視覺 | 六人普攻／技能、敵人移動與死亡、射程、狀態、Boss 及 3× 預警 | 工程通過，真機辨識待測 |
| R13 多構築實驗 | 25 終極、兩預算、三關、十配對種子；診斷探針另列 | 本輪完成，全面平衡未證實 |
| R14 隊長技能 | 六人初始完整冷卻，手動／自動、挑戰限制、暫停及保存 | 通過 |

## 2. 現行規則與恢復案例

下列每列是案例群，不能將列數當作測試數量。實際規則／存檔總計 **254 項通過**，來源為 [rules-final.log](../artifacts/validation/free-skills/rules-final.log)。

| 案例群 | 驗收重點 | 測試來源 |
| --- | --- | --- |
| FREE-DATA | 150 節點、14 樹、25 終極；前置存在、合法順序、同樹四點門檻 | [deep-tree.test.ts](../tests/rules/deep-tree.test.ts) |
| FREE-BUDGET | 每 60 XP／2 點、上限 24；重複與過期購買拒絕、只預覽不花點、單人合法選點不死路 | [deep-tree.test.ts](../tests/rules/deep-tree.test.ts) |
| FREE-LIMIT | 每人一終極、全隊三個／挑戰兩個；普通及共用節點仍可配置 | [deep-tree.test.ts](../tests/rules/deep-tree.test.ts) |
| FREE-PAUSE | XP 暫停、預警延後最多 60 tick、Boss 演出後開樹、勝利前用完所得點數 | [deep-tree.test.ts](../tests/rules/deep-tree.test.ts)、[timing.test.ts](../tests/rules/timing.test.ts) |
| FREE-MECHANICS | 側翼／連發、電弧回流／磁暴、貫穿／處決、引力／碰撞、子爆炸／傳火、五機／導彈的實際結果 | [deep-tree.test.ts](../tests/rules/deep-tree.test.ts) |
| FREE-SUPPORT | 被動修復、護盾、擊退、反射；緊急修復只從購入後開始計算傷害 | [deep-tree.test.ts](../tests/rules/deep-tree.test.ts) |
| FREE-INTEL | 同種子波次計畫、敵人名稱／數量、護盾／裝甲比與實際變體一致；重載不重抽 | [deep-tree.test.ts](../tests/rules/deep-tree.test.ts) |
| CAPTAIN | 新局 45／50 秒初始冷卻、縮減後比例更新、自動需敵人與可運行狀態、禁用技能挑戰 | [auto-tactical.test.ts](../tests/rules/auto-tactical.test.ts)、[deep-tree.test.ts](../tests/rules/deep-tree.test.ts) |
| COMBAT | 傷害、護盾、狀態、彈體參數、敵人時序、射程與 Boss 登場 | [combat](../tests/rules/combat.test.ts)、[weapons](../tests/rules/weapons.test.ts)、[enemies](../tests/rules/enemies.test.ts)、[range-entrance](../tests/rules/range-entrance.test.ts) |
| SAVE | 半途配點、完整快照、序列寫入、分頁衝突、損壞與儲存拒絕處理 | [repository.test.ts](../tests/storage/repository.test.ts)及[自由技能樹流程](../tests/e2e/free-skills.spec.ts) |
| LEGACY | 0.2 的 70 節點三選一、0.1 dev.2／dev.3 原 A/B 行為維持 | [skill-tree.test.ts](../tests/rules/skill-tree.test.ts)、[draft.test.ts](../tests/rules/draft.test.ts)、[tree-replay.spec.ts](../tests/e2e/tree-replay.spec.ts) |

## 3. 瀏覽器與正式交付

瀏覽器採 Chromium／WebKit。獨立案例鍵為「檔案＋案例名稱＋瀏覽器」，依序合併 `regression`、`fixes`、`captain-final`、`pressure-final` 的最後結果：**150 個案例，147 通過、3 跳過**。三項跳過是僅適用 Chromium 的桌面效能測試，不能記成 WebKit 效能已通過。[逐案例證據](../artifacts/validation/free-skills/release-summary.json)

| 案例群 | 驗證內容 | 來源 |
| --- | --- | --- |
| B-FREE | 真實 XP 開樹、先預覽再買、花 1 點暫存離開／重載、Escape 不能跳過、點數與敵情不變 | [free-skills.spec.ts](../tests/e2e/free-skills.spec.ts) |
| B-GRAPH | 終極互斥與跨樹普通節點、共用三路、前置線、320／768／1024／1440 px 捲動與固定確認區 | [free-skills.spec.ts](../tests/e2e/free-skills.spec.ts) |
| B-READONLY | 3× 唯讀樹凍結模擬、保持原暫停狀態、鍵盤焦點留在面板 | [free-skills.spec.ts](../tests/e2e/free-skills.spec.ts) |
| B-PLAY | 三關正式命令重播與純模擬一致，24 節點、結算、清除活動存檔及解鎖下關 | [free-skills.spec.ts](../tests/e2e/free-skills.spec.ts) |
| B-CAPTAIN | 六位隊長在 1×／3× 先完成真實初始冷卻，再施放及顯示演出 | [free-skills.spec.ts](../tests/e2e/free-skills.spec.ts)、[auto-tactical.spec.ts](../tests/e2e/auto-tactical.spec.ts) |
| B-VISUAL | 六人射擊、命中、敵人步態／死亡、狀態到期、三個 Boss 登場保存 | [animation](../tests/e2e/animation.spec.ts)、[enemy-motion](../tests/e2e/enemy-motion.spec.ts)、[combat-readability](../tests/e2e/combat-readability.spec.ts) |
| B-PRESSURE | 暫停渲染、動態渲染、3× 真實時鐘 60 秒，密集負載仍保留預警 | [animation-performance.spec.ts](../tests/e2e/animation-performance.spec.ts)、[performance.spec.ts](../tests/e2e/performance.spec.ts) |
| B-PRODUCTION | 不使用 DEV API：限速載入、真實等 XP、半途花點重載、3×、自動技能首發時間、無頁面／請求錯誤 | [production/smoke.json](../artifacts/validation/free-skills/production/smoke.json) |
| ASSETS | 必要素材、manifest、檔案與解碼容量 | [asset-budget.json](../artifacts/validation/free-skills/final-assets/asset-budget.json) |

初次回歸與修正紀錄保留，最終摘要不抹去舊失敗。初次測試仍假定立即施放與 18 點，後續修正測試設定；隊長動畫等待也補上合法 XP 配置與非同步判斷等待。緊急修復的傷害計數則修正為購入後起算並加入規則回歸。

## 4. 正式構築、探針與證據界線

| 驗證 | 數量與門檻 | 本輪結果 |
| --- | --- | --- |
| 合法關卡研究 | 25 終極 × 5／7 點 × 三關 × 十配對種子；總預算 24、正式 XP／敵群／命令 | 1,500 場全勝，所有預算合法 |
| 配點恢復 | 每場第 7 點完整保存／恢復 | 1,500 場一致 |
| 全命令重播 | 各終極兩預算的 S03／seed 101 | 50 份完整摘要一致 |
| 固定情境診斷 | 25 終極 × 八種 40 秒合成情境 | 200 份；不計入正式通關數 |
| 真機與真人 | 實際裝置記錄、五份玩家觀察 | 尚未執行 |

方法、腳本限制及重現指令見 [測試策略](TEST_POLICIES.md)，數據見 [研究結果](FREE_SKILL_VALIDATION.md)。不得以合成高生命敵群的傷害、桌面手機視窗或全勝代表性隊伍推定真機效能、全面平衡或真人趣味性。

## 5. 更新規則

規則或來源變更後，依影響範圍重測並建立新的版本化結果。確認 sourceDigest、內容版本與測試來源相符，保留原失敗及舊版本資料。`verify-free-release.ts` 只核對本輪已收集的指定報告與雜湊並彙總，並非自動重新執行全部測試。文件同步只核對連結、數字與來源，不宣稱產生新遊戲測試結果。
