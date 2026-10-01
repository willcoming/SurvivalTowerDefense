import type { DeepNode } from '../data/deep-trees';

export const SKILL_MAP_WIDTH = 1240;
export const SKILL_MAP_HEIGHT = 980;
export const SKILL_MAP_CORE = { x: 620, y: 935 };
export interface MapEdge { parent: string; child: string; cross: boolean; path: string }

/** Presentation coordinates only: saved prerequisites and skill costs stay untouched. */
export function skillNetworkLayout(nodes: DeepNode[], compact = false) {
  const trees = [...new Set(nodes.map(node => node.treeId))];
  const positions = new Map(nodes.map(node => [node.id, {
    x: compact ? 400 + trees.indexOf(node.treeId) * 220 + ([0, -55, -55, 0, -55, 55, 55, 55][Number(node.id.split('/')[1])] ?? 0) : node.atlas!.x,
    y: compact ? 820 - node.layer * 180 + (node.kind === 'entry' ? 15 : Number(node.id.split('/')[1]) >= 5 ? 100 : 0) : 160 + (node.atlas!.y - 110) * 1.65,
  }]));
  const byId = new Map(nodes.map(node => [node.id, node]));
  // Give every branch room for its icons and labels. Presentation coordinates
  // never change the real prerequisite IDs or cross-branch connections.
  if (compact) for (const node of nodes.filter(n => n.kind === 'ultimate')) {
    positions.set(node.id, { x: 400 + trees.indexOf(node.treeId) * 220, y: 90 });
  }
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
      const channel = compact ? (a.y + b.y) / 2 + (cross ? 12 : lane * 8) : parent ? 160 + (4 - child.layer) * 165 + (cross ? 117 : 79 + lane * 18) : 898;
      const end = b.y + (child.kind === 'ultimate' ? 40 : 34);
      edges.push({ parent: parentId, child: child.id, cross,
        path: `M ${a.x} ${a.y - 35} V ${channel} H ${b.x} V ${end}` });
    }
  }
  return { positions, edges };
}
