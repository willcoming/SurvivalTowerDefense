import { describe, expect, it } from 'vitest';
import { DEEP_NODE_MAP, deepTreesFor } from '../../src/data/deep-trees';
import { CONDITIONAL_KEYS } from '../../src/data/tactical-skills';
import { createRun } from '../../src/sim/engine';
import { applyUpgrade } from '../../src/sim/weapons';
import { skillStatComparison } from '../../src/ui/skill-stat-preview';
import type { RunState } from '../../src/sim/types';

function fixture(){
  return createRun({stageId:'S01',squadIds:['C01','C02','C03','C04','C06'],captainId:'C01',seed:101});
}
function prerequisites(run:RunState,id:string){
  const node=DEEP_NODE_MAP[id];
  for(const parent of node.requires==='all'?node.parents:node.parents.slice(0,1)){
    prerequisites(run,parent);
    if(!run.treeNodes!.includes(parent))run.treeNodes=[...run.treeNodes!,parent];
  }
}

describe('read-only skill stat preview',()=>{
  it('does not change the live run, pending selection, RNG or weapon timers',()=>{
    const run=fixture();prerequisites(run,'C01-A4/1');
    const before=structuredClone(run);
    const rows=skillStatComparison(run,'C01','C01-A4/1');
    expect(rows.some(member=>member.changed)).toBe(true);
    expect(run).toEqual(before);
    expect(skillStatComparison(run,'C01','C01-A4/1')).toEqual(rows);
    expect(run).toEqual(before);
  });

  for(const key of CONDITIONAL_KEYS)it(`reports ${key} as a conditional bonus and matches the acquired stats`,()=>{
    const run=fixture();
    const node=run.config.squadIds.flatMap(id=>deepTreesFor(id,run)).flatMap(t=>t.nodes).find(n=>n.mods[key])!;
    expect(node).toBeDefined();prerequisites(run,node.id);
    const owner=node.ownerId as typeof run.config.squadIds[number];
    const before=structuredClone(run);
    const preview=skillStatComparison(run,owner,node.id);
    const conditional=preview[0].rows.find(r=>r.key===key)!;
    expect(conditional.condition).toBeTruthy();expect(conditional.after).toBeGreaterThan(conditional.before);
    // The base-damage readout must not fold target-dependent bonuses into a guaranteed value.
    const damage=preview[0].rows.find(r=>r.key==='damage')!;
    expect(damage.after).toBe(damage.before);
    const purchased=structuredClone(run);applyUpgrade(purchased,node.id);
    const actual=skillStatComparison(purchased,owner);
    for(const row of preview[0].rows)expect(actual[0].rows.find(r=>r.key===row.key)?.before).toBeCloseTo(row.after,8);
    expect(run).toEqual(before);
  });

  it('shows a team conditional benefit on every affected deployed member',()=>{
    const run=fixture(),id='C02-C4/3';prerequisites(run,id);
    const before=structuredClone(run),preview=skillStatComparison(run,'C02',id);
    expect(preview.map(member=>member.ownerId)).toEqual(run.config.squadIds);
    for(const member of preview){
      const row=member.rows.find(r=>r.key==='controlledDamage')!;
      expect(row.after-row.before).toBeCloseTo(4,8);
    }
    const purchased=structuredClone(run);applyUpgrade(purchased,id);
    for(const member of preview){
      const actual=skillStatComparison(purchased,member.ownerId)[0];
      for(const row of member.rows)expect(actual.rows.find(r=>r.key===row.key)?.before).toBeCloseTo(row.after,8);
    }
    expect(run).toEqual(before);
  });

  it('does not preview a locked or already acquired node twice',()=>{
    const run=fixture();
    expect(skillStatComparison(run,'C01','C01-A4/4').every(m=>!m.changed)).toBe(true);
    run.treeNodes=['C01-A4/0'];
    expect(skillStatComparison(run,'C01','C01-A4/0').every(m=>!m.changed)).toBe(true);
  });
});
