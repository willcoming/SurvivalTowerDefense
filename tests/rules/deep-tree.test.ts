import { describe,it,expect } from 'vitest';
import { CHARACTER_TREES, DEEP_NODES, DEEP_NODE_MAP, COMMON_TREE, FREE_CONTENT_VERSION } from '../../src/data/deep-trees';
import { CHARACTER_IDS, CHARACTER_MAP, PREVIOUS_TREE_VERSION, RANGE_CONTENT_VERSION, LEGACY_CONTENT_VERSION, ticks } from '../../src/data/content';
import { createRun, command, stepRun, restoreRun } from '../../src/sim/engine';
import { deepLock, deepLegalNodes, deepMods } from '../../src/sim/deep-tree';
import { openDraft } from '../../src/sim/draft';
import { addShield, createEnemy, hitEnemy, hitWall, stepEffects } from '../../src/sim/combat';
import { stepWeapons, weaponStats } from '../../src/sim/weapons';
import { stepSupport } from '../../src/sim/deep-support';
import { nextIntel, waveStats } from '../../src/sim/operations';
import { shouldAutoCast } from '../../src/ui/auto-tactical';
import { pathTo, ALL_TERMINALS } from '../helpers/deep-build';
import type { CharacterId, RunState } from '../../src/sim/types';

function funded(ids:CharacterId[]=['C01','C02','C03','C04','C05']){const s=createRun({stageId:'S03',squadIds:ids,captainId:ids[0],seed:101});s.xp=720;s.choicesEarned=24;openDraft(s);return s;}
function take(s:RunState,id:string){expect(command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:id}),id).toBe(true);}
function acquire(s:RunState,id:string){for(const n of pathTo(id))if(!s.treeNodes!.includes(n))take(s,n);}
function readyCombat(s:RunState){s.enemies=[];s.projectiles=[];s.fields=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.draft=null;s.pauseReasons=[];s.choicesEarned=s.choicesSpent;s.phase='running';}
function durable(s:RunState,x=195,y=300){const e=createEnemy(s,'E03',x,y,0,0);e.hp=e.maxHp=100000;e.shield=0;e.speed=0;return e;}

describe('150-node free allocation',()=>{
  it('matches every agreed asymmetric tree size and provides 25 distinct ultimates',()=>{
    expect(CHARACTER_TREES.map(t=>t.nodes.length)).toEqual([11,9,10,11,9,8,10,12,8,10,9,12,10,9]);expect(COMMON_TREE.nodes).toHaveLength(12);expect(DEEP_NODES).toHaveLength(150);expect(ALL_TERMINALS).toHaveLength(25);
    expect(new Set(DEEP_NODES.map(n=>n.id)).size).toBe(150);
    for(const n of DEEP_NODES){expect(Object.keys(n.mods).length).toBeGreaterThan(0);expect(n.parents.every(id=>DEEP_NODE_MAP[id].layer<n.layer&&DEEP_NODE_MAP[id].kind!=='ultimate')).toBe(true);}
  });
  for(const t of ALL_TERMINALS)it(`${t.name} has a legal five-point path, persists and locks other owner ultimates`,()=>{
    const s=funded([t.ownerId as CharacterId]),path=pathTo(t.id);expect(path).toHaveLength(5);expect(deepLock(s,t.id)).toBeTruthy();
    for(const id of path.slice(0,4))take(s,id);expect(deepLock(s,t.id)).toBeNull();take(s,t.id);expect(s.evolvedCount).toBe(1);expect(restoreRun(s)).toEqual(s);
    for(const alt of ALL_TERMINALS.filter(n=>n.ownerId===t.ownerId&&n.id!==t.id))expect(deepLock(s,alt.id)).toContain('本角色');
    expect(deepLegalNodes(s).some(id=>DEEP_NODE_MAP[id].ownerId===t.ownerId)).toBe(true);
  });
  it('cannot close, buy old cards, reroll, forge or repeat purchases; spends each two-point milestone atomically across reloads',()=>{
    const s=funded(),offer=s.draft!.id,rng=structuredClone(s.rng);
    expect(command(s,{type:'resume',reason:'upgrade'})).toBe(false);expect(command(s,{type:'choose',offerId:offer,nodeId:'EMPTY'})).toBe(false);expect(command(s,{type:'reroll',offerId:offer})).toBe(false);
    take(s,'C01-A/0');expect(s.draft!.id).toBe(offer);expect(s.phase).toBe('choosing');expect(command(s,{type:'buy-node',offerId:offer,nodeId:'C01-A/0'})).toBe(false);
    const restored=restoreRun(s);take(restored,'TEAM/0');expect(restored.draft!.id).not.toBe(offer);expect(restored.choicesSpent).toBe(2);expect(restored.rng).toEqual(rng);expect(command(restored,{type:'buy-node',offerId:offer,nodeId:'TEAM/1'})).toBe(false);
    const invalid=structuredClone(restored);invalid.treeNodes!.reverse();expect(()=>restoreRun(invalid)).toThrow();
  });
  it('only XP earns points: 59 yields none, 60 yields two, and large XP batches queue multiple mandatory milestones',()=>{
    const s=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101});s.enemies=[];
    const kill=(xp:number)=>hitEnemy(s,createEnemy(s,'E01',195,200,xp),{source:'C01',skill:'test',raw:999,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});
    kill(59);expect(s.choicesEarned).toBe(0);kill(1);openDraft(s);expect(s.choicesEarned).toBe(2);take(s,'TEAM/0');expect(s.phase).toBe('choosing');take(s,'TEAM/1');expect(s.phase).toBe('running');
    kill(120);openDraft(s);expect(s.choicesEarned).toBe(6);take(s,'TEAM/2');take(s,'TEAM/3');expect(s.draft?.choice).toBe(3);expect(s.phase).toBe('choosing');
  });
  it('every solo character has at least 24 mutually compatible ordinary nodes; random valid paths never deadlock',()=>{
    for(const owner of CHARACTER_IDS){expect(DEEP_NODES.filter(n=>(n.ownerId===owner||n.ownerId==='common')&&n.kind!=='ultimate').length).toBeGreaterThanOrEqual(24);
      for(let seed=1;seed<=30;seed++){const s=funded([owner]);let rng=seed;
        for(let i=0;i<24;i++){const legal=deepLegalNodes(s);expect(legal.length).toBeGreaterThan(0);rng=(Math.imul(rng,1664525)+1013904223)>>>0;take(s,legal[rng%legal.length]);}
        expect(s.draft).toBeNull();expect(s.phase).toBe('running');expect(restoreRun(s)).toEqual(s);
      }
    }
  });
  it('enforces three squad ultimates and the two-ultimate challenge while leaving all common branches available',()=>{
    for(const limit of [2,3]){const s=funded();s.evolutionLimit=limit;s.config.challengeId=limit===2?'two-evolutions':null;
      for(const id of ['C01-A/9','C02-A/9','C03-A/7'].slice(0,limit))acquire(s,id);
      expect(deepLock(s,'C04-A/10')).toContain('名額');expect(deepLock(s,'TEAM/0')).toBeNull();expect(restoreRun(s)).toEqual(s);
    }
  });
  it('holds a pending milestone through Boss entrance and never permanently starves it behind overlapping warnings',()=>{
    const s=funded();s.draft=null;s.pauseReasons=['boss-intro'];s.bossIntro={enemyId:1,remainingMs:1500};openDraft(s);expect(s.draft).toBeNull();delete s.bossIntro;s.pauseReasons=[];
    const enemy=s.enemies[0];enemy.chargeKind='shot';enemy.chargeUntil=s.tick+300;openDraft(s);expect(s.draft).toBeNull();s.tick+=60;openDraft(s);expect(s.draft).not.toBeNull();
  });
  it.each(CHARACTER_IDS)('%s starts on full battle-time cooldown for both manual and automatic skill inputs',id=>{
    const s=createRun({stageId:'S01',squadIds:[id],captainId:id,seed:101});expect(s.tacticalReadyAt).toBe(ticks(CHARACTER_MAP[id].cooldown));expect(command(s,{type:'cast'})).toBe(false);expect(shouldAutoCast(s,true)).toBe(false);
    s.tick=s.tacticalReadyAt-1;expect(command(s,{type:'cast'})).toBe(false);s.tick++;expect(shouldAutoCast(s,true)).toBe(true);expect(command(s,{type:'cast'})).toBe(true);expect(restoreRun(s)).toEqual(s);
  });
  it('all previous versions still start ready and retain their old XP policy',()=>{
    for(const version of [PREVIOUS_TREE_VERSION,RANGE_CONTENT_VERSION,LEGACY_CONTENT_VERSION]){const s=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101},version);expect(s.tacticalReadyAt).toBe(0);expect(s.wavePlan).toBeUndefined();expect(restoreRun(s)).toEqual(s);}
  });
});

describe('new effects and disclosed battle variations',()=>{
  it('all future enemy counts, defenses and modifiers come from the saved deterministic plan',()=>{
    const a=createRun({stageId:'S03',squadIds:['C01'],captainId:'C01',seed:101}),b=createRun(a.config),other=createRun({...a.config,seed:211});
    expect(a.wavePlan).toEqual(b.wavePlan);expect(a.spawnPlan).toEqual(b.spawnPlan);expect(a.wavePlan).not.toEqual(other.wavePlan);
    expect(a.spawnPlan.reduce((n,p)=>n+p.xp,0)).toBe(720);expect(a.wavePlan!.filter(w=>w.event!=='none')).toHaveLength(3);
    const intel=nextIntel(a);for(const row of intel){expect(row.counts.reduce((n,[,c])=>n+c,0)).toBe(a.spawnPlan.slice(a.spawnCursor).filter(p=>p.wave===row.wave).length);}
    for(const p of a.spawnPlan.filter(p=>p.wave===3)){const expected=waveStats(a,p.defId,p.wave),e=createEnemy(a,p.defId,p.x,20,p.xp,p.wave);expect([e.maxHp,e.shield,e.armor,e.speed]).toEqual([expected.hp,expected.shield,expected.armor,expected.speed]);}
    expect(restoreRun(a).wavePlan).toEqual(a.wavePlan);const corrupt=structuredClone(a);corrupt.wavePlan![0].variant='fast';expect(()=>restoreRun(corrupt)).toThrow();
  });
  it('spread, penetration and exposure remain combined after the alternative rapid-fire ultimate',()=>{
    const s=funded(['C01']);acquire(s,'C01-A/10');acquire(s,'C01-B/1');acquire(s,'C01-C/0');readyCombat(s);durable(s);durable(s,240,315);s.weapons[0].attacks=5;stepWeapons(s);
    expect(s.projectiles.length).toBeGreaterThanOrEqual(4);expect(s.projectiles[0].remaining).toBe(2);expect(s.projectiles[0].packet?.exposure).toBeDefined();
  });
  it('both chain ultimates have actual return/burst events and damage',()=>{
    for(const id of ['C02-A/9','C02-A/10']){const s=funded(['C02']);acquire(s,id);readyCombat(s);for(let i=0;i<8;i++)durable(s,80+i*28,300);stepWeapons(s);expect(s.events.some(e=>e.kind==='arc')).toBe(true);expect(s.events.some(e=>e.skill===(id.endsWith('/9')?'chain-burst':'chain-return'))).toBe(true);}
  });
  it('magnetic EMP applies real AoE stun without removing chain attacks',()=>{
    const s=funded(['C02']);acquire(s,'C02-B/8');readyCombat(s);durable(s);durable(s,225,310);
    for(let i=0;i<3;i++){s.tick=s.weapons[0].nextAttack;stepWeapons(s);}expect(s.events.some(e=>e.skill==='magnetic-burst')).toBe(true);expect(s.enemies.some(e=>e.effects.some(f=>f.kind==='stun'))).toBe(true);
  });
  it('line shockwaves and execution use geometry and actual target health',()=>{
    const s=funded(['C03']);acquire(s,'C03-A/7');acquire(s,'C03-A/4');readyCombat(s);for(let i=0;i<8;i++)durable(s,195,100+i*30);stepWeapons(s);expect(s.events.some(e=>e.skill==='overpenetration')).toBe(true);expect(s.enemies.filter(e=>e.hp<e.maxHp).length).toBeGreaterThan(3);
    const low=funded(['C03']);acquire(low,'C03-B/9');readyCombat(low);const e=durable(low);e.hp=e.maxHp*.2;stepWeapons(low);expect(low.stats.damageByCharacter.C03).toBeGreaterThan(100);
  });
  it('gravity exposure and cross-tree collision survive simultaneously; haste never delays persistent field ticks',()=>{
    const s=funded(['C04']);acquire(s,'C04-A/11');acquire(s,'C04-B/2');acquire(s,'C04-B/5');readyCombat(s);for(let i=0;i<6;i++)durable(s,180+i*8,280+i*12);s.weapons[0].attacks=2;stepWeapons(s);expect(s.fields[0].exposure).toBeGreaterThan(0);expect(s.events.some(e=>e.skill==='collision')).toBe(true);
    stepRun(s,15);expect(s.enemies.some(e=>e.effects.some(f=>f.kind==='exposure'))).toBe(true);const next=s.fields[0].nextTick;s.weapons[0].nextAttack=s.tick;stepWeapons(s);expect(s.fields[0].nextTick).toBe(next);
  });
  it('cluster bombs schedule distinct delayed explosions while existing projectile packets stay frozen',()=>{
    const s=funded(['C05']);acquire(s,'C05-B/8');acquire(s,'C05-B/2');readyCombat(s);durable(s);stepWeapons(s);const shot=structuredClone(s.projectiles[0]);expect(shot.echo?.count).toBe(3);
    stepRun(s,14);expect(s.scheduled.filter(h=>h.packet?.skill==='cluster-burst')).toHaveLength(3);stepRun(s,20);expect(s.events.some(e=>e.kind==='explosion'&&e.skill==='cluster-burst')).toBe(true);
  });
  it('burns really transfer on death, retain armor-ignore and keep a visible fire field',()=>{
    const s=funded(['C05']);acquire(s,'C05-A/8');acquire(s,'C05-A/3');readyCombat(s);const victim=durable(s),next=durable(s,230,310);stepWeapons(s);stepRun(s,14);
    expect(victim.effects.some(f=>f.kind==='burn'&&f.armorIgnore>=.7)).toBe(true);expect(s.fields.length).toBeGreaterThan(0);hitEnemy(s,victim,{source:'C05',skill:'test',raw:1e9,damageType:'thermal',armorIgnore:1,shieldMultiplier:1});expect(next.effects.some(f=>f.id.includes('spread'))).toBe(true);
  });
  it('five drones fire independently and the other terminal produces real missile projectiles',()=>{
    const s=funded(['C06']);acquire(s,'C06-A/10');readyCombat(s);for(let i=0;i<6;i++)durable(s,80+i*35,300);stepWeapons(s);expect(s.events.filter(e=>e.kind==='beam')).toHaveLength(5);
    const missile=funded(['C06']);acquire(missile,'C06-A/11');readyCombat(missile);durable(missile);stepWeapons(missile);expect(missile.projectiles.some(p=>p.packet?.skill==='micro-missile')).toBe(true);
  });
  it('common repair, reactive shields, pushback and reflect actually change combat outcomes',()=>{
    const s=funded(['C06']);acquire(s,'TEAM/3');acquire(s,'TEAM/7');acquire(s,'C06-C/4');readyCombat(s);s.wallHp=200;const e=durable(s,195,450);stepSupport(s);expect(e.y).toBeLessThan(450);expect(s.support!.secondWindUsed).toBe(1);expect(s.support!.repaired).toBeGreaterThan(100);expect(s.shields.length).toBeGreaterThan(0);
    const hp=e.hp;hitWall(s,100,'E01');expect(e.hp).toBeLessThan(hp);expect(s.support!.reflected).toBeGreaterThan(0);expect(s.support!.prevented).toBeGreaterThan(0);
  });
  it('emergency repair counts damage only after the node is acquired',()=>{
    const s=funded(['C06']);hitWall(s,200,'E01');expect(s.support!.damageTaken).toBe(0);
    acquire(s,'TEAM/5');const before=s.wallHp;hitWall(s,99,'E01');expect(s.wallHp).toBe(before-99);
    hitWall(s,1,'E01');expect(s.wallHp).toBe(before-100+15);expect(s.support!.damageTaken).toBe(0);
  });
  it('a new burn upgrade changes future shells without mutating an in-flight packet',()=>{
    const s=funded(['C05']);acquire(s,'C05-B/8');durable(s);stepWeapons(s);const shell=s.projectiles.at(-1)!,packet=structuredClone(shell.packet);
    take(s,'C05-A/0');expect(shell.packet).toEqual(packet);s.weapons[0].nextAttack=s.tick;stepWeapons(s);
    expect(s.projectiles.at(-1)!.packet!.burn!.dps).toBeGreaterThan(packet!.burn!.dps);
  });
});
