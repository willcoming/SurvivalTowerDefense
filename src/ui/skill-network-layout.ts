import type { DeepNode } from '../data/deep-trees';

export const SKILL_MAP_WIDTH = 1240;
export const SKILL_MAP_HEIGHT = 980;
export const SKILL_MAP_CORE = { x: 620, y: 935 };
export const SKILL_NODE_SIZE = 44;
export const SKILL_ULTIMATE_SIZE = 60;
export type SkillMapLayoutMode = 'mobile' | 'desktop';
export interface MapPoint { x: number; y: number }
export interface MapEdge { parent: string; child: string; cross: boolean; path: string }
export interface MapBounds { left: number; top: number; right: number; bottom: number }

/** Round a routed polyline without changing its dedicated crossing channels. */
function roundedRoute(points: MapPoint[]) {
  points = points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1], point = points[i], after = points[i + 1];
    const incoming = Math.hypot(point.x - before.x, point.y - before.y);
    const outgoing = Math.hypot(after.x - point.x, after.y - point.y);
    if (!incoming || !outgoing) continue;
    const radius = Math.min(12, incoming / 2, outgoing / 2);
    const start = { x: point.x + (before.x - point.x) * radius / incoming, y: point.y + (before.y - point.y) * radius / incoming };
    const end = { x: point.x + (after.x - point.x) * radius / outgoing, y: point.y + (after.y - point.y) * radius / outgoing };
    path += ` L ${start.x} ${start.y} Q ${point.x} ${point.y} ${end.x} ${end.y}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

/** Presentation coordinates only: prerequisite IDs, costs and saved skills never change. */
export function skillNetworkLayout(nodes: DeepNode[], mode: SkillMapLayoutMode = 'desktop', viewportWidth = SKILL_MAP_WIDTH) {
  const mobile = mode === 'mobile', width = mobile ? Math.max(240, viewportWidth) : SKILL_MAP_WIDTH;
  const height = mobile ? 1110 : SKILL_MAP_HEIGHT;
  const core = mobile ? { x: width / 2, y: 1040 } : SKILL_MAP_CORE;
  const trees = [...new Set(nodes.map(node => node.treeId))];
  const laneWidth = (width - 32) / trees.length;
  const labelWidth = mobile ? Math.min(92, laneWidth - 20) : 100;
  // Split each logical layer into reading rows. Cross-route parents remain below children.
  const rows = [0, 5, 1, 6, 2, 3, 7, 4];
  const positions = new Map(nodes.map(node => [node.id, mobile ? {
    x: 16 + (trees.indexOf(node.treeId) + .5) * laneWidth,
    y: 920 - rows.indexOf(Number(node.id.split('/')[1])) * 120,
  } : { x: node.atlas!.x, y: 160 + (node.atlas!.y - 110) * 1.65 }]));
  const badgePositions = new Map(trees.map(tree => {
    const entry = nodes.find(node => node.treeId === tree && node.kind === 'entry')!;
    const point = positions.get(entry.id)!;
    return [tree, { x: point.x, y: point.y + 72 }];
  }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const edges: MapEdge[] = [];
  for (const child of nodes) {
    const b = positions.get(child.id)!;
    const childRadius = (child.kind === 'ultimate' ? SKILL_ULTIMATE_SIZE : SKILL_NODE_SIZE) / 2;
    for (const parentId of child.parents.length ? child.parents : ['core']) {
      const parent = byId.get(parentId), a = positions.get(parentId) ?? core;
      const cross = !!parent && parent.treeId !== child.treeId;
      const parentRadius = parent ? SKILL_NODE_SIZE / 2 : 27;
      let path: string;
      if (mobile && parent) {
        const side = cross ? Math.sign(b.x - a.x) : Number(child.id.split('/')[1]) >= 5 ? 1 : -1;
        const gutter = laneWidth / 2 - 3;
        const exitX = a.x + side * gutter, entryX = b.x + (cross ? -side : side) * gutter;
        const entrySide = cross ? -side : side;
        const points = [{ x: a.x, y: a.y - parentRadius }, { x: exitX, y: a.y - parentRadius - 14 }];
        if (cross) points.push({ x: exitX, y: b.y + 84 }, { x: entryX, y: b.y + 84 });
        points.push({ x: entryX, y: b.y + 14 }, { x: b.x + entrySide * childRadius * .86, y: b.y + childRadius * .5 });
        path = roundedRoute(points);
      } else {
        const startY = a.y - parentRadius, endY = b.y + childRadius, bend = (startY + endY) / 2;
        path = `M ${a.x} ${startY} C ${a.x} ${bend} ${b.x} ${bend} ${b.x} ${endY}`;
      }
      edges.push({ parent: parentId, child: child.id, cross, path });
    }
  }
  const points = [...positions.values()];
  const badgeHalf = Math.min(50, laneWidth / 2 - 4);
  const bounds: MapBounds = {
    left: Math.min(core.x - 35, ...points.map(p => p.x - Math.max(labelWidth / 2, 44)), ...[...badgePositions.values()].map(p => p.x - badgeHalf)),
    right: Math.max(core.x + 35, ...points.map(p => p.x + Math.max(labelWidth / 2, 44)), ...[...badgePositions.values()].map(p => p.x + badgeHalf)),
    top: Math.min(...points.map(p => p.y - 50)),
    bottom: Math.max(core.y + 45, ...points.map(p => p.y + 72), ...[...badgePositions.values()].map(p => p.y + 18)),
  };
  return { width, height, core, labelWidth, positions, badgePositions, edges, bounds };
}
