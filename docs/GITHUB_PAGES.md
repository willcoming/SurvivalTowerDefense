# GitHub 遠端與 Pages 部署

公開倉庫：[willcoming/SurvivalTowerDefense](https://github.com/willcoming/SurvivalTowerDefense)。線上遊戲：[星骸防線：黎明反攻](https://willcoming.github.io/SurvivalTowerDefense/)。已完成首次發布與公開站驗證，HTTPS 已啟用。

部署基線為 **v0.3.0-dev.1**（6b1ce14）。使用獨立目錄 `/Users/willcoming/code/SurvivalTowerDefense-pages` 與 `codex/pages-publish` 分支，保留原目錄進行中的新角色／關卡開發。

## 發布流程

使用既有 Git HTTPS 憑證，無需 `gh`。原始碼推到 `main`，建置後網站推到 `gh-pages`；Pages Source 設為 **Deploy from a branch → gh-pages → /(root)**。分支更新後，由 GitHub Pages 自動發布靜態檔案。[GitHub 官方說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

先將預定上線的檔案明確 `git add` 並提交，再執行：

```sh
npm run deploy:pages
```

[部署腳本](../scripts/deploy-pages.mjs) 確認 origin 是本專案且工作目錄乾淨，然後執行規則／存檔測試、型別檢查與 Pages 路徑 build、素材容量檢查。通過後才推送來源與網站，保留兩個分支的歷史，不強制推送。它會比對本機／遠端的原始碼與網站 SHA，產生本機 `dist/deployment-receipt.json`，再等待最多五分鐘核對公開頁面與資產。線上比對結果保存在 `dist/live-verification.json`，也可單獨執行 `npm run verify:pages`。

`git push origin main` 只更新原始碼。因為此專案使用 Vite，網站需由上述指令先建置，再發布 `gh-pages`。只有建置產物進入網站分支，依賴、原始測試報告與開發檔不納入網站。

## 路徑與版本

`PAGES_BASE_PATH` 控制 Vite base，未設定時是 `/`，保留 localhost 用法；發布腳本設為 `/SurvivalTowerDefense/`。UI、背景、技能圖示及 Phaser 素材統一透過 [assets.ts](../src/assets.ts) 使用同一路徑。[Vite 部署說明](https://vite.dev/guide/static-deploy.html#github-pages)

每次 build 在 HTML 的 `build-revision` meta 和 `version.json` 寫入來源 Git SHA 與內容版本。線上驗證使用 `?v=<sha>` 避開舊快取，核對：

1. `git rev-parse HEAD` 與 `git ls-remote origin refs/heads/main` 一致。
2. 線上 `index.html` 和 `version.json` 的建置 SHA 等於原始碼 SHA。
3. HTML 引用的帶雜湊 JS／CSS 檔名及檔案 SHA-256 與本機 `dist` 一致。
4. 線上遊戲可載入，真實 XP 配點、半途保存、3× 與隊長冷卻正常。

GitHub Pages 與 localhost 是不同來源，遊戲進度各自保存於瀏覽器 IndexedDB，不自動搬移。發布改動不更換戰鬥內容版本，也不改寫舊局。

## 驗證命令

```sh
PAGES_BASE_PATH=/SurvivalTowerDefense/ npm run build
PAGES_BASE_PATH=/SurvivalTowerDefense/ npm run preview -- --port 5175 --host 127.0.0.1
```

另一終端可針對本機正式版或線上 Pages 執行：

```sh
PRODUCTION_URL=http://127.0.0.1:5175/SurvivalTowerDefense/ VALIDATION_OUTPUT_DIR=artifacts/validation/github-pages/local-subpath npm run test:production
```

`EXPECTED_COMMIT` 可指定應載入的完整 SHA；`PRODUCTION_URL` 可改為帶版本參數的公開網站網址，`PRODUCTION_SERVER` 記錄測量來源。測試使用隔離的 Chromium 瀏覽器，不操作玩家存檔。

## 初期路徑驗證

2026-09-05 的根路徑與專案子路徑正式 build、254 項規則／存檔測試及素材檢查通過；61 項必要素材與 62 筆 manifest 均有效。

| 路徑 | 主頁可操作 | 首場載入 | 流程結果 |
| --- | --- | --- | --- |
| `/` | 680 ms | 3,352 ms | 素材、真實 XP、花 1 點重載、3×、第 50 秒首次自動技能通過 |
| `/SurvivalTowerDefense/` | 711 ms | 3,387 ms | 同上，24 個素材／bundle 請求均保留子路徑 |

以上為加入建置 SHA 之前的本機路徑驗證，使用桌面 Chromium 151、390×844、10 Mbps／100 ms RTT，無頁面錯誤或失敗 HTTP 回應。證據：[子路徑 smoke](../artifacts/validation/github-pages/local-subpath/smoke.json)、[根路徑 smoke](../artifacts/validation/github-pages/local-root/smoke.json)。線上結果另行記錄，不以本機結果代替。

## 首次發布狀態

2026-09-05 首次發布完成。來源 `main` 為 `027f7ec86247366f8f41e4020717e7606106883b`，網站 `gh-pages` 為 `72687477b520f5b0191a0d331a4c3941cf0c10cc`；GitHub Pages 回報 `built`，使用專案網址與 HTTPS。證據：[設定與建置](../artifacts/validation/github-pages/live/pages-settings.json)、[推送收據](../artifacts/validation/github-pages/live/deployment-receipt.json)、[公開檔案比對](../artifacts/validation/github-pages/live/live-verification.json)。

公開站使用隔離 Chromium 151、390×844、10 Mbps／100 ms RTT、停用快取驗證：主頁可操作 **3,541 ms**、首場載入 **3,919 ms**。透過真實遊玩取得 XP，花 1 點後重載續配成功，3×／自動技能偏好保留，首次技能於第 **50 秒** 施放；24 個素材／bundle 請求皆位於專案子路徑，沒有頁面錯誤或失敗 HTTP 回應。這是桌面模擬手機環境，實機驗證仍待執行。[完整線上測試](../artifacts/validation/github-pages/live/smoke.json)。

本節 SHA 與證據記錄首次發布版本。後續僅更新文件時仍執行部署與公開檔案比對；當前來源可由 [version.json](https://willcoming.github.io/SurvivalTowerDefense/version.json) 查詢，最新部署收據與比對結果由腳本保存在本機 `dist/`。

另確認首頁六張角色圖片全數完成載入，保留 [首頁截圖](../artifacts/validation/github-pages/live/home-ready.png) 與 [圖片檢查](../artifacts/validation/github-pages/live/home-images.json)；此補充截圖未限制頻寬，不列入上述載入量測。
