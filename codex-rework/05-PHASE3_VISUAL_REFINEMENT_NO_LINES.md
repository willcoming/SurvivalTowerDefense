# 05. 戰鬥畫面「去線條化」視覺精煉規格 (Visual De-cluttering & Line Polish)

> **使用者的核心回饋**：
> 「戰鬥畫面太多像這樣子的線條，檢查完後請 Codex 再處理。」
> 
> **視覺問題根源診斷**：
> 目前戰鬥畫面中使用了大量 Phaser Graphics 的幾何描邊（`lineStyle` / `strokePath` / `lineBetween` / 虛線 `line`），包括：
> 1. **全屏橫貫紅色虛線警戒線**：生硬橫切在戰場中央（Y=230），像施工警戒線或調試標記。
> 2. **集火 5 條雷射導引線**：點選目標時從 5 位隊員身上拉出 5 條筆直紅線，畫面被嚴重割裂。
> 3. **元素連鎖生硬線條**：烈焰黑洞畫了 3 條螺旋幾何細線（像蜘蛛腳/蚊香）、超導貫穿畫了 6 道鋸齒折線（像破碎蜘蛛網）、電磁引爆畫了 8 道射線。
> 4. **EMP 衝擊波空心線圈**：單薄的幾何描邊圓圈，缺乏能量衝擊波的厚重光暈感。
>
> **改造核心原則**：
> **「以粒子光暈（Glow & Particles）取代生硬描邊線（Vector Lines）」**。現代高質感手遊特效應是柔和的光芒、擴散光環與飛散粒子，而非數學幾何線框！

---

## 任務 1：移除集火導引線與全屏虛線 (`src/game/focus-overlay.ts`)

### 1.1 移除 5 條隊員紅色連線
* **刪除**：`for (const id of run.config.squadIds) line(this.guide, [origin(id, enemy!.x), this.target], 0xff595e, 1.5, .5);`
* **原因**：隊員會自動攻擊集火目標，不需要在畫面上拉出 5 條紅色細線干擾視野。

### 1.2 移除橫跨螢幕的紅色虛線
* **刪除**：`for (let x = 0; x < WORLD.width; x += 20) line(this.guide, [{ x, y }, { x: Math.min(WORLD.width, x + 12), y }], 0xff595e, 1.5, this.threatAlpha);`
* **替換**：移除整條虛線。當 `this.threatened` 觸發時，僅在該區域呈現極淡的地面微光（`fillRect(0, y - 10, WORLD.width, 20)`，alpha <= 0.05），或者完全不畫線，保持畫面乾淨。
* **相容性**：`diagnostics()` 仍需回傳 `{ y, active: this.threatened, alpha: this.threatAlpha }`，確保 Phase 1 E2E 測試通過。

### 1.3 精緻化目標鎖定準星
* 目標腳下或身上僅保留精緻、小巧的鎖定角標（Corner Brackets）或半透明菱形，不使用刺眼的粗描邊線。

---

## 任務 2：元素連鎖特效「去線條化」(`src/game/combo-effects.ts`)

徹底移除所有生硬的 `g.lineStyle` 描邊線段，全面改為**柔和光斑、光暈與飛散/聚攏粒子**：

### 2.1 🌀 烈焰黑洞 (`combo_vortex`)
* **移除**：刪除 3 條螺旋曲線描邊（`for(let arm=0;arm<3;arm++) ... g.strokePath()`）。
* **改為粒子收縮與中心暗核**：
  * **中心暗核光暈**：中心繪製 1 個向內收縮的暗紫色半透明圓形光斑（`fillCircle`，alpha 隨時間變化）。
  * **聚攏粒子流**：12~16 顆微小橘紫雙色粒子（`fillCircle(..., 2~3px)`），半徑隨時間從 60px 向中心 0px 加速收斂（收縮吸入感），動態強烈且完全無生硬線條！

### 2.2 ⚡ 超導貫穿 (`combo_superconduct`)
* **移除**：刪除 6 道鋸齒折線（`moveTo ... lineTo ... lineTo ... lineTo ... strokePath()`）。
* **改為瞬態高亮星芒與電火花爆散**：
  * **中心電光微閃**：受擊瞬間（前 100ms）在命中點繪製短暫淡藍強光核心（`fillCircle`，半徑 12px 迅速淡出）。
  * **飛散電火花粒子**：6~10 顆細小藍白粒子（`fillCircle(..., 1.5~2.5px)`）向外爆散（半徑隨時間擴散），如同真實的高壓電流短路火花，視覺俐落清脆！

### 2.3 💥 電磁引爆 (`combo_emp`)
* **移除**：刪除 8 道直線射線（`lineBetween`）。
* **改為擴散能量光環與核心爆震**：
  * 以半透明青藍色漸變擴散圓（填色或平滑光環）呈現衝擊波，配合目標受擊頓挫（Hit-stop）與文字標籤，乾淨有力。

### 2.4 保留測試相容性
* 保留 `REACTIONS` 設定、文字浮動標籤（500ms 淡出）、`pool` 與 `diagnostics()`，確保 `phase3-combat-restore.spec.ts` 依然 100% 通過。

---

## 任務 3：防線 EMP 衝擊波光暈化 (`src/game/crisis-effects.ts`)

* **移除**：單薄的幾何描邊線圈（`g.lineStyle(5, ...).strokeCircle`）。
* **改為**：柔和漸變填充的半透明能量衝擊環（`g.fillStyle(0xa8f4ff, (1 - progress) * 0.15).fillCircle(...)`），讓衝擊波具備震撼的能量擴散質感，而不是像幾何線框。

---

## 🧪 驗收清單 (Acceptance Criteria)

- [ ] 戰鬥中**不再有橫跨螢幕中央的紅色虛線**。
- [ ] 點選目標集火時，**不再出現 5 條直射隊員紅線**，僅在目標處顯示簡潔精緻鎖定標記。
- [ ] 烈焰黑洞**無任何幾何螺旋細線**，改為純粒子流向中心旋轉吸入。
- [ ] 超導貫穿**無任何幾何鋸齒蜘蛛網折線**，改為電火花粒子爆散與電芒微閃。
- [ ] 電磁引爆與防線 EMP **無生硬線框**，改為柔和光暈能量環。
- [ ] 全量測試 100% 通過：
  ```bash
  npm run typecheck
  npm run test:rules
  npm run build
  npx playwright test tests/e2e/phase1-visual-focus.spec.ts
  npx playwright test tests/e2e/phase2-commander.spec.ts
  npx playwright test tests/e2e/phase3-combat-restore.spec.ts
  ```
