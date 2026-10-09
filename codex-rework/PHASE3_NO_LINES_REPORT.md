# 戰鬥去線條化與光效粒子驗收

日期：2026-10-08

依 `05-PHASE3_VISUAL_REFINEMENT_NO_LINES.md` 修改視覺呈現。

## 調整

- 集火：移除橫跨戰場的紅色虛線及隊員至目標的五條導引線；僅保留目標處 1px 厚、4px 長的小角標與取消後淡出。
- 威脅：只有敵人進入警戒區才出現 20px 高的淡地面微光。五層填色合成透明度最高約 0.038，低於 0.05。`threatLine` 診斷格式及既有強度數值保留，與實際繪圖透明度分離，原 E2E 無須改動。
- 烈焰黑洞：暗紫漸層光核，16 顆橘紫粒子以 `60 × (1 − t²)` 半徑從 60px 加速吸入中心，並加速旋轉；不再繪製螺旋線。
- 超導貫穿：前 100ms 的淡藍光核、9 顆向外爆散的藍白火花；不再繪製鋸齒折線。
- 電磁引爆：柔和青藍填色光暈與寬能量環，保留既有受擊停頓；移除放射線及描邊圈。
- 防線 EMP：改為漸層填色光斑與連續漸層填色的柔邊衝擊環。
- 過載：保留金色碎盾粒子，補上柔光。文字標籤、500ms 壽命、8 個文字物件上限、`REACTIONS` 與 `diagnostics()` 保留。
- 新增 `src/game/soft-glow.ts` 共用填色光暈函式，不建立額外貼圖或粒子物件；所有指定效果不再呼叫幾何描邊 API。減少動態效果模式保留靜態粒子／光暈及淡出。

## 驗證

- `npm run typecheck`：通過。
- `npm run test:rules`：42 檔案、814 項通過。
- `npm run build`：通過，含角色素材驗證及 128 檔案離線快照；既有大型 JS 區塊提示仍存在。
- `npx playwright test tests/e2e/phase1-visual-focus.spec.ts`：20 項通過。
- `npx playwright test tests/e2e/phase2-commander.spec.ts`：16 項通過。
- `npx playwright test tests/e2e/phase3-combat-restore.spec.ts`：16 項通過。

三組瀏覽器測試共 52 項全數通過，涵蓋 Chromium、WebKit，以及 320–1440px 尺寸。既有測試斷言未修改。已人工檢視集火、EMP 與四組連鎖實際截圖，確認移除長連線、螺旋／鋸齒描邊及單薄圓框。

本機證據位於 `artifacts/validation/no-lines/`。本次未提交或部署。
