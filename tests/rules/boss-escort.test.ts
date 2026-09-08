import { describe, expect, it } from 'vitest';
import { createRun, stepRun, restoreRun, command } from '../../src/sim/engine';
import { BOSS_ESCORT_COUNT } from '../../src/sim/enemies';
import type { StageId } from '../../src/sim/types';

function entrance(stageId: StageId, version?: string) {
  const s = createRun({stageId,squadIds:['C01'],captainId:'C01',seed:101}, version);
  s.tick=10799;s.enemies=[];s.spawnCursor=s.spawnPlan.length;
  s.weapons[0].nextAttack=99999;
  stepRun(s);return s;
}
describe('Boss entrance escort surge', () => {
  for (const stage of ['S01','S02','S03'] as const) {
    it(`${stage}: spawns 32 escorts simultaneously with the boss and freezes them during the entrance`, () => {
      const s=entrance(stage), escorts=s.enemies.filter(e=>!e.defId.startsWith('B'));
      expect(escorts).toHaveLength(BOSS_ESCORT_COUNT);
      expect(s.enemies.filter(e=>e.defId.startsWith('B'))).toHaveLength(1);
      expect(escorts.every(e=>e.spawnedAt===10800&&e.wave===9&&e.xp===0&&e.y<150)).toBe(true);
      expect(new Set(escorts.map(e=>`${e.x},${e.y}`)).size).toBe(BOSS_ESCORT_COUNT);
      const frozen=structuredClone(s);stepRun(s,100);expect(s).toEqual(frozen);
      const restored=restoreRun(structuredClone(s));
      expect(command(restored,{type:'finish-boss-intro'})).toBe(true);
      stepRun(restored);
      expect(restored.enemies).toHaveLength(33);
      expect(restored.enemies.find(e=>e.id===escorts[0].id)!.y).toBeGreaterThan(escorts[0].y);
      const repeated=entrance(stage);expect(repeated.enemies).toEqual(frozen.enemies);
    });
  }
  it('keeps legacy entrances unchanged', () => {
    expect(entrance('S01','0.3.0-dev.1').enemies).toHaveLength(1);
  });
});
