import type { CharacterId, Command, RunConfig, RunState } from '../../src/sim/types';

export const POLICY_VERSION = 'policy-v3';
export const FORMAL_SEEDS = [101, 211, 307, 401, 503, 601, 709, 809, 907, 1009] as const;

export interface BuildPolicy {
  id: 'T01' | 'T02' | 'T03';
  squad: CharacterId[];
  captain: CharacterId;
  cores: string[];
  supports: string[];
  commonPreference: string;
}

export const BUILD_POLICIES: BuildPolicy[] = [
  { id: 'T01', squad: ['C01', 'C02', 'C04', 'C05', 'C06'], captain: 'C02', cores: ['C02-A', 'C01-A', 'C05-A'], supports: ['C04-B', 'C06-A'], commonPreference: 'G06' },
  { id: 'T02', squad: ['C01', 'C02', 'C03', 'C04', 'C06'], captain: 'C03', cores: ['C03-B', 'C01-B', 'C06-A'], supports: ['C02-A', 'C04-B'], commonPreference: 'G04' },
  { id: 'T03', squad: ['C02', 'C03', 'C04', 'C05', 'C06'], captain: 'C04', cores: ['C04-A', 'C05-A', 'C06-B'], supports: ['C02-A', 'C03-B'], commonPreference: 'G06' },
];

export function configFor(policy: BuildPolicy, seed: number): RunConfig {
  return {
    stageId: 'S03', squadIds: [...policy.squad], captainId: policy.captain, seed,
    challengeId: null,
    preferredBranches: Object.fromEntries([...policy.cores, ...policy.supports].map(route => [route.slice(0, 3), route.at(-1)])),
  };
}

export function rankOf(state: RunState, route: string): number {
  const weapon = state.weapons.find(w => w.id === route.slice(0, 3));
  return weapon && weapon.branch === route.at(-1) ? weapon.rank : 0;
}

export function routeOf(nodeId: string): string | null {
  return /^(C\d\d-[AB])(?:-|$)/.exec(nodeId)?.[1] ?? null;
}

export function nodeRank(nodeId: string): number {
  const tail = nodeId.split('-').at(-1);
  return tail === 'I' || tail === '1' ? 1 : tail === 'II' || tail === '2' ? 2 : tail === 'E' || tail === '3' ? 3 : 0;
}

export function cardPriority(state: RunState, policy: BuildPolicy, nodeId: string): number {
  const route = routeOf(nodeId);
  if (route) {
    const core = policy.cores.indexOf(route);
    if (core >= 0) return nodeRank(nodeId) === 3 ? core : 10 + core;
    const support = policy.supports.indexOf(route);
    return support >= 0 && nodeRank(nodeId) < 3 ? 40 + support : Number.POSITIVE_INFINITY;
  }
  const common = /^(G\d\d)(?:-|$)/.exec(nodeId)?.[1];
  if (!common) return nodeId === 'EMPTY' || nodeId === 'empty' || nodeId === 'complete' ? 1000 : Number.POSITIVE_INFINITY;
  if (common === 'G01' && (state.commonRanks.G01 ?? 0) < 2) return 20;
  if (common === 'G02' && (state.commonRanks.G02 ?? 0) < 2) return 30;
  if (common === policy.commonPreference && (state.commonRanks[common] ?? 0) < 1) return 50;
  const fallback = ['G04', 'G06', 'G03', 'G05'].indexOf(common);
  return fallback >= 0 ? 60 + fallback : 90;
}

export interface CastDecision { command: Command; reason: string }

/** Uses only currently observable battlefield state; never reads spawnPlan or RNG. */
export function castDecision(state: RunState, policy: BuildPolicy, mode: 'timed' | 'immediate' = 'timed'): CastDecision | null {
  if (state.phase !== 'running' || state.pauseReasons.length || state.tick < state.tacticalReadyAt || !state.enemies.length) return null;
  const cast = (reason: string): CastDecision => ({ command: { type: 'cast' }, reason });
  if (mode === 'immediate') return cast('baseline: ready and a live target');
  const boss = state.enemies.find(e => e.defId.startsWith('B') && e.hp > 0);
  const chargingArtillery = state.enemies.some(e => e.defId === 'E05' && e.chargeUntil > state.tick && e.chargeUntil - state.tick <= 15);
  const imminentBoss = boss && boss.chargeUntil > state.tick && boss.chargeUntil - state.tick <= 15;
  const nAfter = (y: number) => state.enemies.filter(e => !e.defId.startsWith('B') && e.hp > 0 && e.y >= y).length;
  const waitingReady = state.tick - state.tacticalReadyAt;

  if (policy.id === 'T01') {
    if (imminentBoss) return cast('boss charge within 0.5s');
    if (chargingArtillery || nAfter(410) >= 3) return cast('artillery charge or three enemies near defense');
    if (!boss && !state.bossSpawned && state.enemies.length >= 8) return cast('eight visible enemies before boss');
    if (boss && boss.chargeUntil <= state.tick && state.enemies.length >= 8 && waitingReady >= 300) return cast('crowd after holding ready for ten seconds');
  } else if (policy.id === 'T02') {
    if (boss && (boss.exposureUntil > state.tick || boss.effects.some(e => e.kind === 'exposure' && e.expires > state.tick))) return cast('boss exposure window');
    if (boss && boss.shield <= 0 && waitingReady >= 180) return cast('unshielded boss after six seconds ready');
    if (!boss && !state.bossSpawned && state.enemies.some(e => ['E03', 'E07', 'E08'].includes(e.defId) && e.hp >= 120 && (e.y >= 250 || e.chargeKind === 'rush'))) return cast('armored or elite threat in lower battlefield');
    if (!boss && !state.bossSpawned && nAfter(410) >= 1) return cast('enemy reaching defense');
  } else {
    if (imminentBoss) return cast('boss charge within 0.5s');
    if (chargingArtillery || nAfter(370) >= 3) return cast('artillery charge or three enemies in lower battlefield');
    if (!boss && !state.bossSpawned && state.enemies.length >= 8 && nAfter(300) >= 1) return cast('crowd advancing into lower battlefield');
  }
  return null;
}
