import { describe, expect, it } from 'vitest';
import { ticks, WORLD } from '../../src/data/content';
import { command, createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { createEnemy, hitWall } from '../../src/sim/combat';
import { BARRIER_Y } from '../../src/sim/commander';
import { stepEnemies } from '../../src/sim/enemies';
import { startNextWave, waveResolved } from '../../src/sim/wave-flow';
import type { Command } from '../../src/sim/types';

const config = { stageId: 'S01', squadIds: ['C01'], captainId: 'C01', seed: 42 } as const;
function setup() {
  const s = createRun({ ...config, squadIds: [...config.squadIds] });
  s.enemies = [];
  s.weapons.forEach(w => w.nextAttack = 999999);
  return s;
}
describe('Phase 2 crisis and commander', () => {
  it('EMP activates on a nonlethal hit below 20%, affects nearby enemies once including resistant bosses', () => {
    const s = setup();
    const near = createEnemy(s,'E01',120,WORLD.wallY,0,1);
    const boundary = createEnemy(s,'E08',160,WORLD.wallY-180,0,1);
    const far = createEnemy(s,'E01',200,WORLD.wallY-181,0,1);
    const boss = createEnemy(s,'B01',240,400,0,1);
    boss.moveImmuneUntil = boss.stunImmuneUntil = 9999;
    boundary.chargeKind = 'rush'; boundary.chargeUntil = 90;
    s.wallHp = 200; hitWall(s,1,'E01');
    expect(s.wallHp).toBe(199); expect(s.emergencyPulseUsed).toBe(true);
    expect(near.y).toBe(250); expect(boundary.y).toBe(70); expect(far.y).toBe(269); expect(boss.y).toBe(200);
    expect(boundary.chargeCancelled).toBe(true);
    for (const e of [near,boundary,boss]) expect(e.effects.find(f=>f.id==='emp-stun')?.expires).toBe(ticks(2));
    hitWall(s,1,'E01'); expect(near.y).toBe(250);
    expect(s.events.filter(e=>e.kind==='emp_wave')).toHaveLength(1);
  });
  it('does not trigger above threshold, through fully absorbed hits or after lethal damage', () => {
    const s = setup(); s.wallHp=220; hitWall(s,1,'E01'); expect(s.emergencyPulseUsed).toBe(false);
    s.wallHp=201;hitWall(s,1,'E01');expect(s.emergencyPulseUsed).toBe(false);
    s.wallHp=190;s.shields=[{source:'test',value:50,expires:100}];hitWall(s,10,'E01');expect(s.emergencyPulseUsed).toBe(false);
    s.shields=[];hitWall(s,9999,'E01');expect(s.wallHp).toBe(0);expect(s.emergencyPulseUsed).toBe(false);
  });
  it('EMP stun lasts two simulation seconds and pauses with the run', () => {
    const s=setup(), e=createEnemy(s,'E01',120,450,0,1);s.wallHp=200;hitWall(s,1,'E01');
    command(s,{type:'pause',reason:'user'});stepRun(s,60);expect(s.tick).toBe(0);
    command(s,{type:'resume',reason:'user'});stepRun(s,59);expect(e.y).toBe(250);
    stepRun(s);expect(e.y).toBeGreaterThan(250);
  });
  it('barrier blocks crossing for three seconds, once per wave, without teleporting enemies behind it', () => {
    const s=setup(), e=createEnemy(s,'E08',120,BARRIER_Y-1,0,1), passed=createEnemy(s,'E01',220,BARRIER_Y+10,0,1);
    e.speed=300;e.rushUntil=9999;
    expect(command(s,{type:'commander-skill',skill:'barrier'})).toBe(true);
    expect(command(s,{type:'commander-skill',skill:'barrier'})).toBe(false);
    stepEnemies(s);expect(e.y).toBe(BARRIER_Y);expect(passed.y).toBeGreaterThan(BARRIER_Y+10);
    s.tick=89;stepEnemies(s);expect(e.y).toBe(BARRIER_Y);
    s.tick=90;stepEnemies(s);expect(e.y).toBeGreaterThan(BARRIER_Y);
    s.waveFlow!.phase='allocation';startNextWave(s);
    expect(command(s,{type:'commander-skill',skill:'barrier'})).toBe(true);
  });
  it('orbital hits the selected radius at 18 ticks, using plasma with half armor and double shield damage', () => {
    const s=setup();
    s.config.forms={C01:'C01-summer'}; // Must not turn a commander strike into the equipped form's element.
    const enemies=Array.from({length:25},()=>createEnemy(s,'E01',195,260,0,1));
    for(const e of enemies){e.hp=e.maxHp=10000;e.speed=0;e.armor=.4;e.shield=2000;}
    const outside=createEnemy(s,'E01',195,420,0,1);outside.hp=outside.maxHp=10000;outside.speed=0;
    expect(command(s,{type:'commander-skill',skill:'orbital',x:195,y:260})).toBe(true);
    stepRun(s,17);expect(enemies[0].hp).toBe(10000);
    stepRun(s);for(const e of enemies){expect(e.shield).toBe(0);expect(e.hp).toBe(8400);}
    expect(outside.hp).toBe(10000);
    expect(s.events.find(e=>e.kind==='orbital-blast')?.affectedIds).toHaveLength(25);
    expect(s.events.filter(e=>e.kind==='hit'&&e.skill==='orbital').every(e=>e.damageType==='plasma')).toBe(true);
  });
  it('orbital cooldown lasts 900 ticks and is not reset by a new wave', () => {
    const s=setup();command(s,{type:'commander-skill',skill:'orbital'});
    s.waveFlow!.phase='allocation';startNextWave(s);expect(s.commanderTactical?.orbitalReadyAt).toBe(900);
    s.tick=899;expect(command(s,{type:'commander-skill',skill:'orbital'})).toBe(false);
    s.tick=900;expect(command(s,{type:'commander-skill',skill:'orbital'})).toBe(true);
  });
  it('clamps coordinates and rejects invalid coordinates without consuming cooldown or recording actions', () => {
    for(const value of [NaN,Infinity,-Infinity]){
      const s=setup();expect(command(s,{type:'commander-skill',skill:'orbital',x:value})).toBe(false);expect(s.actions).toHaveLength(0);expect(s.scheduled).toHaveLength(0);
    }
    const s=setup();command(s,{type:'commander-skill',skill:'orbital',x:-100,y:9999});expect(s.scheduled[0]).toMatchObject({x:20,y:410});
    expect(command(setup(),{type:'commander-skill',skill:'invalid'} as unknown as Command)).toBe(false);
  });
  it.each(['user','upgrade','boss-intro','hidden'] as const)('rejects both commands during %s pause', reason=>{
    const s=setup();s.pauseReasons=[reason];
    for(const skill of ['barrier','orbital'] as const)expect(command(s,{type:'commander-skill',skill})).toBe(false);
    expect(s.actions).toHaveLength(0);
  });
  it('rejects ended runs and no-skill challenges',()=>{
    for(const skill of ['barrier','orbital'] as const){const s=setup();s.config.challengeId='no-skill';expect(command(s,{type:'commander-skill',skill})).toBe(false);s.config.challengeId=null;s.outcome='wall';expect(command(s,{type:'commander-skill',skill})).toBe(false);}
  });
  it('JSON restore preserves pending strikes and one-use state; missing optional fields remain compatible',()=>{
    const s=createRun({...config,squadIds:[...config.squadIds]});
    command(s,{type:'commander-skill',skill:'barrier'});command(s,{type:'commander-skill',skill:'orbital'});s.emergencyPulseUsed=true;
    const restored=restoreRun(JSON.parse(JSON.stringify(s)));
    expect(restored).toEqual(s);stepRun(s,18);stepRun(restored,18);expect(restored).toEqual(s);
    const old=createRun({...config,squadIds:[...config.squadIds]});delete old.emergencyPulseUsed;delete old.commanderTactical;delete old.barrierUntil;
    const legacy=restoreRun(old);expect(command(legacy,{type:'commander-skill',skill:'barrier'})).toBe(true);
  });
  it('resolves a pending orbital strike before allowing wave allocation',()=>{
    const s=setup();s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===2);
    command(s,{type:'commander-skill',skill:'orbital'});
    expect(waveResolved(s)).toBe(false);stepRun(s,17);expect(s.waveFlow!.wave).toBe(1);
    stepRun(s);expect(s.scheduled).toHaveLength(0);expect(s.events.some(e=>e.kind==='orbital-blast')).toBe(true);
    expect(s.waveFlow!.wave).toBe(2);
  });
  it('rejects corrupt commander state in saves',()=>{
    for(const bad of [{barrierUntil:-1},{emergencyPulseUsed:'yes'},{commanderTactical:{orbitalReadyAt:901}},{commanderTactical:null}]){
      expect(()=>restoreRun({...createRun({...config,squadIds:[...config.squadIds]}),...bad})).toThrow('指揮官戰術');
    }
  });
});
