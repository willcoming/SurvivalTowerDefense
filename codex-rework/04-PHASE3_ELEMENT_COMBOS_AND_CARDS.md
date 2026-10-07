# 04. 第三階段實施規格：雙元素連鎖與流派卡片化 (Phase 3)

> **目標**：大幅深化策略動腦維度，使角色搭配產生化學反應；重構手機端配點介面，降低認知負擔。

---

## 任務 1：雙元素連鎖反應系統 (Elemental Reaction Engine)

### 1.1 系統目標：從「單純剋制 1.5 倍」進化為「隊友化學反應」
目前各角色武器具有固有屬性（熱能、電漿、重力、物理）。
在 `src/sim/combat.ts` 的 `hitEnemy()` 中，偵測目標身上已存在的元素狀態與新攻擊屬性的交集：

### 1.2 連鎖反應規則表

| 元素 A（目標已有） | 元素 B（新命中） | 觸發連鎖名稱 | 數值與機制規格 |
|:---|:---|:---|:---|
| **熱能（燃燒）** | **重力（牽引）** | **【烈焰黑洞】** | 產生半徑 140px 吸力漩渦將周圍怪吸入，並將目標身上所有燃燒層數與傷害立即擴散至漩渦內所有敵人。 |
| **電漿（感電）** | **物理（子彈）** | **【超導貫穿】** | 該發物理子彈 100% 暴擊，無視 100% 護甲，並分裂出 3 道電弧跳躍至鄰近目標。 |
| **重力（減速）** | **電漿（雷擊）** | **【電磁引爆】** | 瞬間引爆剩餘減速時間，造成目標最大生命值 12% 的真實傷害，並強制打斷正在進行的蓄力動作。 |
| **熱能（燃燒）** | **電漿（感電）** | **【等離子過載】** | 引發範圍 80px 爆炸，對護盾造成 300% 破壞傷害。 |

### 1.3 代碼落點：`src/sim/combat.ts`
```ts
function checkElementalCombo(s: RunState, e: Enemy, incomingType: DamageType, rawDamage: number) {
  const hasBurn = e.effects.some(f => f.kind === 'burn' && f.expires > s.tick);
  const hasSlow = e.effects.some(f => f.kind === 'slow' && f.expires > s.tick);

  if (hasBurn && incomingType === 'gravity') {
    // 觸發烈焰黑洞
    emit(s, { kind: 'combo_flame_vortex', x: e.x, y: e.y });
    for (const nearby of area(s, e.x, e.y, 140)) {
      applyEffect(s, nearby, { id: 'combo_burn', kind: 'burn', value: rawDamage * 0.4, expires: s.tick + ticks(3) });
      knockback(s, nearby, -30); // 向中心聚攏
    }
  } else if (hasSlow && incomingType === 'plasma') {
    // 觸發電磁引爆
    interrupt(s, e);
    hitEnemy(s, e, { source: 'combo', raw: e.maxHp * 0.12, damageType: 'plasma', armorIgnore: 1 });
  }
}
```

---

## 任務 2：手機端波末配點「三色流派推薦卡片」介面

### 2.1 修改目標檔案：`src/ui/skill-constellation.ts` & `src/ui/battle.ts`
* **痛點**：手機 390px 畫面上 24 個密集小黑圈讓一般玩家迷失且無法閱讀。
* **改進架構**：
  在波末配點對話框中，採用雙層呈現模式：
  1. **預設模式（流派引導卡片）**：
     * 展示當前出戰隊伍推薦的「三大核心流派」：
       * **卡片 A：【超導電弧・群攻狂潮】**（一鍵依最優路徑解鎖急速供彈、連鎖導引）
       * **卡片 B：【天基滅殺・破盾狙擊】**（一鍵解鎖穿透彈頭、重型彈腔）
       * **卡片 C：【奇點塌縮・時滯黑洞】**（一鍵解鎖重力波紋、聚變引力）
     * 點擊卡片直接預覽並配置該路線所需的點數。
  2. **高階模式（24 節點全景星圖）**：
     * 右上角提供「切換為完整星圖」按鈕。
     * 點擊後無縫切換至原有的完整星圖與拖曳縮放畫布，滿足重度玩家自由混搭需求。

---

## 任務 3：全量驗證與交付

Codex 完成修改後，必須執行以下驗證套件：
```bash
npm run typecheck
npm run test:rules
npm run test:simulation
npx playwright test tests/e2e/ui-review.spec.ts
npm run build
```
確認所有既有測試皆 Passed，並確認畫面沒有文字重疊與佈局錯誤。
