import {describe,it,expect} from 'vitest';
import {damageLabelAnchor} from '../../src/game/presentation';
import {REWORKED_TREES,resolveSkillNode} from '../../src/data/reworked-skills';
describe('UI mechanics correspondence',()=>{
 it('renames the former anti-armor node to match its existing isolated-target effect, including summer',()=>{
  const n=REWORKED_TREES.find(t=>t.id==='C05-B4')!.nodes.find(n=>n.id==='C05-B4/2')!;
  expect(n.name).toBe('獨擊增幅');expect(n.mods).toEqual({isolatedDamage:.24});expect(n.description).toContain('沒有其他敵人');
  const summer=resolveSkillNode(n,'C05-summer');expect(summer.name).not.toContain('反甲');expect(summer.description).not.toContain('忽略');
 });
 it('keeps crowded damage labels close to their actual target instead of unrelated empty lanes',()=>{
  const anchors:{x:number;y:number}[]=[];
  for(let i=0;i<12;i++)anchors.push(damageLabelAnchor(195,150,anchors));
  for(const a of anchors){expect(Math.abs(a.x-195)).toBeLessThanOrEqual(24);expect(Math.abs(a.y-126)).toBeLessThanOrEqual(12);}
  const upper=damageLabelAnchor(100,35,[]);expect(Math.abs(upper.y-35)).toBeLessThanOrEqual(24);
 });
});
