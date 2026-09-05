import { createRun } from '../helpers/previous-tree-run';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SKILL_TREES, NODE_MAP, treesFor } from '../../src/data/skill-trees';
import { RANGE_CONTENT_VERSION } from '../../src/data/content';
import { command, restoreRun, stepRun, getLegalNodeIds } from '../../src/sim/engine';
import { openDraft } from '../../src/sim/draft';
import { drawTreeNode } from '../../src/sim/tree-draft';
import { treeMods, nodeLock } from '../../src/sim/skill-tree';
import { createEnemy } from '../../src/sim/combat';
import { stepWeapons, weaponStats, tacticalCooldown } from '../../src/sim/weapons';
import { weaponRange } from '../../src/sim/range';
import { replayDigest } from '../simulation/runner';
import type { CharacterId, RunState } from '../../src/sim/types';

function fixture(squad: CharacterId[]=['C01','C02','C03','C04','C05']) {
  const s=createRun({stageId:'S03',squadIds:squad,captainId:squad[0],seed:101});s.choicesEarned=18;openDraft(s);return s;
}
function take(s:RunState,id:string) {
  expect(command(s,{type:'custom-node',nodeId:id}),id).toBe(true);
  expect(command(s,{type:'choose',offerId:s.draft!.id,nodeId:id}),id).toBe(true);
}
function tree(s:RunState,id:string,branches=[1,2]) { for(const n of [0,...branches,4])take(s,`${id}:${n}`); }
function targets(s:RunState) {
  s.enemies=[];s.projectiles=[];s.fields=[];
  return [240,265,290,315,340,365].map(y=>{const e=createEnemy(s,'E03',195,y,0);e.hp=e.maxHp=100000;return e;});
}

describe('multi-tree contracts',()=>{
  it('defines 14 trees / 70 nodes with the agreed 3,2,2,2,2,3 distribution',()=>{
    expect(SKILL_TREES.length).toBe(14);expect(Object.keys(NODE_MAP).length).toBe(70);
    expect(['C01','C02','C03','C04','C05','C06'].map(id=>treesFor(id as CharacterId).length)).toEqual([3,2,2,2,2,3]);
  });
  for(const t of SKILL_TREES)for(const branches of [[1,2],[1,3],[2,3]])it(`${t.id}: either pair reaches terminal at exactly 4 points; spare branch remains legal (${branches})`,()=>{
    const s=fixture([t.ownerId]);expect(nodeLock(s,`${t.id}:4`)).toBeTruthy();
    take(s,`${t.id}:0`);take(s,`${t.id}:${branches[0]}`);expect(nodeLock(s,`${t.id}:4`)).toBeTruthy();
    take(s,`${t.id}:${branches[1]}`);expect(nodeLock(s,`${t.id}:4`)).toBeNull();take(s,`${t.id}:4`);
    expect(s.choicesSpent).toBe(4);expect(s.evolvedCount).toBe(1);
    expect(nodeLock(s,`${t.id}:${[1,2,3].find(n=>!branches.includes(n))}`)).toBeNull();
    expect(restoreRun(s)).toEqual(s);
  });
  it('supports cross-tree ordinary investment but enforces per-character and squad terminal limits',()=>{
    const s=fixture();tree(s,'C01-A');take(s,'C01-B:0');take(s,'C01-B:1');take(s,'C01-B:2');
    expect(nodeLock(s,'C01-B:4')).toContain('本角色');tree(s,'C02-A');tree(s,'C03-A');
    expect(s.evolvedCount).toBe(3);expect(nodeLock(s,'C04-A:4')).toContain('名額');
    expect(command(s,{type:'custom-node',nodeId:'C01-B:4'})).toBe(false);
    expect(command(s,{type:'custom-node',nodeId:'C06-A:0'})).toBe(false);
  });
  it('does not spend RNG, points or replace random candidates on ordinary custom browsing',()=>{
    const s=fixture(),before=structuredClone(s);let id=getLegalNodeIds(s).find(n=>!s.draft!.cards.some(c=>c.nodeId===n))!;
    command(s,{type:'custom-node',nodeId:id});expect(s.rng).toEqual(before.rng);expect(s.choicesSpent).toBe(0);
    expect(s.draft!.cards.slice(1)).toEqual(before.draft!.cards.slice(1));
    const random=s.draft!.cards[1].nodeId;command(s,{type:'custom-node',nodeId:random});
    expect(new Set(s.draft!.cards.map(c=>c.nodeId)).size).toBe(3);expect(s.draft!.cards[1].nodeId).toBe(id);expect(s.rng).toEqual(before.rng);
  });
  it('keeps one custom slot on every offer and exactly three rerolls; rejects stale, duplicate and unsupported commands',()=>{
    const s=fixture();const id=s.draft!.id,custom=s.draft!.customNodeId;
    for(let i=0;i<3;i++){expect(command(s,{type:'reroll',offerId:id})).toBe(true);expect(s.draft!.cards[0].nodeId).toBe(custom);}
    const frozen=structuredClone(s);expect(command(s,{type:'reroll',offerId:id})).toBe(false);expect(s).toEqual(frozen);
    expect(command(s,{type:'focus',characterId:'C01',branch:'B'})).toBe(false);
    for(let n=0;n<18;n++){
      const node=s.draft!.cards[0].nodeId;expect(command(s,{type:'choose',offerId:s.draft!.id,nodeId:node})).toBe(true);
      expect(command(s,{type:'choose',offerId:id,nodeId:node})).toBe(false);
      if(s.draft)expect(s.draft.cards.filter(c=>c.kind==='focus')).toHaveLength(1);
    }
    expect(s.choicesSpent).toBe(18);expect(s.draft).toBeNull();
  });
  it('weights a 2-tree and a 3-tree character equally rather than by legal node count',()=>{
    const s=fixture(['C01','C02']);const pool=getLegalNodeIds(s).filter(n=>n.includes(':'));const counts={C01:0,C02:0};
    for(let i=0;i<20000;i++)counts[NODE_MAP[drawTreeNode(s,pool)].ownerId as keyof typeof counts]++;
    expect(counts.C01/20000).toBeGreaterThan(.48);expect(counts.C01/20000).toBeLessThan(.52);
  });
  it('preserves tree pause independently of user and upgrade pauses, including restored snapshots',()=>{
    const s=fixture();command(s,{type:'pause',reason:'tree'});command(s,{type:'pause',reason:'user'});
    const frozen=restoreRun(s);stepRun(frozen,300);expect(frozen).toEqual(s);
    command(frozen,{type:'resume',reason:'tree'});expect(frozen.pauseReasons).toEqual(['upgrade','user']);
  });
  it('rejects corrupt node order, ownership, duplicate nodes, forged counts and duplicate terminals',()=>{
    const s=fixture();tree(s,'C01-A');
    for(const change of [(s:RunState)=>s.treeNodes!.push(s.treeNodes![0]),(s:RunState)=>s.treeNodes!.reverse(),(s:RunState)=>s.treeNodes![0]='C06-A:0',(s:RunState)=>s.evolvedCount++,(s:RunState)=>s.choicesSpent++,(s:RunState)=>s.treeNodes!.push('C01-B:4')]) {
      const bad=structuredClone(s);change(bad);expect(()=>restoreRun(bad)).toThrow();
    }
  });
});

describe('tree combat actually uses the purchased nodes',()=>{
  it('adds range and rescales remaining cooldown without a free shot',()=>{
    const s=fixture(['C01']);take(s,'C01-A:0');s.weapons[0].nextAttack=s.tick+90;
    const before=weaponStats(s,s.weapons[0]).interval;take(s,'C01-A:1');
    expect(s.weapons[0].nextAttack).toBe(s.tick+Math.ceil(90*weaponStats(s,s.weapons[0]).interval/before));
    take(s,'C01-A:2');expect(weaponRange(s,'C01')).toBe(455);expect(s.weapons[0].attacks).toBe(0);
  });
  it('combines Rion spread, penetration and self-applied exposure',()=>{
    const s=fixture(['C01']);tree(s,'C01-A',[1,3]);take(s,'C01-B:0');take(s,'C01-B:1');take(s,'C01-C:0');targets(s);
    s.weapons[0].attacks=2;stepWeapons(s);expect(s.projectiles).toHaveLength(3);expect(s.projectiles[0].remaining).toBe(2);
    expect(s.projectiles[0].packet!.exposure?.value).toBe(.1);expect(s.projectiles[1].packet!.exposure).toBeUndefined();
  });
  it('keeps chain lightning with the magnetic terminal and emits a real blast and stun',()=>{
    const s=fixture(['C02']);tree(s,'C02-B',[1,3]);take(s,'C02-A:0');take(s,'C02-A:1');targets(s);
    for(let i=0;i<3;i++){s.tick=s.weapons[0].nextAttack;stepWeapons(s);}
    expect(s.events.some(e=>e.kind==='arc')).toBe(true);expect(s.events.some(e=>e.kind==='explosion')).toBe(true);
    expect(s.enemies.some(e=>e.effects.some(f=>f.kind==='stun'))).toBe(true);
  });
  it('retains purchased penetration with the core sniper terminal',()=>{
    const s=fixture(['C03']);tree(s,'C03-B');take(s,'C03-A:0');take(s,'C03-A:1');targets(s);stepWeapons(s);
    expect(s.enemies.filter(e=>e.hp<e.maxHp)).toHaveLength(4);
  });
  it('keeps direct gravity impacts, pull fields and cross-tree knockback together',()=>{
    const s=fixture(['C04']);tree(s,'C04-A',[1,3]);take(s,'C04-B:0');take(s,'C04-B:1');const enemies=targets(s);s.weapons[0].attacks=4;stepWeapons(s);
    expect(s.fields).toHaveLength(1);expect(s.fields[0].pull).toBe(24);expect(s.fields[0].y).toBe(365);expect([...s.events].reverse().find(e=>e.kind==='explosion')!.y).toBe(365);expect(enemies.some(e=>e.hp<e.maxHp)).toBe(true);
    expect(enemies.some((e,i)=>e.y<[240,265,290,315,340,365][i])).toBe(true);
  });
  it('retains fire fields and attached burns when choosing explosive terminal; existing shells retain their snapshots',()=>{
    const s=fixture(['C05']);take(s,'C05-A:0');take(s,'C05-A:2');targets(s);stepWeapons(s);const old=structuredClone(s.projectiles[0]);
    tree(s,'C05-B');expect(s.projectiles[0]).toEqual(old);s.tick=s.weapons[0].nextAttack;stepWeapons(s);
    expect(s.projectiles[1].packet!.burn).toBeDefined();expect(s.projectiles[1].fire).toBeDefined();expect(s.projectiles[1].blastRadius).toBeGreaterThan(old.blastRadius);
  });
  it('allows drone, exposure and automatic shield investments together and never heals the wall',()=>{
    const s=fixture(['C06']);tree(s,'C06-B');take(s,'C06-A:0');take(s,'C06-A:1');take(s,'C06-C:0');take(s,'C06-C:1');targets(s);
    s.tick=s.weapons[0].shieldAt;s.wallHp=500;stepWeapons(s);s.tick=s.weapons[0].nextAttack;stepWeapons(s);
    expect(s.weapons[0].droneAttacks).toEqual([2,2]);expect(s.enemies.some(e=>e.effects.some(f=>f.kind==='exposure'&&f.value===.25))).toBe(true);
    expect(s.shields[0].value).toBe(60);expect(s.wallHp).toBe(500);
  });
  it('captain cooldown bonuses only affect the owner captain; weapon bonuses still work as a teammate',()=>{
    const s=fixture(['C03','C06']);const before=tacticalCooldown(s);tree(s,'C06-A',[2,3]);expect(tacticalCooldown(s)).toBe(before);
    const normal=createRun(s.config);expect(weaponStats(s,s.weapons[1]).damage).toBeGreaterThan(weaponStats(normal,normal.weapons[1]).damage);
    take(s,'C03-B:0');take(s,'C03-B:3');expect(tacticalCooldown(s)).toBeLessThan(before);
  });
});

describe('dev.3 save replay compatibility',()=>{
  const data=JSON.parse(readFileSync(new URL('../../artifacts/validation/combat-readability/ship/balance-runs.json',import.meta.url),'utf8'));
  for(const r of data.runs.filter((r:any)=>r.seed===101))it(`${r.buildId}: preserves exact previous simulation digest`,()=>{
    const s=createRun(r.config,RANGE_CONTENT_VERSION);let cursor=0;
    while(!s.outcome){while(r.commandLog[cursor]?.tick===s.tick)expect(command(s,r.commandLog[cursor++].command)).toBe(true);if(!s.outcome){if(s.pauseReasons.length)throw new Error('replay stalled');stepRun(s);}}
    expect(cursor).toBe(r.commandLog.length);expect(replayDigest(s)).toBe(r.finalDigest);
  });
});

it('a solo sniper can exhaust 17 applicable upgrades and save the 18th completion without getting stuck',()=>{
  const s=fixture(['C03']);
  for(let i=0;i<18;i++){
    const id=s.draft!.cards[0].nodeId;
    expect(command(s,{type:'choose',offerId:s.draft!.id,nodeId:id})).toBe(true);
    expect(restoreRun(s)).toEqual(s);
  }
  expect(s.stats.choices.at(-1)!.nodeId).toBe('EMPTY');expect(s.phase).toBe('running');expect(s.choicesSpent).toBe(18);
});

it('disabled-captain challenges never offer a cooldown-only or captain-only area upgrade',()=>{
  const s=createRun({stageId:'S01',squadIds:['C01'],captainId:'C01',seed:101,challengeId:'no-skill'});
  expect(getLegalNodeIds(s).some(id=>id.startsWith('G04')||id.startsWith('G03'))).toBe(false);
});

it('gravity-field DPS never drops when attack speed refreshes its position more often',()=>{
  const damage=(haste:boolean)=>{
    const s=fixture(['C04']);tree(s,'C04-A');if(haste){take(s,'G02-1');take(s,'G02-2');}
    s.draft=null;s.pauseReasons=[];s.phase='running';s.choicesEarned=s.choicesSpent;s.enemies=[];s.spawnCursor=s.spawnPlan.length;
    const e=createEnemy(s,'E01',195,250,0);e.hp=e.maxHp=100000;e.speed=0;e.abilityAt=999999;
    let sum=0,seq=s.eventSeq;
    for(let i=0;i<600;i++){stepRun(s);for(const event of s.events)if(event.seq>seq&&event.kind==='hit'&&event.skill==='gravity-field')sum+=event.value??0;seq=s.eventSeq;}
    return sum;
  };
  expect(damage(true)).toBeGreaterThanOrEqual(damage(false));
});
