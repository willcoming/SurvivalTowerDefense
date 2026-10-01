import {describe,it,expect} from 'vitest';
import {damageLabelAnchor} from '../../src/game/presentation';
import {REWORKED_TREES,resolveSkillNode} from '../../src/data/reworked-skills';
describe('UI mechanics correspondence',()=>{
 it('renames the former anti-armor node to match its existing isolated-target effect, including summer',()=>{
  const n=REWORKED_TREES.find(t=>t.id==='C05-B4')!.nodes.find(n=>n.id==='C05-B4/2')!;
  expect(n.name).toBe('獨擊增幅');expect(n.mods).toEqual({isolatedDamage:.24});expect(n.description).toContain('沒有其他敵人');
  const summer=resolveSkillNode(n,'C05-summer');expect(summer.name).not.toContain('反甲');expect(summer.description).not.toContain('忽略');
 });
 it('keeps twelve nearby damage labels apart and outside the warning band',()=>{
  const anchors:{x:number;y:number}[]=[];
  for(let i=0;i<12;i++)anchors.push(damageLabelAnchor(195,35,anchors));
  for(const a of anchors){expect(a.x).toBeGreaterThanOrEqual(42);expect(a.x).toBeLessThanOrEqual(348);expect(a.y-20).toBeGreaterThanOrEqual(90);}
  for(let i=0;i<anchors.length;i++)for(let j=0;j<i;j++)expect(Math.abs(anchors[i].x-anchors[j].x)>=76||Math.abs(anchors[i].y-anchors[j].y)>=46).toBe(true);
 });
});
