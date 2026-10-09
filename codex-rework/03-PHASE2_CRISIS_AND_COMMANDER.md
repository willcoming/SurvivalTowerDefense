# 03. 第二階段實施規格：防線危機心流與指揮官戰術 (Phase 2)

> **目標**：營造防守戰的瀕死壓迫感與反殺刺激感，提供關鍵時刻的手動翻盤戰術手段。
> **前置依賴**：Phase 1 已成功驗證並合入，`npm run test:rules` 通過。

---

## 🎯 Phase 2 核心成果交付物清單

1. **防線瀕危全屏紅光心跳警報**（HP < 30% 呼吸紅光與脈衝）。
2. **防線緊急 EMP 過載衝擊波**（每局 1 次，HP < 20% 自動爆發擊退 200px 並暈眩 2 秒）。
3. **指揮官主動戰術技能**：
   * 🛡️ **【全息磁暴牆】（Barrier）**：在戰場中路 Y=500 生成 3 秒力場阻擋所有怪物通過（每波充能 1 次）。
   * 🚀 **【軌道集束砲】（Orbital）**：手動點擊戰場任意位置，延遲 0.6 秒引發 120px 範圍轟炸（冷卻 30 秒）。
4. **專屬測試**：
   * `tests/rules/phase2-crisis.test.ts`（規則與資料測試）
   * `tests/e2e/phase2-commander.spec.ts`（跨尺寸與戰術操作 E2E）

---

## 🛠️ 詳細代碼修改規格與落點

### 任務 1：資料模型擴充 (`src/sim/types.ts`)

在 `RunState` 介面擴充以下欄位：
```ts
export interface RunState {
  // ...既有欄位
  focusTargetId?: number | null;

  // Phase 2 新增：
  emergencyPulseUsed?: boolean; // 每場限 1 次緊急防護
  commanderTactical?: {
    barrierUsedInWave?: boolean; // 每波限 1 次磁暴牆
    orbitalReadyAt?: number;     // 軌道砲就緒 tick (冷卻 30s = 900 ticks)
  };
  barrierUntil?: number;        // 當前磁暴牆存在至哪一個 tick
}

export type Command =
  // ...既有 Command
  | { type: 'focus-target'; targetId: number | null }
  | { type: 'commander-skill'; skill: 'barrier' | 'orbital'; x?: number; y?: number };
```

在 `src/sim/engine.ts` 的 `createRun()` 初始化：
```ts
emergencyPulseUsed: false,
commanderTactical: { barrierUsedInWave: false, orbitalReadyAt: 0 },
barrierUntil: 0,
```

---

### 任務 2：防線緊急保底 EMP 衝擊波 (`src/sim/combat.ts`)

在 `damageWall(s: RunState, source: string, value: number)` 結算扣除 `wallHp` 處：
```ts
const damage = Math.min(s.wallHp, remaining);
s.wallHp -= damage;

// Phase 2: 防線緊急 EMP 過載防護
if (!s.emergencyPulseUsed && s.wallHp <= s.wallMaxHp * 0.2 && s.wallHp > 0) {
  s.emergencyPulseUsed = true;
  for (const e of alive(s)) {
    if (e.y >= WORLD.wallY - 180) {
      knockback(s, e, 200);
      applyEffect(s, e, { id: 'emp-stun', kind: 'stun', expires: s.tick + ticks(2) });
    }
  }
  emit(s, { kind: 'emp_wave', x: WORLD.width / 2, y: WORLD.wallY, value: 200 });
}
```

---

### 任務 3：指揮官戰術指令與力場判定 (`src/sim/engine.ts` & `src/sim/combat.ts`)

#### 3.1 指令處理 (`src/sim/engine.ts`)
在 `command(s: RunState, cmd: Command): boolean` 中加入：
```ts
if (cmd.type === 'commander-skill' && getPhase(s) === 'running') {
  if (cmd.skill === 'barrier') {
    if (s.commanderTactical?.barrierUsedInWave) return false;
    s.commanderTactical!.barrierUsedInWave = true;
    s.barrierUntil = s.tick + ticks(3); // 持續 3 秒
    emit(s, { kind: 'barrier-spawn', x: WORLD.width / 2, y: 500 });
    accepted = true;
  } else if (cmd.skill === 'orbital') {
    if (s.tick < (s.commanderTactical?.orbitalReadyAt ?? 0)) return false;
    s.commanderTactical!.orbitalReadyAt = s.tick + ticks(30); // 30 秒冷卻
    const tx = Math.max(20, Math.min(WORLD.width - 20, cmd.x ?? (WORLD.width / 2)));
    const ty = Math.max(40, Math.min(WORLD.wallY - 40, cmd.y ?? 260));
    // 延遲 18 ticks (約 0.6 秒) 爆炸
    s.scheduled.push({
      runAt: s.tick + 18,
      action: () => {
        emit(s, { kind: 'orbital-blast', x: tx, y: ty, value: 3000 });
        for (const e of area(s, tx, ty, 120)) {
          hitEnemy(s, e, { source: s.config.captainId, skill: 'orbital', raw: 3000, damageType: 'plasma', armorIgnore: 0.5, shieldMultiplier: 2 });
        }
      }
    });
    emit(s, { kind: 'orbital-aim', x: tx, y: ty });
    accepted = true;
  }
}
```
波次切換時重置磁暴牆：
在波次開始（`startNextWave`）時：
```ts
if (s.commanderTactical) s.commanderTactical.barrierUsedInWave = false;
```

#### 3.2 磁暴牆阻擋怪物移動 (`src/sim/engine.ts` 敵方步進處)
在怪物步進移動邏輯中：
若 `s.barrierUntil > s.tick`，怪物在 Y ≤ 500 時若下一移動會跨越 500，則將其 Y 座標限制在 500（無法前進）。

---

### 任務 4：防線瀕危紅光與戰術按鈕 UI (`src/ui/battle.ts`)

#### 4.1 全屏瀕危紅光警報
在 `updateHud` 中檢查防線生命比：
```ts
const critical = run.wallHp / run.wallMaxHp < 0.3;
const phone = document.querySelector('.battle-phone');
if (phone) phone.classList.toggle('threat-critical', critical);
```
樣式加入：
```css
@keyframes threat-heartbeat {
  0%, 100% { box-shadow: inset 0 0 20px rgba(239, 68, 68, 0.35); }
  50% { box-shadow: inset 0 0 50px rgba(239, 68, 68, 0.7); }
}
.battle-phone.threat-critical {
  animation: threat-heartbeat 1.2s infinite ease-in-out;
}
```

#### 4.2 指揮官主動戰術工具欄
在 `.battle-phone` 底部或側邊新增可點擊按鈕：
```html
<div class="commander-tactical-hud" role="toolbar" aria-label="指揮官戰術支援">
  <button data-action="cmd-barrier" class="cmd-tactical-btn" aria-label="展開全息磁暴牆">
    <span class="cmd-icon">🛡️</span>
    <b class="cmd-text">磁暴牆</b>
    <small id="cmd-barrier-status">就緒</small>
  </button>
  <button data-action="cmd-orbital" class="cmd-tactical-btn" aria-label="呼叫軌道集束砲">
    <span class="cmd-icon">🚀</span>
    <b class="cmd-text">軌道砲</b>
    <small id="cmd-orbital-status">就緒</small>
  </button>
</div>
```

---

### 任務 5：Phaser 視覺渲染層 (`src/game/scene.ts`)
1. **EMP 衝擊波環**：收到 `kind: 'emp_wave'` 時，在防線處生成藍色電磁圓環，迅速向上放大並漸隱。
2. **磁暴牆力場**：當 `run.barrierUntil > run.tick`，在 Y=500 處繪製藍色網格屏障線，帶電弧粒子。
3. **軌道砲爆炸與震屏**：收到 `kind: 'orbital-blast'` 時，繪製高爆金色衝擊波，並觸發 `this.cameras.main.shake(180, 0.008)`。

---

## 🧪 驗證與驗收標準

Codex 必須建立並通過以下測試：
1. `tests/rules/phase2-crisis.test.ts`：
   * 防線跌破 20% 確實觸發 EMP 擊退，且每局僅觸發 1 次。
   * 磁暴牆每波僅能使用 1 次，確實阻擋怪物越線。
   * 軌道砲每 30 秒冷卻，範圍傷害計算正確。
2. `tests/e2e/phase2-commander.spec.ts`：
   * 防線生命低於 30% 時，`.battle-phone` 帶有 `.threat-critical` 樣式。
   * 點擊磁暴牆按鈕，戰場出現力場特效。
   * 點擊軌道砲按鈕，目標點觸發爆炸與相機震動。
3. 全量測試通過：
   ```bash
   npm run typecheck
   npm run test:rules
   npm run build
   ```
