---
name: deploy-starfall
description: 將 SurvivalTowerDefense（星骸防線）目前修改發布到既有 GitHub Pages，完成來源整理、測試、建置、離線檢查及線上版本驗證。當使用者在本專案說「上線」、「部署」、「發布最新版本」或呼叫 $deploy-starfall 時使用；只要求查詢線上狀態時僅執行讀取與驗證。
---

# 星骸防線上線

## 發布目標

- 儲存庫：`https://github.com/willcoming/SurvivalTowerDefense.git`
- 網站：`https://willcoming.github.io/SurvivalTowerDefense/`
- 來源分支 `main`；靜態網站分支 `gh-pages`；Vite base `/SurvivalTowerDefense/`。
- 沿用專案的 `scripts/deploy-pages.mjs`、`scripts/verify-pages-live.mjs` 與 `docs/GITHUB_PAGES.md`，不要另建託管服務或改動 Pages 來源設定。
- 使用者要求上線即授權本次必要的提交與推送。先完成可發布內容，不重複詢問已授權事項；工具的網路或檔案權限仍依環境處理。

## 整理發布來源

1. 以 `git rev-parse --show-toplevel` 找根目錄，讀適用的 AGENTS.md、部署腳本及文件；查看 `git status --short`、diff、目前分支與 `git worktree list`。依實際修改簡述這次發布內容，不沿用先前聊天的版本描述。
2. 核對 origin，取得遠端 `main`、`gh-pages` 的最新 SHA。不要把本機陳舊的 tracking ref 當成線上狀態。
3. 乾淨且包含預定修改的 checkout 可直接使用。若工作目錄混有未提交開發與大量驗證產物，優先沿用本聊天適用的乾淨發布 worktree；必要時建立獨立發布 worktree，基於最新 `origin/main` 整理此次差異。更新既有 worktree 前確認乾淨且沒有未發布提交。
4. 列出明確檔案清單，包含變更程式、新增模組、必要素材、測試與本次文件。檢查完整 diff 和依賴；保留最新遠端已有的修改，不以舊版整目錄覆蓋。注意未追蹤的新模組不會完整出現在普通 `git diff`。
5. 只帶入必要驗證證據；不要把歷史 `artifacts/` 大量圖片、暫存輸出、`node_modules`、`dist`、憑證或環境設定提交。需要 `node_modules` 時可在同機發布 worktree 使用既有安裝的符號連結，鎖檔不同則依 `package-lock.json` 安裝。
6. 保留原工作目錄，避免為了滿足乾淨檢查而清除、重設或覆寫使用者內容。使用明確路徑 `git add`，檢查 staged diff 和 `git diff --cached --check`，在發布 checkout 建立描述本次變更的提交。

## 驗證與發布

在發布 checkout 執行：

```sh
npm run deploy:pages
```

此腳本要求乾淨來源，依序執行規則／存檔測試、含型別檢查的正式建置、素材檢查、離線單元測試，以及 Chromium／WebKit 離線與更新情境。通過後才推送 `main` 和 `gh-pages`，再比對公開檔案並執行線上離線驗證。

- 改到介面或互動時，補跑相關 Playwright 案例；選空閒 `E2E_PORT`，不要誤用已占用埠上的舊 preview。以 `VALIDATION_OUTPUT_DIR` 指向暫存目錄，避免驗證後產生未追蹤檔導致發布中止。
- 測試失敗時查明原因、修復本次範圍內問題再提交；不要略過檢查或放寬斷言來上線。
- 推送被拒絕時檢查遠端新提交並正常整合，重新驗證；不要 force push。
- GitHub Pages 通常要等待快取更新。腳本有五分鐘的版本比對期限；逾時先查公開 `version.json` 與遠端 SHA，不要直接重複發布。需要時用 `npm run verify:pages` 重試唯讀驗證。
- 若推送成功但後續檢查失敗，明確區分「已推送／已提供新版」與「尚未驗證」，保留收據並從失敗步驟繼續。
- 長時間執行時持續回報有意義的進度，避免把「來源已推送」提早稱為「上線完成」。

## 完成標準

1. `dist/deployment-receipt.json` 的來源／網站 SHA 與遠端吻合。
2. `dist/live-verification.json` 顯示公開版本、HTML、JS、CSS、Service Worker 與 PWA 圖示符合本次建置。
3. `dist/offline-local-verification.json` 與 `dist/offline-live-verification.json` 已通過；線上 WebKit 的離線模擬限制按報告如實呈現，不宣稱真機驗證。
4. 針對此次變更，用隔離瀏覽器在公開網址操作一個代表性流程。正式版沒有 `window.__game`，透過可見 UI 驗證；不要操作使用者既有瀏覽器存檔。
5. 將有用收據存到可持續存取的位置；若要 archive worktree，先保存被忽略的 `dist` 收據與截圖。

最後用中文簡短回報公開網址、來源短 SHA、發布內容及驗證結果。若只驗證到部分步驟，明說剩餘限制。舊版 PWA 可提示關閉所有遊戲視窗再開啟，或使用遊戲設定中的更新功能；不要求清除玩家資料。
