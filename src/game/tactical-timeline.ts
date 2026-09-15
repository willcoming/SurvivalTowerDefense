import type { CharacterId, RunState } from '../sim/types';

export const TACTICAL_DURATION_MS = 1400;
export const TACTICAL_RELEASE_MS = 650;

/** Presentation-only time: never enters the deterministic simulation or saved profile. */
export class TacticalTimeline {
  runId = '';
  characterId: CharacterId | null = null;
  elapsedMs = TACTICAL_DURATION_MS;
  serial = 0;

  active(run: Pick<RunState, 'runId' | 'outcome'>) {
    return this.runId === run.runId && !run.outcome && this.elapsedMs < TACTICAL_DURATION_MS;
  }
  play(run: RunState) {
    if (this.active(run)) return false;
    this.runId = run.runId;
    this.characterId = run.config.captainId;
    this.elapsedMs = 0;
    this.serial++;
    return true;
  }
  /** The caller discards this frame's simulation accumulator even on the final frame. */
  advance(run: RunState, elapsedMs: number) {
    if (!this.active(run)) return false;
    if (run.phase === 'running' && !run.bossIntro && Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 500) {
      this.elapsedMs = Math.min(TACTICAL_DURATION_MS, this.elapsedMs + elapsedMs);
    }
    return true;
  }
}
