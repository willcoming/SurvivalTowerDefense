import { describe, expect, it } from 'vitest';
import { applyEffect, createEnemy, hitEnemy, stepEffects } from '../../src/sim/combat';
import { command, createRun, restoreRun, stepRun } from '../../src/sim/engine';
import type { CharacterId, DamagePacket, Effect, Enemy, RunConfig, RunState } from '../../src/sim/types';
const config:RunConfig={stageId:'S01',squadIds:['C01','C02','C03','C04','C05'],captainId:'C01',seed:42};
const packet=(source:CharacterId,extra:Partial<DamagePacket>={}):DamagePacket=>({source,skill:'weapon',raw:100,damageType:'plasma',armorIgnore:0,shieldMultiplier:1,...extra});
function setup(){const s=createRun(config);s.enemies=[];return s;}
function enemy(s:RunState){const e=createEnemy(s,'E01',195,260,0,1);e.hp=e.maxHp=10000;e.armor=.4;e.shield=0;return e;}
function burn(s:RunState,e:Enemy,extra:Partial<Effect>={}){applyEffect(s,e,{id:'fire',source:'C05',kind:'burn',damageType:'thermal',value:10,expires:s.tick+300,nextTick:s.tick+15,armorIgnore:0,...extra});}
function slow(s:RunState,e:Enemy,extra:Partial<Effect>={}){applyEffect(s,e,{id:'gravity',source:'C04',kind:'slow',damageType:'gravity',value:.2,expires:s.tick+300,nextTick:0,armorIgnore:0,...extra});}
describe('Phase 3 elemental reactions',()=>{
  it('vortex pulls inward from both sides and doubles the original burn without exponential amplification',()=>{
    const s=setup(),e=enemy(s),left=createEnemy(s,'E01',95,260,0,1),right=createEnemy(s,'E01',295,260,0,1),far=createEnemy(s,'E01',390,450,0,1);
    burn(s,e);hitEnemy(s,e,packet('C04'));
    expect(left.x).toBe(130);expect(right.x).toBe(260);expect(far.effects).toHaveLength(0);
    for(const other of [e,left,right])expect(other.effects.find(f=>f.id==='combo-flame')).toMatchObject({value:20,comboBaseDps:10,expires:90});
    hitEnemy(s,e,packet('C04'));expect(left.x).toBe(130);
    s.tick=15;hitEnemy(s,e,packet('C04'));expect(left.x).toBe(165);expect(e.effects.filter(f=>f.kind==='burn').every(f=>f.value<=20)).toBe(true);
  });
  it('spread burn remains thermal and follows periodic damage without recursively triggering combos',()=>{
    const s=setup(),e=enemy(s);burn(s,e);hitEnemy(s,e,packet('C04'));const count=s.events.filter(v=>v.kind.startsWith('combo_')).length;
    s.tick=15;stepEffects(s);expect(s.events.filter(v=>v.kind.startsWith('combo_'))).toHaveLength(count);
    expect(s.events.find(v=>v.skill==='combo-burn')).toMatchObject({damageType:'thermal'});
  });
  it.each(['C01','C02'] as const)('%s primes superconduct; kinetic deals critical armor-ignoring damage with 15-tick cooldown',source=>{
    const s=setup(),e=enemy(s);hitEnemy(s,e,packet(source));e.hp=10000;
    hitEnemy(s,e,packet('C03'));expect(e.hp).toBe(9850);expect(s.events.filter(v=>v.kind==='hit').at(-1)?.critical).toBe(true);
    hitEnemy(s,e,packet('C03'));expect(e.hp).toBe(9790); // no repeated critical/penetration in the cooldown
    s.tick=15;hitEnemy(s,e,packet('C03'));expect(e.hp).toBe(9640);
    expect(s.events.filter(v=>v.kind==='combo_superconduct')).toHaveLength(2);
  });
  it('existing critical damage is not multiplied twice; expired charge/exposure cannot prime superconduct',()=>{
    const s=setup(),e=enemy(s);hitEnemy(s,e,packet('C01'));e.hp=10000;
    hitEnemy(s,e,packet('C03',{critical:true,raw:150}));expect(e.hp).toBe(9850);
    s.tick=90;e.exposureUntil=999;hitEnemy(s,e,packet('C03'));expect(s.events.filter(v=>v.kind==='combo_superconduct')).toHaveLength(1);
  });
  it('superconduct jumps to two nearest enemies, retains arc damage and cannot recursively detonate',()=>{
    const s=setup(),center=enemy(s),a=enemy(s),b=enemy(s),third=enemy(s),far=enemy(s);
    a.x=215;b.x=175;third.x=240;far.x=390;
    for(const target of [a,b,third,far]){slow(s,target);burn(s,target);target.armor=0;}
    hitEnemy(s,center,packet('C01'));s.events=[];
    hitEnemy(s,center,packet('C03'));
    expect(a.hp).toBe(9955);expect(b.hp).toBe(9955);expect(third.hp).toBe(10000);expect(far.hp).toBe(10000);
    expect(s.events.filter(v=>v.kind==='arc').map(v=>v.targetId)).toEqual([a.id,b.id]);
    expect(s.events.filter(v=>v.kind==='arc'||v.skill==='combo-arc').every(v=>v.damageType==='arc')).toBe(true);
    expect(s.events.filter(v=>v.kind.startsWith('combo_')).map(v=>v.kind)).toEqual(['combo_superconduct']);
    hitEnemy(s,center,packet('C03'));expect(s.events.filter(v=>v.kind==='arc')).toHaveLength(2);
  });
  it('a lethal superconduct hit still emits arcs, respecting armor/shields and crediting secondary kills',()=>{
    const s=setup(),center=enemy(s),target=enemy(s);target.x=240;target.hp=10;target.xp=30;
    target.shield=20;target.armor=.4;
    hitEnemy(s,center,packet('C01'));center.hp=10;s.focusTargetId=target.id;
    const before=s.stats.damageByCharacter.C03;
    hitEnemy(s,center,packet('C03'));
    expect(center.hp).toBe(0);expect(target.hp).toBe(0);expect(target.shield).toBe(0);
    expect(s.stats.kills).toBe(2);expect(s.xp).toBe(30);expect(s.focusTargetId).toBeNull();
    expect(s.stats.damageByCharacter.C03-before).toBe(20);expect(s.stats.shieldDamageByCharacter.C03).toBe(20);
    expect(s.events.filter(v=>v.kind==='death')).toHaveLength(2);
  });
  it.each(['C01','C02'] as const)('gravity control + %s deals 12% true damage bypassing armor and shields and interrupts charge',source=>{
    const s=setup(),e=enemy(s);e.shield=10000;e.armor=.7;e.chargeKind='shot';e.chargeUntil=60;slow(s,e);
    hitEnemy(s,e,packet(source));expect(e.hp).toBe(8800);expect(e.shield).toBe(9900);expect(e.chargeCancelled).toBe(true);
    expect(s.stats.damageByCharacter[source]).toBe(1200);
    expect(s.events.find(v=>v.kind==='combo_emp')?.value).toBe(1200);
    s.tick=14;hitEnemy(s,e,packet(source));expect(e.hp).toBe(8800);
    s.tick=15;hitEnemy(s,e,packet(source));expect(e.hp).toBe(7600);
  });
  it('boss true damage is capped at 1500 and reaction lethality uses normal death, XP and focus accounting',()=>{
    const s=setup(),e=createEnemy(s,'B01',195,200,80,1);e.hp=e.maxHp=100000;e.shield=10000;slow(s,e);
    hitEnemy(s,e,packet('C01'));expect(e.hp).toBe(98500);expect(s.events.find(v=>v.kind==='combo_emp')?.value).toBe(1500);
    s.tick=15;e.hp=10;s.focusTargetId=e.id;hitEnemy(s,e,packet('C01'));
    expect(e.hp).toBe(0);expect(s.bossKilled).toBe(true);expect(s.stats.kills).toBe(1);expect(s.xp).toBe(80);expect(s.choicesEarned).toBeGreaterThan(0);expect(s.focusTargetId).toBeNull();
    expect(s.stats.damageByCharacter.C01).toBe(1510);expect(s.events.filter(v=>v.kind==='death')).toHaveLength(1);
    hitEnemy(s,e,packet('C01'));expect(s.stats.kills).toBe(1);
  });
  it('overload multiplies shield damage before hit resolution and honors its own cooldown',()=>{
    const s=setup(),e=enemy(s);e.shield=10000;burn(s,e);
    hitEnemy(s,e,packet('C01'));expect(e.shield).toBe(9750);expect(e.hp).toBe(10000);
    hitEnemy(s,e,packet('C01'));expect(e.shield).toBe(9650);
    s.tick=15;hitEnemy(s,e,packet('C01'));expect(e.shield).toBe(9400);
    expect(s.events.filter(v=>v.kind==='combo_overload')).toHaveLength(2);
  });
  it('overload multiplies the full shield multiplier including the captain bonus',()=>{
    const s=setup(),e=enemy(s);s.config.captainId='C02';e.shield=10000;burn(s,e);hitEnemy(s,e,packet('C01'));expect(e.shield).toBe(10000-100*1.25*2.5);
  });
  it('overload and EMP can both trigger; cooldowns are per enemy and per reaction',()=>{
    const s=setup(),a=enemy(s),b=enemy(s);for(const e of [a,b]){burn(s,e);slow(s,e);e.shield=1000;hitEnemy(s,e,packet('C01'));}
    expect(s.events.filter(v=>v.kind==='combo_emp')).toHaveLength(2);expect(s.events.filter(v=>v.kind==='combo_overload')).toHaveLength(2);
    expect(a.comboCooldowns).toMatchObject({emp:15,overload:15});
  });
  it('expired/wrong elements, non-gravity control, arc overload and zero damage do not trigger',()=>{
    const s=setup(),e=enemy(s);e.shield=10000;
    burn(s,e,{expires:0});slow(s,e,{source:'C07',damageType:'kinetic'});hitEnemy(s,e,packet('C01'));
    expect(s.events.some(v=>v.kind.startsWith('combo_'))).toBe(false);
    burn(s,e);hitEnemy(s,e,packet('C02'));expect(s.events.some(v=>v.kind==='combo_overload')).toBe(false);
    hitEnemy(s,e,packet('C04',{raw:0}));expect(s.events.some(v=>v.kind==='combo_vortex')).toBe(false);
  });
  it('uses equipped elements and preserves reaction clocks through JSON restore and pause',()=>{
    const s=createRun(config),e=s.enemies[0];e.hp=e.maxHp=10000;
    s.config.forms={C01:'C01-summer'};hitEnemy(s,e,packet('C01'));expect(e.ionizedUntil).toBeUndefined();
    hitEnemy(s,e,packet('C02'));hitEnemy(s,e,packet('C03'));command(s,{type:'pause',reason:'user'});
    const restored=restoreRun(JSON.parse(JSON.stringify(s)));stepRun(restored,100);expect(restored.tick).toBe(s.tick);expect(restored).toEqual(s);
  });
  it('old content and missing reaction fields restore without changing legacy rules; corrupt clocks are rejected',()=>{
    const old=createRun(config,'0.6.0-dev.2'),e=old.enemies[0];burn(old,e);slow(old,e);hitEnemy(old,e,packet('C01'));
    expect(e.comboCooldowns).toBeUndefined();expect(e.ionizedUntil).toBeUndefined();expect(restoreRun(old)).toEqual(old);
    const s=createRun(config);expect(restoreRun(s)).toEqual(s);s.enemies[0].comboCooldowns={emp:-1};expect(()=>restoreRun(s)).toThrow('元素連鎖');
  });
});
