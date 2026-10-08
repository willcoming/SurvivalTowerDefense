# 04. 第三階段實施規格：雙元素連鎖與流派卡片化 (Phase 3)

> **目標**：深化策略動腦（讓角色組合產生化學反應）與重構手機配點介面（一秒看懂流派走向）。
> **前置依賴**：Phase 1 與 Phase 2 已順利完成並全數測試通過。

---

## 🎯 Phase 3 核心交付物清單

1. **雙元素連鎖反應引擎（Elemental Reaction Engine）**：
   * 4 組角色元素跨界化學反應（烈焰黑洞、超導貫穿、電磁引爆、等離子過載）。
   * 連鎖特效粒子與專屬浮空文字標籤。
   * 首領真傷上限與防刷 CD 保護（同一敵人 0.5s 內不重複觸發同連鎖）。
2. **手機端波末配點「三色流派導向卡片」介面**：
   * 波末配點彈窗在手機尺寸（< 768px）預設呈現三張大卡片：
     * **卡片 A【群攻掃蕩流】**（連鎖電弧・範圍覆蓋）
     * **卡片 B【弱點斬首流】**（穿透破盾・致命暴擊）
     * **卡片 C【控場時滯流】**（引力牽引・打斷蓄力）
   * 提供「一鍵依流派選配」按鈕，自動沿著最優前置節點分配可用點數。
   * 保留「切換至 24 節點專家星圖」按鈕，高階玩家隨時可無縫切回自由星圖畫布。
3. **專屬驗證測試**：
   * `tests/rules/phase3-combos.test.ts`（元素連鎖規則、傷害結算、邊界防護測試）
   * `tests/e2e/phase3-cards.spec.ts`（卡片式配點點擊、切換星圖、連鎖畫面回饋 E2E）

---

## 🛠️ 詳細代碼修改規格與落點

### 任務 1：雙元素連鎖反應系統 (`src/sim/combat.ts`)

#### 1.1 資料結構 (`src/sim/types.ts`)
在 `Enemy` 增加連鎖冷卻紀錄：
```ts
export interface Enemy {
  // ...既有欄位
  comboCooldowns?: Partial<Record<'vortex' | 'superconduct' | 'emp' | 'overload', number>>;
}
```

#### 1.2 連鎖觸發公式 (`src/sim/combat.ts`)
在 `hitEnemy(s: RunState, e: Enemy, p: DamagePacket)` 命中結算處：
```ts
// 檢查雙元素連鎖反應
function triggerElementalCombo(s: RunState, e: Enemy, p: DamagePacket, damageDealt: number) {
  if (e.hp <= 0) return;
  e.comboCooldowns = e.comboCooldowns ?? {};

  const hasBurn = e.effects.some(f => f.kind === 'burn' && f.expires > s.tick);
  const hasSlowOrStun = e.effects.some(f => (f.kind === 'slow' || f.kind === 'stun') && f.expires > s.tick);
  const isKinetic = p.damageType === 'kinetic';
  const isPlasmaOrArc = p.damageType === 'plasma' || p.damageType === 'arc';
  const isGravity = p.damageType === 'gravity';

  // 1. 【烈焰黑洞】 (熱能燃燒 + 重力吸引)
  if (hasBurn && isGravity && (e.comboCooldowns.vortex ?? 0) <= s.tick) {
    e.comboCooldowns.vortex = s.tick + 15; // 0.5s CD
    emit(s, { kind: 'combo_vortex', x: e.x, y: e.y });
    for (const nearby of area(s, e.x, e.y, 140)) {
      knockback(s, nearby, -35); // 向中心聚攏
      applyEffect(s, nearby, { id: 'combo-flame', kind: 'burn', value: damageDealt * 0.35, expires: s.tick + ticks(3) });
    }
  }

  // 2. 【超導貫穿】 (電漿/電弧 + 物理動能)
  if (isPlasmaOrArc && (e.exposureUntil > s.tick || e.effects.some(f => f.kind === 'exposure')) && isKinetic) {
    p.critical = true;
    p.armorIgnore = 1; // 100% 破甲
    emit(s, { kind: 'combo_superconduct', x: e.x, y: e.y });
  }

  // 3. 【電磁引爆】 (重力減速/暈眩 + 電漿/電弧)
  if (hasSlowOrStun && isPlasmaOrArc && (e.comboCooldowns.emp ?? 0) <= s.tick) {
    e.comboCooldowns.emp = s.tick + 15;
    interrupt(s, e);
    const trueDamage = Math.min(boss(e) ? 1500 : 99999, e.maxHp * 0.12);
    e.hp = Math.max(0, e.hp - trueDamage);
    emit(s, { kind: 'combo_emp', x: e.x, y: e.y, value: trueDamage });
  }

  // 4. 【等離子過載】 (熱能燃燒 + 電漿直擊)
  if (hasBurn && isPlasmaOrArc && e.shield > 0 && (e.comboCooldowns.overload ?? 0) <= s.tick) {
    e.comboCooldowns.overload = s.tick + 15;
    p.shieldMultiplier = (p.shieldMultiplier ?? 1) * 2.5;
    emit(s, { kind: 'combo_overload', x: e.x, y: e.y });
  }
}
```

---

### 任務 2：Phaser 連鎖反應畫面反饋 (`src/game/scene.ts` & `src/game/effects.ts`)

1. **連鎖文字標籤**：
   收到連鎖事件時，在目標頭頂彈出專屬亮色標籤（持續 500ms 向上淡出）：
   * 🌀 **烈焰黑洞**：紫橙色漸層字體
   * ⚡ **超導貫穿**：藍白電光字體
   * 💥 **電磁引爆**：青藍色震盪字體
   * 🛡️ **過載破盾**：金黃色碎裂字體
2. **視覺動效**：
   * `combo_vortex`：繪製向內收縮的紫色螺旋粒子環。
   * `combo_emp`：目標周圍迸發球形藍色電火花。

---

### 任務 3：手機端波末配點「三色流派導向卡片」介面 (`src/ui/battle.ts`)

#### 3.1 UI 呈現原則
* 手機直向視窗（< 768px）進入波末配點時，預設顯示 `.build-cards-view`。
* 桌面端（≥ 768px）或玩家點擊「展開完整星圖」時，顯示原有的 `.network-view`。
* 兩者使用完全相同的 `command(s, { type: 'buy-node' })`，保證存檔與底層規則 100% 一致。

#### 3.2 卡片佈局架構
```html
<section class="build-cards-view" aria-label="推薦戰術流派">
  <div class="build-card build-card-aoe">
    <div class="card-tag">流派 A · 清群掃蕩</div>
    <h3>【連鎖電弧・散彈漫天】</h3>
    <p>特化清怪覆蓋率與電弧跳躍</p>
    <div class="card-progress">核心：分流槍機 ➔ 急速供彈</div>
    <button data-action="quick-build" data-route="A" class="build-card-btn">一鍵選配 (2 點)</button>
  </div>
  <!-- 卡片 B 破盾狙殺、卡片 C 引力控場 同理 -->
  <button data-action="toggle-expert-constellation" class="toggle-expert-btn">
    🔍 切換為 24 節點專家星圖
  </button>
</section>
```

---

## 🧪 驗證與驗收標準

Codex 必須建立並通過以下測試：
1. `tests/rules/phase3-combos.test.ts`：
   * 燃燒+重力 100% 觸發黑洞聚怪與擴散燃燒。
   * 減速+電漿 100% 觸發電磁引爆真傷與蓄力打斷，首領上限不超過 1500。
   * 防刷冷卻生效（0.5s 內同一目標不重複引爆）。
2. `tests/e2e/phase3-cards.spec.ts`：
   * 390px 尺寸下波末配點預設展示三張流派卡片。
   * 點擊「一鍵選配」成功扣點並解鎖合法前置技能。
   * 點擊「切換為 24 節點星圖」可無縫切換畫布。
3. 全量測試通過：
   ```bash
   npm run typecheck
   npm run test:rules
   npm run build
   ```
