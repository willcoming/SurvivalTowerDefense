import { describe,it,expect } from 'vitest';
import { FORM_MAP,POOL,STARTER_FORMS,WEAKNESSES,attackType,formPortrait,formMotion } from '../../src/data/forms';
import { CHAPTERS,MAIN_IDS,SIDE_IDS,CHALLENGES,stageUnlocked } from '../../src/data/campaign';
import { createCollection,syncRewards,missingForms,applyCollectionAction,validateRoster,ownedForm,REWARD_GOALS } from '../../src/storage/collection';
import { createDefaultSave,completeRun } from '../../src/storage/repository';
import { createRun,restoreRun,stepRun,command } from '../../src/sim/engine';
import { createEnemy,hitEnemy,stepEffects,addShield } from '../../src/sim/combat';
import { weaponStats,stepWeapons } from '../../src/sim/weapons';
import { reflectShield } from '../../src/sim/deep-support';
import { stepMines,deployMine } from '../../src/sim/special-weapons';
import type { CharacterId,DamagePacket,FormId } from '../../src/sim/types';

describe('permanent free recruitment',()=>{
  it('keeps original stage artwork and uses separate summer pose revisions without changing form IDs',()=>{
    for(const owner of ['C07','C08'] as const)for(const theme of ['original','summer'] as const){const id=`${owner}-${theme}` as const;expect(formPortrait(id)).toBe(`/assets/forms/${id}-${theme==='summer'?'pose-v4':'stage-v3'}.webp`);expect(formMotion(id)).toBe(formPortrait(id));expect(FORM_MAP[id].ownerId).toBe(owner);}
    expect(formPortrait('C03-summer')).toBe('/assets/forms/C03-summer.webp');expect(formPortrait('C01-original')).toBe('/assets/characters/C01-portrait.webp');expect(formMotion('C01-original')).toBe('/assets/animations/C01-motion.webp');
  });
  it('has ten distinct equally sized probability bins; six originals remain free',()=>{
    expect(POOL).toHaveLength(10);expect(new Set(POOL.map(f=>f.id)).size).toBe(10);expect(STARTER_FORMS).toHaveLength(6);
    expect(POOL.filter(f=>f.theme==='summer')).toHaveLength(8);expect(POOL.filter(f=>f.theme==='original').map(f=>f.ownerId)).toEqual(['C07','C08']);
    for(let i=0;i<10;i++){const c=createCollection();c.tickets=1;applyCollectionAction(c,{type:'draw'},()=>i/10+.001);expect(c.lastReceipt?.formId).toBe(POOL[i].id);expect(c.tickets).toBe(0);}
  });
  it('summer-first ownership enables the new character without granting original',()=>{
    const c=createCollection();c.tickets=1;applyCollectionAction(c,{type:'draw'},()=>POOL.findIndex(f=>f.id==='C07-summer')/10+.01);
    expect(ownedForm(c,'C07')).toBe('C07-summer');expect(c.owned).not.toContain('C07-original');
    expect(()=>validateRoster(c,{stageId:'S01',squadIds:['C07'],captainId:'C07',seed:101,forms:{C07:'C07-summer'}})).not.toThrow();
    expect(()=>validateRoster(c,{stageId:'S01',squadIds:['C07'],captainId:'C07',seed:101})).toThrow();
    expect(()=>createRun({stageId:'S01',squadIds:['C07','C07'],captainId:'C07',seed:101})).toThrow();
  });
  it('only exact duplicates give ten fragments, exchange buys a missing form without stats',()=>{
    const c=createCollection();c.tickets=11;
    for(let i=0;i<11;i++)applyCollectionAction(c,{type:'draw'},()=>.01);
    expect(c.fragments).toBe(100);expect(c.owned).toHaveLength(7);
    applyCollectionAction(c,{type:'exchange',formId:'C08-summer'},()=>{throw Error('exchange must not roll');});expect(c.fragments).toBe(0);expect(c.owned).toContain('C08-summer');
    expect(()=>applyCollectionAction(c,{type:'exchange',formId:'C08-summer'},()=>0)).toThrow();
  });
  it('51 unique goals yield exactly 15 tickets and 900 points and complete collection',()=>{
    expect(REWARD_GOALS).toHaveLength(51);expect(new Set(REWARD_GOALS).size).toBe(51);expect(CHAPTERS).toHaveLength(5);
    const c=createCollection(),p={cleared:[...MAIN_IDS,...SIDE_IDS],challengeClears:MAIN_IDS.flatMap(id=>CHALLENGES.map(k=>`${id}:${k}`))};syncRewards(c,p);
    expect([c.tickets,c.points,c.claimed.length]).toEqual([15,900,51]);expect(missingForms(c)).toHaveLength(0);expect(c.completionGranted).toBe(true);
    const before=structuredClone(c);syncRewards(c,p);expect(c).toEqual(before);expect(()=>applyCollectionAction(c,{type:'draw'},()=>0)).toThrow();expect(c).toEqual(before);
  });
  it('retries, different teams, failed runs and repeated settlement cannot farm',()=>{
    const save=createDefaultSave(),r=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101});r.outcome='wall';completeRun(save,r);expect(save.collection.tickets).toBe(0);
    r.outcome='victory';completeRun(save,r);completeRun(save,r);expect(save.collection.tickets).toBe(1);
    const other=createRun({...r.config,squadIds:['C02'],captainId:'C02',seed:211});other.outcome='victory';completeRun(save,other);expect(save.collection.tickets).toBe(1);
    other.config.challengeId='four';completeRun(save,other);completeRun(save,other);expect(save.collection.points).toBe(25);
  });
  it('result rewards preserve one first-clear receipt and distinguish repeated runs',()=>{const save=createDefaultSave(),config={stageId:'S01' as const,squadIds:['C01' as const],captainId:'C01' as const,seed:101};const r=createRun(config);r.outcome='victory';completeRun(save,r);const first=structuredClone(save.profile.recentRuns[0]);expect(first.rewards?.tickets).toBe(1);completeRun(save,r);expect(save.profile.recentRuns[0]).toEqual(first);const repeat=createRun(config);repeat.outcome='victory';completeRun(save,repeat);expect(save.profile.recentRuns[0].rewards?.tickets).toBe(0);});
  it('points are consumed only after tickets, and equipping has no resource cost',()=>{const c=createCollection();c.tickets=1;c.points=125;applyCollectionAction(c,{type:'draw'},()=>0);expect([c.tickets,c.points]).toEqual([0,125]);applyCollectionAction(c,{type:'draw'},()=>.1);expect(c.points).toBe(25);applyCollectionAction(c,{type:'equip',formId:'C01-summer'},()=>0);expect(c.equipped.C01).toBe('C01-summer');expect([c.points,c.fragments]).toEqual([25,0]);});
  it('main chapters and summer branch unlock without collection requirements',()=>{
    expect(stageUnlocked('S01',[])).toBe(true);expect(stageUnlocked('S04',['S03'])).toBe(true);expect(stageUnlocked('X01',[])).toBe(false);expect(stageUnlocked('X01',['S03'])).toBe(true);expect(stageUnlocked('X02',['S03'])).toBe(false);expect(stageUnlocked('X02',['S03','X01'])).toBe(true);
  });
});
const fixture=(id:CharacterId,form?:FormId)=>{const s=createRun({stageId:'S01',squadIds:[id],captainId:id,seed:101,...form?{forms:{[id]:form}}:{}});s.enemies=[];return s;};
const packet=(source:CharacterId,raw=100):DamagePacket=>({source,raw,skill:'test',damageType:'thermal',armorIgnore:0,shieldMultiplier:1});
describe('forms, weakness and special weapons',()=>{
  it('reflection visuals use the damaging owner form, not a different captain',()=>{const s=createRun({stageId:'S01',squadIds:['C01','C06'],captainId:'C01',seed:101,forms:{C06:'C06-summer'}});s.treeNodes=['C06-C/4'];const e=createEnemy(s,'E03',195,300);e.shield=0;reflectShield(s,100);const hits=s.events.filter(e=>e.skill==='shield-reflect');expect(hits.length).toBeGreaterThan(0);expect(hits.every(e=>e.source==='C06'&&e.damageType==='kinetic')).toBe(true);});

  it('all enemy types have exactly one of the five fixed weaknesses',()=>{expect(Object.keys(WEAKNESSES)).toHaveLength(11);expect(new Set(Object.values(WEAKNESSES)).size).toBe(5);});
  it('matching type multiplies damage once, including shield overflow; no resistance penalty',()=>{
    const s=fixture('C02'),e=createEnemy(s,'E04',195,300);e.shield=50;e.armor=0;hitEnemy(s,e,{...packet('C02'),shieldMultiplier:2});
    expect(s.stats.shieldDamageByCharacter.C02).toBe(50);expect(s.stats.damageByCharacter.C02).toBe(125);
    const a=fixture('C01'),b=createEnemy(a,'E04',195,300);b.shield=0;b.armor=0;hitEnemy(a,b,packet('C01'));expect(a.stats.damageByCharacter.C01).toBe(100);
  });
  it('every owner packet is transformed, including DoT, without multiplying non-damage control',()=>{
    const s=fixture('C01','C01-summer'),e=createEnemy(s,'E01',195,300);e.hp=e.maxHp=10000;
    hitEnemy(s,e,{...packet('C01'),slow:{value:.2,duration:90}});expect(s.stats.damageByCharacter.C01).toBeCloseTo(120);expect(e.effects.find(f=>f.kind==='slow')?.expires).toBe(90);
    expect(e.effects.find(f=>f.kind==='burn')?.damageType).toBe('thermal');s.tick=15;stepEffects(s);expect(s.stats.damageByCharacter.C01).toBeCloseTo(126);
    for(const form of POOL){const run=fixture(form.ownerId,form.id);expect(attackType(run,form.ownerId)).toBe(form.damageType);}
  });
  it('form radius, elite tradeoff and shield bonuses apply only when equipped',()=>{
    const a=fixture('C05'),b=fixture('C05','C05-summer');expect(weaponStats(b,b.weapons[0]).radius/weaponStats(a,a.weapons[0]).radius).toBeCloseTo(1.25);
    const s=fixture('C06','C06-summer');addShield(s,'tactical:C06',100,90);expect(s.shields[0].value).toBe(125);addShield(s,'common',100,90);expect(s.shields[1].value).toBe(100);
    const c=fixture('C03','C03-summer'),e=createEnemy(c,'E01',195,300);hitEnemy(c,e,packet('C03'));expect(c.stats.damageByCharacter.C03).toBeCloseTo(85);
  });
  it('mines charge, cap, trigger on stationary bosses, and save exactly',()=>{
    const s=fixture('C07'),w=s.weapons[0],e=createEnemy(s,'B01',195,150);const hp=e.hp;stepWeapons(s);expect(s.mines).toHaveLength(1);expect(restoreRun(s)).toEqual(s);
    s.tick=18;stepMines(s);expect(s.mines).toHaveLength(0);expect(e.hp).toBeLessThan(hp);
    e.y=300;e.speed=0;for(let i=0;i<4;i++)deployMine(s,w,e,packet('C07'),58);expect(s.mines).toHaveLength(3);s.tick=s.tacticalReadyAt;expect(command(s,{type:'cast'})).toBe(true);expect(s.mines).toHaveLength(0);expect(command(s,{type:'cast'})).toBe(false);
    const summer=fixture('C07','C07-summer'),target=createEnemy(summer,'B01',195,150);for(let i=0;i<6;i++)deployMine(summer,summer.weapons[0],target,packet('C07'),58);expect(summer.mines).toHaveLength(5);
  });
  it('gunner overheats, stops firing, cools and vent restores shooting; snapshot preserves heat',()=>{
    const s=fixture('C08'),w=s.weapons[0],e=createEnemy(s,'E03',195,300);e.hp=e.maxHp=100000;e.speed=0;
    for(let i=0;i<13;i++){s.tick=w.nextAttack;stepWeapons(s);}expect(w.heat).toBe(100);expect(w.cooling).toBe(true);const attacks=w.attacks;stepWeapons(s);expect(w.attacks).toBe(attacks);expect(restoreRun(s)).toEqual(s);
    s.tick=s.tacticalReadyAt;expect(command(s,{type:'cast'})).toBe(true);expect(w.heat).toBe(0);expect(w.cooling).toBe(false);stepWeapons(s);expect(w.attacks).toBe(attacks+1);
  });
});
