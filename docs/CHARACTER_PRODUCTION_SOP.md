# 角色與變裝製作 SOP

適用：所有新角色、原裝、夏日及後續主題。角色只有完成立繪、Q 版動畫、攻擊與遊戲驗證，才算可交付。既有參考見 [角色畫風基準](CHARACTER_ART_DIRECTION.md)。

新增人物先依 [新增角色 SOP](NEW_CHARACTER_SOP.md) 完成身份、玩法差異及接入清單，並填寫 [角色規格模板](templates/CHARACTER_BRIEF.md)；本文件詳列素材規格與打包方法。

## 1. 定義角色與攻擊

先記錄角色 ID、形態 ID、姓名、髮色／髮型、服裝、武器剪影、定位、屬性、普攻、隊長技能與技能樹。新增服裝使用形態 ID，不複製角色 ID。主題不改變武器的可辨識動作；屬性由 `attackType` 決定。

| 角色 | 動作與武器 | 必須看得到的攻擊 |
| --- | --- | --- |
| C01 璃音 | 卡賓槍抵肩射擊 | 脈衝彈、槍口與命中 |
| C02 雷娜 | 雙叉發射器充能 | 連鎖放電與各跳落點 |
| C03 凜月 | 長槍架設、瞄準與後座 | 狹長貫穿光束 |
| C04 米菈 | 雙手展開浮環、推出核心 | 重力區域及聚怪／擊退 |
| C05 芙蕾 | 肩扛砲、抬高砲口、屈膝後座 | 拋物線彈、落點爆炸 |
| C06 希雅 | 操作控制器、手勢下令 | 無人機展開與光束 |
| C07 汐音 | 裝填、舉起地雷發射器、發射 | 地雷飛向實際部署位置、充能與引爆 |
| C08 熾夏 | 雙手扶持旋轉砲、連射與回復 | 旋轉砲口、連發彈道、過熱停火 |

## 2. 立繪與 Q 版分開製作

- 立繪：成年日系動漫角色，512×768 WebP，用於招募、編隊與隊長特寫。
- Q 版：同一身份與服裝，約 2.5 頭身、大頭短肢，武器輪廓清楚；以 `C01-motion.webp` 為戰鬥畫風參考。不能縮小立繪冒充 Q 版。
- 每一套形態各有六個重新繪製姿勢；不能以鏡像、旋轉或整張圖片晃動代替逐格動畫。
- 角色卡背景參考原本 C01／C02 立繪的插畫細節、景深、材質與科幻光影。不能以簡單漸層、網格、圓環底紋作為完成稿，也不能直接使用俯視的關卡地圖。背景採人物視角，尺寸、視線與光源要能自然襯托角色。
- 去背立繪透過 `formBackdrop` 登錄 `public/assets/portrait-backgrounds` 的專用背景，由共用圖片流程套用於編隊、詳情、招募及換裝預覽。原裝配合職能，主題裝延續同一世界的畫風；同系列可共用，但每人都須檢查構圖。人物層與背景分開，Q 版戰鬥動畫保留透明；已有完整背景的舊立繪不重複疊圖。已招募、未招募灰階、換裝前後及與舊卡並排都列入驗收。
- 去背驗收包括髮絲、衣角、武器邊緣的紫邊，需在深底、淺底與實際角色卡上檢查。不要只移除純洋紅後就交付；邊緣混色也需處理，且不得抹掉真正的紫色服裝、頭髮與電弧。
- 內建 imagegen 生成；參考 1 指定為 Q 版畫風／比例，參考 2 指定為該形態立繪身份／服裝。保存提示詞、來源與參考路徑。

## 3. 六格動畫規格

來源採 1536×1024，三欄兩列，依序：`idle → ready → aim → fire → recoil → recover`。每格完整人物含武器，相同比例、相同腳底基準；四邊保留空白，無文字、框線與地面陰影。既有去背流程採純洋紅 `#FF00FF`；不能交付假透明棋盤格。若取得真透明來源，打包須保留 alpha。

輸出為 768×512 的透明 lossless WebP，每格 256×256，腳底 `(128,240)`。同一張表使用共同縮放倍率；不可每格獨立拉伸。戰場顯示尺寸 84，透過相機比例補償維持正確頭身比。規格集中在 `src/data/character-motion.ts`。長槍、飛行物與無人機不可迫使整個人物縮小；Q 版武器適度縮短，飛行物由遊戲特效繪製。

提示詞模板：

```text
產物：{形態 ID} 的 Q 版六格戰鬥動作表。
參考 1：既有 C01 Q 版比例、線稿及六格布局。
參考 2：{本形態立繪} 的髮型、服裝、武器身份。
六格動作：{idle; ready; aim; fire; recoil; recover 的武器專屬動作}。
全部朝右上方三分之四視角；相同頭部尺寸、共同腳底位置。
三欄兩列，1536×1024，每格保留空白邊距。
純洋紅背景、無陰影、無框線、無文字、無棋盤格；武器不可越格。
```

## 4. 打包與登錄

來源清單使用 `assets` 陣列，每筆含 `id`、`source`、`filename`、`prompt`、`reference`。本次範例：`artifacts/animation-sources/forms-generated.json`。

```sh
npm ci
VALIDATION_OUTPUT_DIR=artifacts/validation/form-motion npm run pack:motion -- --input=artifacts/animation-sources/forms-generated.json
```

可在命令最後指定一個或多個形態 ID，只重建選中素材。打包器檢查空格／裁切、去背、統一腳底、輸出逐格 PNG 與 SHA-256，按 asset ID 合併 manifest，保留其他角色。來源 PNG 留在 `artifacts/animation-sources`，正式 WebP 必須進入 `public/assets/animations`。生成紀錄必須使用專案內來源，不能依賴個人生成暫存目錄。

六個初始原裝沿用 `{角色}-motion.webp`；其餘目前用 `{形態}-motion-v1.webp`。改版使用新檔名並同步 `formMotion`。不能讓 `formMotion` 回傳 portrait；新增形態時驗證器會檢查動畫是否齊備。

角色卡背景另外保存於 `artifacts/portrait-background-sources`，完整提示詞和參考記在 [generated.json](../artifacts/portrait-background-sources/generated.json)。以 `node scripts/pack-portrait-backgrounds.cjs` 打包為 512×768 WebP，寫入 `public/assets/portrait-backgrounds` 並合併 manifest。打包只縮放／壓縮，不以程式重畫插畫；正式素材與生成紀錄納入版控，原始 PNG 另行保留。背景列入素材缺檔、傳輸及解碼容量檢查。

## 5. 接入攻擊及動畫

`BattleScene` 一律載入六格 spritesheet，`CombatActors` 一律使用共同腳底與尺寸。`ALLY_ATTACKS` 登記每位角色的攻擊名稱與槍口位置。使用真實普攻事件／攻擊計數驅動射擊、後座、回復，等待下一次攻擊時播放瞄準。暫停時動畫時鐘停止，續玩不重播過去攻擊。

攻擊 VFX 的起點必須跟著角色欄位與朝向，落點必須來自真實事件。地雷不能只閃槍口而省略部署；旋轉砲不能看起來像單發狙擊。外觀更新不修改傷害、冷卻、屬性、取得方式及存檔結構。

## 6. 驗收與完成條件

1. 並排檢查立繪、Q 版及六個姿勢：身份服裝一致；武器持握正確；沒有裁邊、漂移、假透明或重複格。影像雜湊只能檢查完全相同的格子，動作是否足夠不同仍須人工觀看。
2. `npm run test:motion-assets`：所有形態都必須有六格、正確尺寸、透明背景、manifest 雜湊與分格紀錄。`npm run build` 的 prebuild 也會執行此檢查，未通過就阻止打包。
3. `npm run test:rules`、`npm run build`，確認規則／存檔和型別沒有回歸。
4. `npx playwright test tests/e2e/form-motion.spec.ts`：Chromium／WebKit，390×844，八人原裝／夏日實際載入，渲染格切換，普攻、暫停及一致尺寸；新角色另檢查 3× 與過熱。
5. `npm run test:assets`：檔案齊全與容量；按需載入五名出戰者，不能為一場戰鬥下載所有角色動畫。
6. 保存手機與桌面截圖、逐格總覽、測試結果。人工戰鬥 fixture 要明列，不冒充平衡測試或真機驗證。

任何一項未完成，交付紀錄必須明列缺項，不能只以「立繪已生成」宣告角色製作完成。

## 本次落地紀錄（2026-09-08）

補齊汐音、熾夏原裝及八人夏日造型，共 10 張新動作表、60 個姿勢；連同既有原裝，16 個形態都有六格 Q 版。地雷部署具有飛行落點，旋轉砲有連射砲口與專用音效；沿用原本戰鬥規則。

驗證：16 個形態素材檢查、289 項規則／儲存測試、Chromium／WebKit 共 8 項角色動作案例及 production build 通過。素材容量檢查通過，首場戰鬥靜態傳輸上限約 3.97 MB。瀏覽器案例使用固定高血量靶標觀察真實冷卻、地雷與過熱，包含 390×844、桌面截圖、暫停與 3×；這不是 iPhone 真機效能或關卡平衡測試。

- [生成來源與提示詞](../artifacts/animation-sources/forms-generated.json)
- [16 形態逐格總覽](../artifacts/validation/form-motion/all-forms-poses.png)
- [WebKit 夏日戰鬥截圖](../artifacts/validation/form-motion/final/webkit-summer-C01-390x844.png)
- [瀏覽器驗證結果](../artifacts/validation/form-motion/final/browser-results/results.json)
