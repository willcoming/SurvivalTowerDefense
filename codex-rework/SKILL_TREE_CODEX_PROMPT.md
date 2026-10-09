# 給 Codex 的「技能樹與星圖 UI/UX 重構」精煉指令 (Prompt)

請直接將以下整段 Markdown 內容複製發送給 Codex：

---

```markdown
請根據專案中的 `codex-rework/07-SKILL_TREE_UI_REWORK.md` 規格，徹底重構《星骸防線》波末配點與圖鑑中的「24 節點專家星圖」介面與互動體驗：

### 🚨 現況痛點與禁令（使用者明確要求徹底改善體驗）：
1. ❌ **嚴禁使用覆蓋全屏中央的置中大彈窗**：目前點選節點時，置中 Dialog 把節點本身以及前後分支連線全部遮死，玩家無法一邊看星圖一邊配點。
2. ❌ **嚴禁手機端（390px）兩側截斷**：預設視野必須自動完整囊括整棵星圖的水平寬度，不能讓左右兩側分支被切出螢幕外。
3. ❌ **嚴禁在畫布右上角堆疊手勢提示文字**：目前「虛線：跨分支前置 · 拖曳／縮放」生硬壓在右上角節點上，必須清除。
4. ❌ **嚴禁全員千篇一律的小劍圖標**：絕大部分節點都畫同一把小劍（⚔️），必須按加成類型提供多元專業圖標。

---

### 🎯 核心實裝目標：

#### 1. 互動重構：非遮蔽「底部抽屜 (Bottom Sheet)」取代置中彈窗 (`src/ui/deep-tree.ts`)
* **手機端（< 1024px）**：
  * 點擊節點時，不再使用居中遮罩彈窗，改為從螢幕底部滑出高約 140px ~ 155px 的半透明科技深藍底【底部抽屜】（`.skill-bottom-sheet`）。
  * **星圖保持清晰可見**：相機自動平滑將被點選的節點置於螢幕中上方視野，節點外圈綻放聚光光環。
  * 抽屜內直觀展示：**44px 專屬圖標**、**技能名稱**、**狀態標籤**、**一針見血的效果描述**、**前置解鎖條件**、**【確認配置】按鈕**（綠/金主色）與微型【關閉】按鈕。
  * 玩家可邊看著星圖上的完整脈絡，邊直接在底部抽屜點擊配置，0 視窗開關疲勞感。
* **桌面端（≥ 1024px）**：
  * 採用雙欄佈局：左側 70% 完整星圖全景，右側 30%（寬 340px）常駐詳細資訊與隊伍即時武器數值聯動。
* **DOM 契約相容**：
  * 必須完整保留 `data-action="buy-node"`、`data-action="tree-detail-close"`、`data-action="deep-node"` 等屬性，確保既有 E2E 測試無縫通過。

#### 2. 視窗適配與邊界最佳化 (`src/ui/skill-map-controls.ts`)
* 打開波末配點時，相機自動計算最佳視角（Auto-Fit），確保 390px 直式螢幕下所有水平分支（24 節點的左右端點）皆完整落在螢幕邊界內，不再被兩側裁切。
* 移除畫布右上角生硬懸掛的 `.network-gesture-hint` 文字，將提示移至工具列或圖例中。

#### 3. 終極技能節點的殿堂級視覺 (`src/ui/skill-constellation.ts` & `src/ui/skill-constellation.css`)
* 終極技能節點（`node.kind === 'ultimate'`）尺寸加大 1.35x（直徑提升至 58px ~ 62px）。
* 擁有高貴的**雙層旋轉金環邊框**、深邃金黑漸變底座與金色呼吸微粒，成為整棵星圖無可忽視的終點地標。

#### 4. 多元專業節點圖標 (`src/ui/skill-constellation.ts` 的 `skillEmblem`)
依據 `node.mods` 與技能特性，分類實裝 7 大類專屬 SVG 圖標：
1. **攻擊增傷 (Damage)**：銳利光刃（Blade）
2. **攻速散熱 (Haste/Cooling)**：疾風閃電 / 散熱風道（Lightning/Vent）
3. **穿甲破防 (Armor Pierce)**：破甲箭鏃（Piercing Arrow）
4. **暴擊弱點 (Crit/Weakness)**：十字準心 / 暴擊星芒（Scope/Star）
5. **範圍引力 (Radius/Pull)**：同心圓環 / 吸積漩渦（Vortex/Ring）
6. **防禦力場 (Shield/Armor)**：科技能量盾（Shield）
7. **彈道分流 / 飛彈 (Missile/Split)**：散射多重箭頭 / 雙子火箭（Missiles/Split）

#### 5. 節點狀態辨識度升級 (`src/ui/skill-constellation.css`)
* **`owned`（已取得）**：高飽和亮色底盤 + 金色勾號，向外連線持續發光。
* **`available`（可配置）**：醒目的呼吸邊框脈衝光，強烈吸引玩家點擊。
* **`pending`（待確認）**：金色跑馬邊框 + 「+1」標記。
* **`locked`（未達成前置）**：半透明暗灰底，點擊時在底部抽屜以琥珀色標示未達成的前置名稱。

---

### 🧪 驗證指令要求：
請依序執行並確保以下檢查 100% 通過：
1. `npm run typecheck`
2. `npm run test:rules`
3. `npm run build`
4. `npx playwright test tests/e2e/skill-trees.spec.ts`
5. `npx playwright test tests/e2e/skill-rework.spec.ts`
```
