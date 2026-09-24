import type { DeepNode } from '../data/deep-trees';

export const SKILL_MAP_WIDTH = 1240;
export const SKILL_MAP_HEIGHT = 980;
export const SKILL_MAP_CORE = { x: 620, y: 935 };
export interface MapEdge { parent: string; child: string; cross: boolean; path: string }

/** Presentation coordinates only: saved prerequisites and skill costs stay untouched. */
export function skillNetworkLayout(nodes: DeepNode[]) {
  const positions = new Map(nodes.map(node => [node.id, {
    x: node.atlas!.x,
    y: 160 + (node.atlas!.y - 110) * 1.65,
  }]));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const localParents = (node: DeepNode) => node.parents.filter(id => byId.get(id)?.treeId === node.treeId).sort().join(',');
  const edges: MapEdge[] = [];
  for (const child of nodes) {
    const b = positions.get(child.id)!;
    for (const parentId of child.parents.length ? child.parents : ['core']) {
      const parent = byId.get(parentId);
      const a = positions.get(parentId) ?? SKILL_MAP_CORE;
      const cross = !!parent && parent.treeId !== child.treeId;
      // A shared horizontal channel makes forks and OR merges legible. Cross-branch
      // prerequisites occupy their own channel, below the local branch's junctions.
      const families = [...new Set(nodes.filter(n => n.treeId === child.treeId && n.layer === child.layer).map(localParents))];
      const lane = families.indexOf(localParents(child));
      const channel = parent ? 160 + (4 - child.layer) * 165 + (cross ? 117 : 79 + lane * 18) : 898;
      const end = b.y + (child.kind === 'ultimate' ? 40 : 34);
      edges.push({ parent: parentId, child: child.id, cross,
        path: `M ${a.x} ${a.y - 35} V ${channel} H ${b.x} V ${end}` });
    }
  }
  return { positions, edges };
}
