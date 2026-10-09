# 給 Codex 的戰鬥畫面「去線條化」精煉指令 (Prompt)

請將以下整段文字複製並直接發送給 Codex：

---

```markdown
請根據專案中的 `codex-rework/05-PHASE3_VISUAL_REFINEMENT_NO_LINES.md` 規格，執行《星骸防線》戰鬥畫面的「去線條化與光效粒子升級」：

### 🎯 核心修改要求：

使用者反饋戰鬥畫面有「太多生硬突兀的幾何線條」，嚴重干擾畫面沉浸感與質感。請進行以下徹底優化：

1. **移除全屏紅色虛線與集火連線 (`src/game/focus-overlay.ts`)**：
   - **移除橫貫螢幕的紅色虛線**：刪除 `for (let x = 0; x < WORLD.width; x += 20) line(...)`。不要在戰場中央畫生硬的紅色虛線，若需要警戒感，僅在觸發威脅時呈現極淡的地面微光（alpha <= 0.05）。
   - **移除 5 條隊員紅色雷射導引線**：刪除 `for (const id of run.config.squadIds) line(this.guide, [origin(id, enemy!.x), this.target], ...)`。點選手動集火時，隊員會自動攻擊目標，不需要在畫面上拉出 5 條直挺挺的紅線切碎視野。
   - **精緻化目標鎖定框**：目標身上僅保留精緻微小的鎖定角標或半透明菱形，消除生硬線框感。
   - 保留 `diagnostics()` 回傳格式，確保測試通過。

2. **元素連鎖特效「全面粒子光斑化，消除描邊幾何線」(`src/game/combo-effects.ts`)**：
   - 🌀 **【烈焰黑洞】**：徹底移除 3 條長長的螺旋描邊線（刪除 `for(let arm=0;arm<3;arm++) ... g.strokePath()`）。改用**中心暗紫光核（柔和圓形漸層）** 與 **橘紫雙色粒子向中心加速旋轉收斂**（粒子從 60px 半徑吸入至中心 0px），呈現真正的深空黑洞吸積感！
   - ⚡ **【超導貫穿】**：徹底移除 6 道折線幾何蜘蛛網（刪除 `moveTo -> lineTo -> lineTo -> lineTo -> strokePath()`）。改用命中瞬間的**短暫淡藍強光核心**與向外爆散的**藍白電火花粒子**，電光俐落有力，不留幾何折線。
   - 💥 **【電磁引爆】**：徹底移除 8 道放射直線（刪除 `lineBetween`）。改用柔和擴散的半透明青藍能量光圈與受擊頓挫。
   - 保持所有文字標籤（`烈焰黑洞`、`超導貫穿`等）、`REACTIONS` 與 `diagnostics()`，確保現有測試相容。

3. **防線 EMP 衝擊波光暈化 (`src/game/crisis-effects.ts`)**：
   - 將單薄的描邊線圈（`g.lineStyle`）改為柔和漸變填充的半透明能量衝擊環（`g.fillStyle(0xa8f4ff, ...)`），營造厚重的能量擴散感。

4. **全量驗證**：
   執行並確保以下指令全部 100% 通過：
   `npm run typecheck`
   `npm run test:rules`
   `npm run build`
   `npx playwright test tests/e2e/phase1-visual-focus.spec.ts`
   `npx playwright test tests/e2e/phase2-commander.spec.ts`
   `npx playwright test tests/e2e/phase3-combat-restore.spec.ts`
```
