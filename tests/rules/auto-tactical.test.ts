import { expect, it } from 'vitest';
import { shouldAutoCast } from '../../src/ui/auto-tactical';
import { createRun, command } from '../../src/sim/engine';
import { stepWeapons } from '../../src/sim/weapons';
import { createEnemy } from '../../src/sim/combat';
import { CHARACTER_IDS } from '../../src/data/content';
it.each(CHARACTER_IDS.filter(id=>id!=='C07'))('%s auto input respects target, cooldown, pause, upgrades and no-skill challenge', captainId => {
  const s=createRun({stageId:'S01',squadIds:[captainId],captainId,seed:101});s.enemies=[];
  expect(shouldAutoCast(s,true)).toBe(false);
  const e=createEnemy(s,'E03',195,180);e.hp=e.maxHp=100000;expect(shouldAutoCast(s,false)).toBe(false);expect(shouldAutoCast(s,true)).toBe(false);
  const firstReady=s.tacticalReadyAt;s.tick=firstReady;expect(shouldAutoCast(s,true)).toBe(true);
  command(s,{type:'cast'});expect(s.stats.casts).toEqual([firstReady]);expect(shouldAutoCast(s,true)).toBe(false);
  s.tick=s.tacticalReadyAt;expect(shouldAutoCast(s,true)).toBe(true);
  for(const phase of ['paused','choosing','ended'] as const){s.phase=phase;expect(shouldAutoCast(s,true)).toBe(false);}
  s.phase='running';s.config.challengeId='no-skill';expect(shouldAutoCast(s,true)).toBe(false);
  s.config.challengeId=null;e.hp=0;expect(shouldAutoCast(s,true)).toBe(false);
});
it('C07 automatic detonation requires a deployed mine and ready cooldown',()=>{const s=createRun({stageId:'S01',squadIds:['C07'],captainId:'C07',seed:101});s.tick=s.tacticalReadyAt;createEnemy(s,'B01',195,150);expect(shouldAutoCast(s,true)).toBe(false);stepWeapons(s);expect(shouldAutoCast(s,true)).toBe(true);expect(command(s,{type:'cast'})).toBe(true);expect(s.mines).toHaveLength(0);expect(shouldAutoCast(s,true)).toBe(false);});
