import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../src/data/content';
import { deepTreesFor } from '../../src/data/deep-trees';
import { skillNetworkLayout, SKILL_NODE_SIZE, SKILL_ULTIMATE_SIZE } from '../../src/ui/skill-network-layout';

describe('responsive constellation geometry', () => {
  for (const width of [296, 366, 744, 999]) it(`keeps every branch and label inside a ${width}px mobile canvas`, () => {
    for (const owner of CHARACTER_IDS) {
      const nodes = deepTreesFor(owner).flatMap(tree => tree.nodes);
      const layout = skillNetworkLayout(nodes, 'mobile', width);
      expect(layout.width).toBe(width);
      const rects = nodes.map(node => {
        const position = layout.positions.get(node.id)!;
        const radius = (node.kind === 'ultimate' ? SKILL_ULTIMATE_SIZE : SKILL_NODE_SIZE) / 2;
        const halfWidth = Math.max(layout.labelWidth / 2, radius + 14);
        return { left: position.x - halfWidth, right: position.x + halfWidth, top: position.y - radius - 14, bottom: position.y + radius + 44 };
      });
      for (const rect of rects) { expect(rect.left).toBeGreaterThan(0); expect(rect.right).toBeLessThan(width); }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
      }
    }
  });

  it('preserves every prerequisite and routes it upward in both layouts', () => {
    for (const owner of CHARACTER_IDS) {
      const nodes = deepTreesFor(owner).flatMap(tree => tree.nodes);
      for (const mode of ['mobile', 'desktop'] as const) {
        const layout = skillNetworkLayout(nodes, mode, 366);
        expect(layout.edges).toHaveLength(nodes.reduce((sum, node) => sum + Math.max(1, node.parents.length), 0));
        for (const node of nodes) {
          const incoming = layout.edges.filter(edge => edge.child === node.id);
          expect(incoming.map(edge => edge.parent)).toEqual(node.parents.length ? node.parents : ['core']);
          for (const edge of incoming) {
            const parent = layout.positions.get(edge.parent) ?? layout.core;
            expect(parent.y).toBeGreaterThan(layout.positions.get(node.id)!.y);
            expect(edge.path).not.toMatch(/NaN|Infinity/);
          }
          if (mode === 'desktop') expect(layout.positions.get(node.id)!.x).toBe(node.atlas!.x);
        }
      }
    }
  });
});
