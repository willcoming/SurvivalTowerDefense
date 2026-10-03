import { describe, expect, it } from 'vitest';
import { createRun, stepRun } from '../../src/sim/engine';
import { createEnemy, distance } from '../../src/sim/combat';
import { deepLegalNodes, deepNodeCost, deepPointCost } from '../../src/sim/deep-tree';
import { applyUpgrade } from '../../src/sim/weapons';
import { openDraft } from '../../src/sim/draft';
import { DEEP_NODE_MAP } from '../../src/data/deep-trees';

const fixture=(hundred=false)=>createRun({stageId:hundred?'S03':'S01',difficulty:'easy',squadIds:['C01'],captainId:'C01',seed:101,...(hundred?{mode:'hundred' as const}:{})});
function resolveWithoutPoints(s:ReturnType<typeof fixture>){
  s.enemies=[];s.spawnCursor=s.spawnPlan.findIndex(e=>e.wave===2);
  s.tick=Math.max(...s.spawnPlan.slice(0,s.spawnCursor).map(e=>e.at));
}

describe('wave breaks only for spendable points',()=>{
  for(const hundred of [false,true])it(`automatically advances a zero-point ${hundred?'hundred':'campaign'} wave`,()=>{
    const s=fixture(hundred);resolveWithoutPoints(s);stepRun(s);
    expect(s.waveFlow!.wave).toBe(2);expect(s.waveFlow!.phase).toBe('combat');expect(s.draft).toBeNull();expect(s.phase).toBe('running');
    stepRun(s);expect(s.waveFlow!.wave).toBe(2);expect(s.enemies.length).toBeGreaterThan(0);
  });
  it('opens allocation with an affordable node',()=>{
    const s=fixture();resolveWithoutPoints(s);s.choicesEarned=1;stepRun(s);
    expect(s.waveFlow!.wave).toBe(1);expect(s.draft!.pointTarget).toBe(1);expect(s.phase).toBe('choosing');
  });
  it('banks one point when only two-point ultimates remain, and offers them when affordable',()=>{
    const s=fixture(true);
    for(let guard=0;guard<100;guard++){const id=deepLegalNodes(s).find(id=>DEEP_NODE_MAP[id].kind!=='ultimate');if(!id)break;applyUpgrade(s,id);}
    s.choicesSpent=deepPointCost(s.treeNodes!,s);s.choicesEarned=s.choicesSpent+1;s.waveFlow!.phase='allocation';
    expect(deepLegalNodes(s).length).toBeGreaterThan(0);expect(deepLegalNodes(s).every(id=>deepNodeCost(id,s)===2)).toBe(true);
    openDraft(s);expect(s.draft).toBeNull();expect(s.choicesEarned-s.choicesSpent).toBe(1);
    s.choicesEarned++;openDraft(s);expect(s.draft).not.toBeNull();
  });
  it('does not stop on a full tree despite banked points',()=>{
    const s=fixture(true);
    for(let guard=0;guard<100;guard++){const id=deepLegalNodes(s)[0];if(!id)break;applyUpgrade(s,id);}
    s.choicesSpent=deepPointCost(s.treeNodes!,s);s.choicesEarned=s.choicesSpent+3;s.waveFlow!.phase='allocation';
    expect(deepLegalNodes(s)).toEqual([]);openDraft(s);expect(s.draft).toBeNull();
  });
});

describe('crowded entrance placement and unchanged single-projectile collision',()=>{
  it('separates 42 mixed-size simultaneous entrants and preserves counts, XP and spawn RNG',()=>{
    const s=fixture(true);s.enemies=[];const rng=structuredClone(s.rng),plan=structuredClone(s.spawnPlan);
    for(let i=0;i<42;i++)createEnemy(s,i%3===0?'E07':'E01',195,20,1,1,true);
    expect(s.enemies).toHaveLength(42);expect(s.enemies.reduce((n,e)=>n+e.xp,0)).toBe(42);
    expect(s.rng).toEqual(rng);expect(s.spawnPlan).toEqual(plan);
    for(const [i,e] of s.enemies.entries()){
      expect(e.y).toBeLessThanOrEqual(20);expect(e.x-e.radius).toBeGreaterThanOrEqual(4);expect(e.x+e.radius).toBeLessThanOrEqual(386);
      for(const other of s.enemies.slice(i+1))expect(distance(e,other)).toBeGreaterThanOrEqual(e.radius+other.radius+4-1e-8);
    }
  });
  for(const count of [1,2])it(`hits ${count} distinct targets when two enemies overlap and penetration is ${count}`,()=>{
    const s=fixture();s.enemies=[];s.spawnCursor=s.spawnPlan.length;for(const w of s.weapons)w.nextAttack=1e9;
    const a=createEnemy(s,'E01',195,400),b=createEnemy(s,'E01',195,400);b.x=a.x;b.y=a.y; // Deliberately bypass placement to test the actual collision rule.
    a.speed=b.speed=0;const hp=a.hp;s.projectiles=[{id:s.nextEntityId++,x:195,y:420,tx:195,ty:400,vx:0,vy:-700,expires:100,hitIds:[],remaining:count,falloff:[1,.8],radius:4,blastRadius:0,packet:{source:'C01',skill:'collision-test',raw:10,damageType:'plasma',armorIgnore:1,shieldMultiplier:1},enemyDamage:0,enemySource:null,impactAt:0}];
    stepRun(s);
    const hits=s.events.filter(e=>e.kind==='hit'&&e.skill==='collision-test');expect(hits.map(e=>e.targetId)).toEqual(count===1?[a.id]:[a.id,b.id]);
    expect(a.hp).toBeLessThan(hp);expect(b.hp<hp).toBe(count===2);
    stepRun(s,3);expect(s.events.filter(e=>e.kind==='hit'&&e.skill==='collision-test')).toHaveLength(count);
  });
});
