# 網站離線安裝版

## 玩家操作

1. 連網開啟 [星骸防線](https://willcoming.github.io/SurvivalTowerDefense/)。首次會自動背景下載完整程式與素材，下載期間可以正常遊玩。
2. 在首頁提示或設定頁確認「可離線遊玩」。完整內容包含全部角色、造型、動畫和關卡，不需要先逐一瀏覽。
3. 支援安裝提示的瀏覽器可按設定頁的「安裝遊戲」；iPhone／iPad 使用「分享 → 加入主畫面」。安裝後先連網開啟一次，再確認離線內容完成。
4. 之後可斷網從主畫面或原網址開啟。首次尚未完成下載的裝置不能直接離線啟動。

下載未完成、網路中斷或空間不足時，設定頁提供重試。沒有支援安裝提示的瀏覽器仍可使用網站；不支援離線儲存的環境會明確顯示只能線上遊玩。正式網站使用 HTTPS，本機驗證使用 localhost／127.0.0.1；一般區網 HTTP 網址與直接雙擊 HTML 不提供離線安裝。

若使用瀏覽器的強制重新整理，頁面可能暫時略過離線控制，顯示「已下載 · 重新開啟確認離線」。此時關閉遊戲視窗，再從原網址或主畫面重新開啟，確認「可離線遊玩」後再斷網；遊戲不會自動重載正在進行的戰鬥。

## 更新與存檔

連網時會檢查並下載新版，下載成功後提示關閉所有遊戲視窗再重新開啟。正在遊玩的視窗繼續使用原本完整版本，不會強制重載。新版下載失敗時，原本已完成的離線版本仍然可用。

收藏、已確認編隊、關卡紀錄、指揮官成長與偏好沿用 IndexedDB 儲存。本次不調整存檔結構：離場或重開遊戲會結束未完成戰局，永久進度保留。離線快取與遊戲存檔分開管理，更新清理只處理此遊戲的舊版快取。

不同瀏覽器、網址來源及安裝環境不保證共用存檔，沒有雲端同步。清除網站資料會清除進度與離線內容；瀏覽器回收網站儲存空間後，也可能需要連網重新下載。

## 工程行為

- Vite 正式建置完成後，從實際產物產生 Service Worker 的完整快取清單與內容雜湊；不使用美術來源紀錄作為快取清單。
- 全部檔案校驗並完成保存後，才標示離線可用。快取以部署路徑與內容版本隔離，支援根路徑及 GitHub Pages 專案子路徑。
- 更新遵循 Service Worker 等待生命週期，不呼叫 `skipWaiting`，不重載頁面。介面進度只更新專用節點，不重新建立戰鬥畫布。
- `npm run dev` 不註冊 Service Worker；請以正式建置驗證離線功能，並以隔離瀏覽器避免既有正式快取影響開發。

## 驗證方式

```sh
npm run test:rules
npm run test:offline:unit
npm run build
VALIDATION_OUTPUT_DIR=/tmp/starfall-offline-root npm run test:offline
PAGES_BASE_PATH=/SurvivalTowerDefense/ npm run build
PAGES_BASE_PATH=/SurvivalTowerDefense/ VALIDATION_OUTPUT_DIR=/tmp/starfall-offline-pages npm run test:offline
```

`test:offline` 使用正式產物與隔離瀏覽器，啟動測試伺服器後進行斷網、重開、素材載入、永久進度及安全更新驗證。離線核心單元測試另驗證完整性檢查、儲存失敗與重試。根路徑、子路徑結果分別保存，不以開發模式或普通 HTTP 快取代替離線證據。

Chromium 使用瀏覽器離線模式；本機 WebKit 使用直接切斷測試伺服器網路連線的方式，因為 Playwright 的 WebKit 離線模擬會連 Service Worker 回應一起阻擋。公開站使用 Chromium 驗證實際離線流程，WebKit 只驗證線上相容性與完整快取，報告會分別標示。招募測試在隔離瀏覽器的存檔配置一張測試券，再用正式介面離線抽取並驗證結果保存，不修改任何玩家的存檔。

公開站部署後可執行：

```sh
PRODUCTION_URL=https://willcoming.github.io/SurvivalTowerDefense/ VALIDATION_OUTPUT_DIR=/tmp/starfall-offline-live npm run test:offline
```

公開站驗證不修改網站或玩家存檔。發布腳本已在推送前加入離線核心與正式產物驗證；上線後比對 Service Worker、manifest、圖示及程式檔，再驗證公開網址的離線操作。部署摘要會保留在 `dist/offline-local-verification.json` 與 `dist/offline-live-verification.json`，不隨測試暫存資料夾刪除。

真機驗收需另外使用 iPhone／iPad Safari 與 Android Chrome：安裝至主畫面、安裝後首次開啟完成下載、關閉遊戲、開啟飛航模式、從圖示重開並開始戰鬥，再確認永久進度。桌面模擬與 WebKit 測試不等同真機主畫面安裝測試；尚未取得真機驗收結果。
