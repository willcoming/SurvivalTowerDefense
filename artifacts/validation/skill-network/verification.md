# 技能網絡驗證紀錄

版本：0.5.0-dev.2，2026-09-22。

- 規則／存檔：33 個檔案、513 項測試通過。涵蓋所有前置路徑、6 點終極路徑、舊版節點隔離、換裝、剩餘 1 點保留及勝利結算。
- 瀏覽器：Chromium 與 WebKit 共 35 項通過、1 項跳過；涵蓋 320×500、390×844、768×1024、1024×768、1440×900。
- 原生雙指注入僅能透過 Chromium CDP 執行，WebKit 該項跳過；WebKit 的拖曳、縮放按鈕、全覽、起點、選點及換裝均通過。仍未以實體 iPhone 驗證手勢。
- TypeScript、正式建置、動作素材檢查通過，git diff --check 無錯誤。建置有 Vite 原生設定載入的未來相容提示及單一輸出檔大小提示；不影響本次建置。
- 2,304 組 6／10 點、原裝與夏日裝、六種情境的試算完成。輸出普通技能與終極配置的傷害、控場、護盾及施放次數。此為路徑抽樣，不能證明所有組合等強。
- 96 局簡單難度 S01／S06／S12、雙種子、各角色隊長測試皆結束，69 勝、27 敗，無配點卡死。固定自動配點勝率不是玩家通關率。

可重現指令：

```sh
npm test -- --reporter=dot
npm run build
node --import tsx scripts/validate-skill-network.ts
VALIDATION_OUTPUT_DIR=artifacts/validation/skill-network npx playwright test tests/e2e/personnel-skills.spec.ts tests/e2e/tactical-tree.spec.ts tests/e2e/skill-rework.spec.ts tests/e2e/skill-network.spec.ts
```
