import { operationProfile } from '../data/progression';
import type { RunState, SpawnEntry } from './types';

export const finalWave = (s: RunState) => operationProfile(s).waves.length + (s.config.mode === 'hundred' ? 0 : 1);
export const currentWave = (s: RunState) => s.waveFlow?.wave ?? Math.floor(s.tick / (operationProfile(s).interval * 30)) + 1;

export function spawnDue(s: RunState, entry: SpawnEntry): boolean {
  return s.waveFlow
    ? s.waveFlow.phase === 'combat' && entry.wave === s.waveFlow.wave && entry.at <= s.tick - s.waveFlow.startedAt
    : entry.at <= s.tick;
}

export function bossDue(s: RunState): boolean {
  return s.waveFlow
    ? s.waveFlow.phase === 'combat' && s.waveFlow.wave === finalWave(s)
    : s.tick >= Math.ceil(operationProfile(s).bossAt * 30);
}

/** Pending enemy attacks must resolve before a safe allocation break. */
export function waveResolved(s: RunState): boolean {
  const flow = s.waveFlow;
  return !!flow && !s.bossIntro
    && (!s.spawnPlan[s.spawnCursor] || s.spawnPlan[s.spawnCursor].wave > flow.wave)
    && !s.enemies.some(e => e.hp > 0)
    && !s.projectiles.some(p => p.enemySource && p.remaining > 0 && p.expires > s.tick)
    && !s.scheduled.some(hit => hit.enemySource)
    && (flow.wave < finalWave(s) || s.bossKilled);
}

/** Called once, after confirming or automatically skipping an allocation. */
export function startNextWave(s: RunState): void {
  if (!s.waveFlow || s.waveFlow.phase !== 'allocation') return;
  s.draft = null;
  s.pauseReasons = s.pauseReasons.filter(reason => reason !== 'upgrade' && reason !== 'tree');
  s.waveFlow = { version: 1, wave: s.waveFlow.wave + 1, startedAt: s.tick, phase: 'combat' };
}

export function validateWaveFlow(s: RunState): void {
  const flow = s.waveFlow;
  if (s.balanceVersion !== 5) {
    if (flow !== undefined) throw new Error('波次流程版本不相容');
    return;
  }
  if (!flow || flow.version !== 1 || !Number.isSafeInteger(flow.wave) || flow.wave < 1 || flow.wave > finalWave(s)
    || !Number.isSafeInteger(flow.startedAt) || flow.startedAt < 0 || flow.startedAt > s.tick
    || !['combat', 'allocation'].includes(flow.phase)) throw new Error('波次流程紀錄損壞');
  if (s.spawnPlan.slice(0, s.spawnCursor).some(p => p.wave > flow.wave || p.wave === flow.wave && p.at > s.tick - flow.startedAt)
    || s.spawnPlan.slice(s.spawnCursor).some(p => p.wave < flow.wave)
    || s.enemies.some(e => e.wave !== flow.wave)
    || s.bossSpawned && flow.wave !== finalWave(s)
    || !s.bossSpawned && flow.wave === finalWave(s) && s.tick > flow.startedAt && !s.outcome
    || s.bossKilled && !s.bossSpawned) throw new Error('波次進度紀錄損壞');
  if (flow.phase === 'allocation' && (!waveResolved(s) || flow.wave === finalWave(s) || !s.draft)
    || flow.phase === 'combat' && !!s.draft) throw new Error('波末配點紀錄損壞');
}
