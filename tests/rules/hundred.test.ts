import { describe, expect, it } from 'vitest';
import { HUNDRED_PROFILE, hundredCleared } from '../../src/data/hundred';
import { operationProfile } from '../../src/data/progression';
import { command, createRun as versionedRun, restoreRun, stepRun } from '../../src/sim/engine';
import { waveStats } from '../../src/sim/operations';
import { createEnemy } from '../../src/sim/combat';
import type { RunConfig } from '../../src/sim/types';
const createRun=(...args:Parameters<typeof versionedRun>)=>versionedRun(args[0],args[1]??'0.5.0-dev.2',args[2]);
const config:RunConfig={mode:'hundred',stageId:'S03',difficulty:'easy',squadIds:['C01'],captainId:'C01',seed:101};

describe('hundred-wave survival',()=>{
 it('schedules exactly 100 waves, includes the final boss in wave 100 and preserves XP budget',()=>{
  const s=createRun(config),p=operationProfile(s);
  expect(p).toBe(HUNDRED_PROFILE);expect(new Set(s.spawnPlan.map(e=>e.wave)).size).toBe(100);
  expect(s.spawnPlan.length).toBe(p.enemies);
  expect(s.spawnPlan.reduce((n,e)=>n+e.xp,0)).toBe(p.points*30);
  expect(s.spawnPlan.filter(e=>e.wave===100).every(e=>e.at>=p.bossAt*30)).toBe(true);
  expect(Math.max(...s.spawnPlan.map(e=>e.wave))).toBe(100);
  expect(s.spawnPlan.filter(e=>e.wave===2)[0].at).toBe(600);
  expect(createRun(config).spawnPlan).toEqual(s.spawnPlan);
  expect(restoreRun(s)).toEqual(s);
 });
 it('raises health and speed at each ten-wave boundary',()=>{
  const s=createRun(config);
  for(let wave=1;wave<91;wave+=10){
   expect(waveStats(s,'E01',wave+10).hp).toBeGreaterThan(waveStats(s,'E01',wave).hp);
   expect(waveStats(s,'E01',wave+10).speed).toBeGreaterThan(waveStats(s,'E01',wave).speed);
  }
 });
 it('counts resolved waves instead of elapsed time, including stragglers and unspawned groups',()=>{
  const s=createRun(config);s.tick=6000;
  expect(hundredCleared(s)).toBe(0);
  s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===4);s.enemies=[];
  expect(hundredCleared(s)).toBe(3);
  createEnemy(s,'E01',195,50,0,2);expect(hundredCleared(s)).toBe(1);
  s.enemies=[];s.spawnCursor=s.spawnPlan.length;
  expect(hundredCleared(s)).toBe(99);
  s.bossKilled=true;createEnemy(s,'E01',195,50,0,100);
  expect(hundredCleared(s)).toBe(99);
  s.enemies=[];expect(hundredCleared(s)).toBe(100);
 });
 it('waits for the boss, final spawn groups and all survivors before victory; never times out',()=>{
  const s=createRun(config);s.tick=HUNDRED_PROFILE.bossAt*30-1;
  s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===100);s.enemies=[];s.weapons.forEach(w=>w.nextAttack=999999);
  stepRun(s);expect(s.bossSpawned).toBe(true);expect(s.enemies.find(e=>e.defId==='B03')?.wave).toBe(100);
  expect(s.bossIntro).toBeDefined();command(s,{type:'finish-boss-intro'});
  s.bossKilled=true;s.enemies=[];stepRun(s);expect(s.outcome).toBeNull();
  s.spawnCursor=s.spawnPlan.length;s.tick=(HUNDRED_PROFILE.deadline+100)*30;s.bossKilled=false;stepRun(s);
  expect(s.outcome).toBeNull();
  s.bossKilled=true;stepRun(s);expect(s.outcome).toBe('victory');expect(hundredCleared(s)).toBe(100);
 });
 it('rejects incompatible modes without changing campaign schedules',()=>{
  expect(()=>createRun({...config,mode:'unknown' as 'hundred'})).toThrow();
  expect(()=>createRun({...config,difficulty:'hard'})).toThrow();
  expect(()=>createRun(config,undefined,{operationVersion:2})).toThrow();
  expect(operationProfile(createRun({...config,mode:undefined})).waves.length).not.toBe(100);
 });
});
