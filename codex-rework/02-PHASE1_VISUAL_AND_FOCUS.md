# 02. 第一階段實施規格：畫面降噪與手動集火 (Phase 1)

> **目標**：解決畫面文字噪音、增添手動操作感（打破純觀戰）、強化暴擊打擊反饋。
> **工期預估**：優先執行，具備最高的視覺與手感投資報酬率。

---

## 任務 1：移除怪頭頂燃燒中文標籤，改為體表粒子與微光

### 1.1 修改目標檔案：`src/game/status-effects.ts`
* **問題**：`this.labels` 預先生成了 12 個 Text 物件，在每隻著火的怪物頭頂輸出 `燃燒 ${value}`，造成嚴重視覺污染。
* **修改動作**：
  1. 移除 `this.labels` 文字陣列的生成與渲染。
  2. 確保 `status-burn` 粒子圍繞在怪物 Sprite 中心（而不是頭頂上方）：
     ```ts
     // 原本位置：
     // y: enemy.y - size.height * 0.7 (太高，容易與上方怪物重疊)
     // 改為：
     // y: enemy.y - size.height * 0.2 (貼合身軀)
     ```
  3. 保留怪物受到燃燒時的紅色/橙色體表 Tint 閃爍：
     ```ts
     enemySprite.setTint(active.has('burn') ? 0xff7b42 : 0xffffff);
     ```

---

## 任務 2：傷害跳字 300ms 聚合視窗與暴擊特寫

### 2.1 修改目標檔案：`src/game/effects.ts`
* **修改動作**：
  1. 為每個受到持續傷害的敵人維護一個 `accumulatedDamage: { total: number, lastFlush: number }` 快取。
  2. 小額持續傷害（DOT）每 300ms 刷新一次合併跳字，文字大小 12px，半透明向上漂移淡出。
  3. **暴擊 / 弱點破壞（Critical Hit）**：
     * 文字樣式：`fontSize: '22px', fontStyle: '900', color: '#ffde59', stroke: '#3a1a00', strokeThickness: 4`
     * 動畫曲線：先瞬間放大至 1.3 倍，彈跳升起 24px，持續 400ms 後消散。

---

## 任務 3：實裝「手動點擊集火（Focus Fire）」機制

### 3.1 修改資料模型：`src/sim/types.ts`
在 `RunState` 介面增加：
```ts
export interface RunState {
  // ...既有欄位
  focusTargetId?: number | null; // 玩家手動集火之敵人 ID
}
```

### 3.2 修改索敵邏輯：`src/sim/combat.ts`
在 `threat(s: RunState): Enemy[]` 函式中，賦予 `focusTargetId` 最高優先權：
```ts
export function threat(s: RunState): Enemy[] {
  const rank = (e: Enemy) => {
    // 玩家手動鎖定的目標擁有絕對最高優先級（只要存活）
    if (s.focusTargetId && e.id === s.focusTargetId) return 10;
    if (e.chargeKind && e.chargeUntil > s.tick) return boss(e) ? 4 : e.defId === 'E05' ? 3 : 0;
    return e.y >= WORLD.wallY ? 2 : 0;
  };
  return alive(s).sort((a, b) => rank(b) - rank(a) || b.y - a.y || a.id - b.id);
}
```
* 當目標死亡時，在 `combat.ts` 的死亡結算處自動重置：`if (s.focusTargetId === deadEnemy.id) s.focusTargetId = null;`。

### 3.3 修改 Phaser 渲染層：`src/game/scene.ts`
1. **敵人點擊互動**：
   在敵人 Sprite 建立時加入互動：
   ```ts
   sprite.setInteractive({ useHandCursor: true });
   sprite.on('pointerdown', () => {
     const run = this.state();
     if (!run) return;
     run.focusTargetId = (run.focusTargetId === enemy.id) ? null : enemy.id;
   });
   ```
2. **全息集火準星與雷射導引線**：
   * 若 `run.focusTargetId` 存在且有效：
     * 在該怪物周圍繪製一個半徑 `radius + 12px` 的旋轉紅色菱形準星（`graphics.strokeRect` 或貼圖）。
     * 從目前出戰的 5 名隊員槍口，各拉出一條淡紅色半透明雷射瞄準線（寬度 1.5px，alpha 0.5）。
     * 玩家再次點擊該目標或目標陣亡時，準星擴散淡出。

---

## 任務 4：戰場威脅警戒紅線與受創震屏反饋

### 4.1 修改目標檔案：`src/game/scene.ts`
1. **威脅警戒線繪製**：
   * 在戰場 Y 座標 `WORLD.wallY - 220` 處繪製一條虛線警戒光芒。
   * 當 `run.enemies.some(e => e.y >= WORLD.wallY - 220)` 為 true 時，警戒線 Alpha 由 0.25 變為 0.85 伴隨微弱脈衝呼吸。
2. **暴擊 / 大招打擊微震屏（Screen Shake）**：
   * 當偵測到重大打擊事件（Boss 受擊、全屏終極技釋放）時呼叫：
     ```ts
     this.cameras.main.shake(100, 0.005); // 持續 100ms，震幅 0.5%，微小且有力量感
     ```

---

## 驗證清單 (Acceptance Criteria)

- [ ] 運行 `npm run test:rules`，既有測試無任何破損。
- [ ] 進入戰鬥第 1 波，怪群中不再出現「燃燒 20.3」等文字重疊。
- [ ] 點選任意一隻怪，該怪頭頂出現紅色準星，隊員子彈明顯轉向該怪集火。
- [ ] 暴擊傷害字體放大至 22px，並帶有彈跳動效。
- [ ] 威脅警戒線在有怪物接近時高亮閃爍。
