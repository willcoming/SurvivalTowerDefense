import { CHARACTERS, CHARACTER_MAP, ROUTES, COMMON_UPGRADES } from '../data/content';
import type { CharacterId, RunState } from '../sim/types';
import { weaponStats } from '../sim/weapons';

export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const clock = (ticks: number) => { const seconds = Math.max(0, Math.floor(ticks / 30)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
export const num = (v: number) => Math.round(v).toLocaleString('zh-TW');
export const portrait = (id: CharacterId, cls = '') => `<img class="${cls}" src="/assets/characters/${id}-portrait.webp" alt="${esc(CHARACTER_MAP[id].name)}" loading="lazy">`;
export const characterName = (id: string) => CHARACTERS.find(c => c.id === id)?.name ?? id;
export function cardInfo(nodeId: string) {
  if (nodeId === 'EMPTY') return { name: '完成本次校準', owner: '全隊', effect: '所有可用改造已完成。確認後繼續守護防線。', previous: '全部校準完成', tradeoff: '', rank: '', icon: '', ownerId: null, route: null };
  const match = nodeId.match(/^(C\d\d-[AB])-(\d)$/);
  if (match) {
    const route = ROUTES.find(r => r.id === match[1])!;
    const rank = Number(match[2]);
    return { name: route.name, owner: characterName(route.ownerId), effect: route.nodes[rank - 1], previous: rank === 1 ? '基礎武器' : route.nodes[rank - 2], tradeoff: route.tradeoff, rank: ['', 'I', 'II', 'E'][rank], icon: `/assets/evolutions/${route.id}.webp`, ownerId: route.ownerId, route };
  }
  const common = COMMON_UPGRADES.find(c => nodeId.startsWith(`${c.id}-`));
  return { name: common?.name ?? nodeId, owner: '全隊共鳴', effect: common?.description ?? '', previous: '共通面板', tradeoff: '僅本局生效，新戰局重置。', rank: nodeId.split('-').pop() ?? '', icon: '', ownerId: null, route: null };
}
export function weaponLabel(run: RunState, id: CharacterId) { const w = run.weapons.find(w => w.id === id); return !w?.branch ? '尚未改造' : `${ROUTES.find(r => r.id === `${id}-${w.branch}`)?.name} · ${['', 'I', 'II', 'E'][w.rank]}`; }
export const roleTags: Record<CharacterId, string[]> = { C01: ['清群', '對盾'], C02: ['清群', '對盾'], C03: ['對甲', '爆發'], C04: ['控場'], C05: ['清群', '對甲'], C06: ['支援'] };
export function cardPreview(run: RunState, nodeId: string) {
  const info = cardInfo(nodeId); const decimal = (n: number) => Number(n.toFixed(2));
  if (info.route) {
    const current = run.weapons.find(w => w.id === info.route!.ownerId)!;
    const next = { ...current, branch: info.route.branch, rank: Number(nodeId.split('-')[2]) };
    const before = weaponStats(run, current), after = weaponStats(run, next); const changes: string[] = [];
    if (before.damage !== after.damage) changes.push(`原始傷害 ${decimal(before.damage)} → ${decimal(after.damage)}${next.id === 'C04' && next.branch === 'A' && next.rank === 3 ? ' DPS' : ''}`);
    if (before.interval !== after.interval) changes.push(`間隔 ${decimal(before.interval / 30)} → ${decimal(after.interval / 30)} 秒`);
    if (before.radius !== after.radius) changes.push(`半徑 ${decimal(before.radius)} → ${decimal(after.radius)}`);
    if (before.duration !== after.duration) changes.push(`狀態時間 ×${decimal(before.duration)} → ×${decimal(after.duration)}`);
    return changes.join(' · ') || `目前 / ${info.previous}`;
  }
  const id = nodeId.split('-')[0], rank = run.commonRanks[id] ?? 0;
  if (id === 'G05') return `最大防線 ${run.wallMaxHp} → ${run.wallMaxHp + 100}，目前 ${Math.ceil(run.wallHp)} → ${Math.ceil(run.wallHp + 100)}`;
  const multiplier: Record<string, number> = { G01: 8, G02: 6, G03: 10, G04: 6, G06: 10 };
  return multiplier[id] ? `本局累計 ${id === 'G04' ? '−' : '+'}${rank * multiplier[id]}% → ${id === 'G04' ? '−' : '+'}${(rank + 1) * multiplier[id]}%` : info.previous;
}
