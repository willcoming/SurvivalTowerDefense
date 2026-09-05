# 構築研究與測試策略

**現行政策：free-skills-v1 · 內容版本 0.3.0-dev.1 · 2026-09-05**

本頁說明已執行的自由技能樹研究與重現方式。0.2 的 840 場政策見 [歷史技能樹研究](SKILL_TREE_BALANCE.md)，原 A/B 的 T01–T03、18 次選卡與錯配對照見 [歷史測試政策](history/TEST_POLICIES_AB.md)。

## 1. 正式關卡矩陣

25 個角色終極 × 受測角色投入 **5／7 點** × S01／S02／S03 × 十個固定種子，共 **1,500 場**。種子固定為 `101, 211, 307, 401, 503, 601, 709, 809, 907, 1009`；失敗也納入輸出。

每場五人、相同基礎戰力、全隊 24 點。受測角色擔任隊長，隊友由固定優先序 C03、C05、C02、C06、C04、C01 排除本人後補滿。同角色不同終極與兩種預算使用相同隊伍；跨角色比較會改變隊伍，不能視為只改一個技能的嚴格對照。

政策來源：[deep-build.ts](../tests/helpers/deep-build.ts)。取得順序如下：

1. 依前置建立受測終極的五點路徑；遇「任一前置」時固定取第一條合法路徑。
2. 另由 `C03-B/8`、`C05-B/7`、`C02-A/9` 固定順序挑選兩個在隊伍內且不屬受測角色的終極。
3. 三位核心交錯配點，各花五點取得終極，共十五點。
4. 7 點組再投資受測角色另一條樹的前兩個普通節點；5 點組不額外投資受測角色。追加點數從同一全隊預算扣除。
5. 依序配置防線工程 `TEAM/0–3`、戰術協同 `TEAM/8–11`，不足 24 點再投資非核心支援的普通節點，總計恰好 24 點。

這是固定代表性構築，並非窮舉全部自由選點。政策不依戰果臨時更換目標，也不以未消耗 RNG 預知結果；雖然玩家可看未來部署情報，本政策的配點仍為事先固定。

## 2. 執行、恢復與判準

正式研究使用 [validate-free-skills.ts](../scripts/validate-free-skills.ts)：正常建立戰局，以正式 `buy-node`／`cast` 命令與逐 tick 規則運算，依真實擊殺取得 XP。不修改防線 HP、經驗、敵人、出場時間或傷害。

隊長採遊戲自動施放策略，等待初始冷卻完成且場上有敵人才施放。配點時暫停；純模擬以正式命令完成 Boss 登場，不等待 1.5 秒現實演出，因此模擬報告時間只代表有效戰鬥時間，演出時長另由瀏覽器驗證。

每場在第 7 點執行完整保存／恢復並比較序列化狀態。各終極 × 兩預算的 S03／seed 101 另做全命令重播，共 50 份，比較排除 runId 後的完整狀態雜湊。

腳本的可玩性門檻為：每個終極至少有一個「預算 × 關卡」組達到 80% 通關；恢復皆一致，所有勝利樣本全隊用完 24 點且受測角色符合 5／7 點。**本輪實際結果較門檻更高：1,500／1,500 全勝**。腳本不是要求每個組合必須 100% 通關，不能將實際觀察改寫為永久驗收門檻。

輸出保留每場終極、樹、預算、關卡、種子、勝負、花點、時間、防線損傷、Boss 擊殺時間、角色傷害、控制、護盾吸收、修復與恢復結果；重播保留配置、完整命令及摘要。原始結果為 [balance.json](../artifacts/validation/free-skills/balance.json)。

## 3. 200 個診斷探針

[probe-free-skills.ts](../scripts/probe-free-skills.ts) 使用每個終極五點前置路徑，測試八種各 40 秒的合成情境：散開連鎖、重甲、直線、Boss、護盾、重甲 Boss、20% 生命目標、加兩位未升級輸出隊友。

探針會人工設置 XP、停止正常出場、建立高生命且基礎速度為零的敵人，不施放隊長技能；控制仍可能移動目標。它可用來觀察連鎖、穿透、處決、護盾及支援的機制價值，**不屬合法完整關卡通關**。結果分開存於 [matchups.json](../artifacts/validation/free-skills/matchups.json)，不得加進 1,500 場勝率。

## 4. 如何解讀與繼續研究

全勝代表這些固定構築具可玩性，無法單靠勝率判斷每條樹的價值。強力隊友可能掩蓋受測技能差異；跨角色隊伍不同，控制也可能以降低傷害換取防線安全。因此同時比較傷害、控制、防線損失、Boss 時間、護盾與修復，不將單一 DPS 當作通用總分。

本輪保留 14 條樹各 8–12 節點的不對稱設計。是否調整總數，後續先提出可驗證假說：在同角色、同隊友、同種子及相同點數下，哪些節點提供不同但有用的決策？若需要降低隊友遮蔽，先登錄另一組固定隊友與判準，再執行，不事後挑有利樣本。

真人部分觀察是否看懂前置、能否從敵情選反制、選擇所需時間、是否反覆找不到想要的機制。搭配理由與操作負擔需實際玩家資料，使用 [外部測試表](EXTERNAL_PLAYTEST.md)，目前尚未完成。

## 5. 重現命令

以下命令已存在於 package scripts。需要保留本次資料時，先給新輸出目錄；不要覆寫既有交付結果。

```sh
npm run typecheck
npm run test:rules
VALIDATION_OUTPUT_DIR=artifacts/validation/free-skills-rerun npm run test:simulation
VALIDATION_OUTPUT_DIR=artifacts/validation/free-skills-rerun npm run test:tree-matchups
VALIDATION_OUTPUT_DIR=artifacts/validation/free-skills-rerun/browser E2E_PORT=5174 npm run test:e2e
npm run build
VALIDATION_OUTPUT_DIR=artifacts/validation/free-skills-rerun/assets npm run test:assets
```

另開 `npm run preview` 後，從另一終端執行 `VALIDATION_OUTPUT_DIR=artifacts/validation/free-skills-rerun/production npm run test:production`。E2E 使用獨立測試瀏覽器，預設 dev 埠 5173，與已開 preview 並行時改用 5174。首次可用 `npx playwright install chromium webkit` 安裝測試瀏覽器。

| 命令 | 用途與限制 |
| --- | --- |
| `npm run test:simulation -- --quick` | 單種子的 150 場探索，輸出 exploratory，不代替十種子的正式結果 |
| `npm run test:free:e2e` | 自由技能樹專項瀏覽器案例；完整回歸用 test:e2e |
| `npm run test:performance` | 舊純模擬壓力工具，不取代目前 3× 活動戰鬥瀏覽器壓測 |
| `npm run test:simulation:v2`／`test:tree-matchups:v2` | 保留 0.2 技能樹研究；使用獨立輸出目錄 |
| `npm run test:simulation:legacy` | 保留原 A/B 政策，不代表新版平衡 |
| `npx tsx scripts/export-free-skill-spec.ts` | 從現行節點資料生成 FREE_SKILL_NODES.md |
| `npx tsx scripts/verify-free-release.ts` | 核對本輪指定報告、案例合併與來源雜湊，重寫 release-summary；不執行測試，亦非任意輸出目錄的通用驗證器 |
| `npx tsx scripts/report-free-skill-validation.ts` | 讀取已收集資料產生研究 Markdown；不產生新測量 |

瀏覽器案例合併、性能負載與正式版 smoke 的適用界線見 [驗收矩陣](VALIDATION_MATRIX.md)及[交付報告](DELIVERY.md)。
