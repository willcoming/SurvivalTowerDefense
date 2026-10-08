# 終極技能能量與戰場演出重構

日期：2026-10-08。依 `06-ULTIMATE_VFX_REWORK.md` 及使用者補充要求實作。

## 已完成

### 充能與角色區

- `ultimate-energy-effects.ts` 重寫：移除頭頂黃球、繞身光球、上升圓珠與全身常駐光暈。
- 只保留一組 y=514、44 × 3.5 的充能條。移除 `scene.ts` 另一組重複繪製的 CD 條。
- 屬性色填入、槽內柔和流光、y=506 的扁平地面漸層；充能地面光 alpha 限於 0.08–0.18。
- 75% 後僅在實際武器掛點顯示低強度微光；滿能後金色充能條與 400ms 底座呼吸，不在頭頂新增標記。
- 充能進度讀取真實 `ultimateReadyAt`；施放後立即回到 CD，平時平滑增加。

### 施放節奏

- 背景暗化 20%，保持 180ms，再以 120ms 淡出；光效與角色維持清晰。
- 施法者使用同一角色畫格的半透明白色疊圖，80ms 內消退；角色姿勢停留約 50ms（60Hz 下約 3 幀），不暫停遊戲模擬。
- y=435、高 22px 的深藍切角橫幅，100ms 進場、350ms 停留、140ms 向右淡出。多角色同時施放時排隊顯示，避免文字堆疊。
- 原本懸浮的 DOM 大招文字改為螢幕閱讀器提示，不再與新橫幅重複出現。
- 減少動態效果模式取消暗屏、全場白閃、施法者閃白／頓挫與震屏，保留充能、名稱及較淡的命中回饋。

### 五種專屬戰場效果

| 角色 | 演出 |
| --- | --- |
| C01 | 天頂金紅柔光柱、翻滾火雲、擴散熱浪與地面餘燼 |
| C02 | 短暫亮白過載、兩道連續漸層藍白衝擊波、細密光塵與電磁餘光 |
| C03 | 極速光矛、命中十字星芒與散射光塵 |
| C04 | 暗紫奇點、翡翠吸積盤與煙霧旋轉；持續時間依真實引力場，怪物由原有牽引規則聚攏 |
| C05 | 五枚弧線飛彈、錯開時間的火球煙雲與連續輕震 |

`ultimate-battlefield-effects.ts` 接收真實大招／追加爆炸事件；C01、C04 的持續場依模擬期限渲染。舊通用渲染器不再重複繪製這五位角色的大招。

橫幅依規格採用指定演出標題；屬性標籤與充能顏色仍依當前裝備形態。技能樹內既有名稱、傷害、CD、控場抗性和回放規則沒有更改。

### 完整清理尖刺來源

檢查實際截圖後，同時修正普通命中、範圍效果、燃燒附著與舊隊長演出使用的材質。`impact-material.ts` 統一淘汰原始圖集的紅／紫尖刺畫格，熱能僅使用自然火雲／煙霧畫格，電漿及電弧改為柔光材質。大招也不再透過舊材質產生額外尖刺。

共用漸層紋理每個遊戲實例僅建立一次，所有持續效果使用有上限的 Image 物件池。

## 驗證

- `npm run typecheck`：通過。
- `npm run test:rules`：42 個檔案、814 項通過。
- `npm run build`：通過；既有大型 JavaScript 區塊警告仍在。
- `npx playwright test tests/e2e/ultimate-energy-vfx.spec.ts`：Chromium / WebKit 共 28 項全部通過。
- 相關回歸：範圍效果 24 項、集火／燃燒 20 項、電弧效果 8 項通過；合計 80 項不同瀏覽器案例通過。充能測試曾修正為等待平滑動畫到位再斷言，最終指定套件完整重跑通過。

瀏覽器檢查涵蓋指定的大招測試、範圍效果、集火／燃燒與電弧效果。新增檢查充能條位置、施放後重置、橫幅排隊、五種真實施放、引力牽引、持續場與特效回收、減少動態效果，以及固定時鐘下的暗屏／閃白／頓挫時間。

原有 `skill-energy.spec.ts` 對長條電弧貼圖的斷言改為局部柔光材質；仍驗證真實連鎖事件、物件池上限與效果消退。範圍測試改為從專屬大招渲染器檢查引力場覆蓋範圍。

截圖、錄影與指令輸出保存在 `artifacts/validation/ultimate-rework/`。本次沒有部署線上版本。

## 驗收素材

| 角色 | 手機截圖 | 桌面截圖 | 手機錄影 |
| --- | --- | --- | --- |
| C01 | [390px](../artifacts/validation/ultimate-rework/evidence/C01-390.png) | [1440px](../artifacts/validation/ultimate-rework/evidence/C01-1440.png) | [錄影](../artifacts/validation/ultimate-rework/evidence/C01-390.webm) |
| C02 | [390px](../artifacts/validation/ultimate-rework/evidence/C02-390.png) | [1440px](../artifacts/validation/ultimate-rework/evidence/C02-1440.png) | [錄影](../artifacts/validation/ultimate-rework/evidence/C02-390.webm) |
| C03 | [390px](../artifacts/validation/ultimate-rework/evidence/C03-390.png) | [1440px](../artifacts/validation/ultimate-rework/evidence/C03-1440.png) | [錄影](../artifacts/validation/ultimate-rework/evidence/C03-390.webm) |
| C04 | [390px](../artifacts/validation/ultimate-rework/evidence/C04-390.png) | [1440px](../artifacts/validation/ultimate-rework/evidence/C04-1440.png) | [錄影](../artifacts/validation/ultimate-rework/evidence/C04-390.webm) |
| C05 | [390px](../artifacts/validation/ultimate-rework/evidence/C05-390.png) | [1440px](../artifacts/validation/ultimate-rework/evidence/C05-1440.png) | [錄影](../artifacts/validation/ultimate-rework/evidence/C05-390.webm) |

[充能與滿能對照](../artifacts/validation/ultimate-rework/evidence/energy-cooldown-and-ready-1440.png) · [光柱固定畫格](../artifacts/validation/ultimate-rework/evidence/C01-column-cinematic-frame-390.png)
