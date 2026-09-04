import { expect, it } from 'vitest';
import { shouldAutoCast } from '../../src/ui/auto-tactical';
import { createRun, command } from '../../src/sim/engine';
import { createEnemy } from '../../src/sim/combat';
import { CHARACTER_IDS } from '../../src/data/content';
it.each(CHARACTER_IDS)('%s auto input respects target, cooldown, pause, upgrades and no-skill challenge', captainId => {
  const s=createRun({stageId:'S01',squadIds:[captainId],captainId,seed:101});s.enemies=[];
  expect(shouldAutoCast(s,true)).toBe(false);
  const e=createEnemy(s,'E03',195,180);e.hp=e.maxHp=100000;expect(shouldAutoCast(s,false)).toBe(false);expect(shouldAutoCast(s,true)).toBe(true);
  command(s,{type:'cast'});expect(s.stats.casts).toEqual([0]);expect(shouldAutoCast(s,true)).toBe(false);
  s.tick=s.tacticalReadyAt;expect(shouldAutoCast(s,true)).toBe(true);
  for(const phase of ['paused','choosing','ended'] as const){s.phase=phase;expect(shouldAutoCast(s,true)).toBe(false);}
  s.phase='running';s.config.challengeId='no-skill';expect(shouldAutoCast(s,true)).toBe(false);
  s.config.challengeId=null;e.hp=0;expect(shouldAutoCast(s,true)).toBe(false);
});
