# 給 Codex 的 Phase 2 執行指令 (Prompt)

請將以下整段文字複製並直接發送給 Codex：

---

```markdown
請根據專案中的 `codex-rework/03-PHASE2_CRISIS_AND_COMMANDER.md` 規格，執行《星骸防線》體驗重構的【第二階段：防線危機心流與指揮官戰術 (Phase 2)】。

### 核心任務目標：
1. **資料模型與指令擴充** (`src/sim/types.ts` & `src/sim/engine.ts`)：
   - 在 `RunState` 加入 `emergencyPulseUsed?: boolean`、`commanderTactical?: { barrierUsedInWave?: boolean; orbitalReadyAt?: number }`、`barrierUntil?: number`。
   - 擴充 `Command` 支援 `{ type: 'commander-skill', skill: 'barrier' | 'orbital', x?: number, y?: number }`。
2. **防線緊急保底 EMP 衝擊波** (`src/sim/combat.ts`)：
   - 當怪物攻擊導致防線生命值首次跌破 20% 時，自動觸發 1 次全場防護波：貼近防線 (y >= WORLD.wallY - 180) 的敵人全部擊退 200px 並暈眩 2 秒。
3. **指揮官主動戰術技能與力場** (`src/sim/engine.ts` & `src/game/scene.ts`)：
   - 🛡️【全息磁暴牆】：每波限 1 次，在 Y=500 生成 3 秒力場阻擋所有怪物通過。
   - 🚀【軌道集束砲】：冷卻 30 秒，點擊戰場任意位置，延遲 0.6 秒引發 120px 範圍轟炸與相機微震。
4. **防線瀕危全屏紅光心跳警報與戰術按鈕** (`src/ui/battle.ts` & `src/ui/battle-focus.css`)：
   - 防線 HP < 30% 時，在 `.battle-phone` 加上 `.threat-critical` 呼吸紅光。
   - 在戰鬥畫面右下方實裝磁暴牆與軌道砲的主動點擊按鈕與冷卻提示。
5. **編寫測試並驗收**：
   - 建立 `tests/rules/phase2-crisis.test.ts` 驗證 EMP 擊退、冷卻與指令合法性。
   - 建立 `tests/e2e/phase2-commander.spec.ts` 驗證視覺與按鈕互動。
   - 確保 `npm run typecheck`、`npm run test:rules`、`npm run build` 全數通過。
```
