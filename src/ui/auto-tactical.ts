import type { RunState } from '../sim/types';

/** A convenience input policy; all targeting, costs and cooldowns stay in command('cast'). */
export function shouldAutoCast(run: RunState, enabled: boolean): boolean {
  return enabled && run.phase === 'running' && run.config.challengeId !== 'no-skill'
    && (run.config.captainId!=='C07'||!!run.mines?.length)
    && run.tacticalReadyAt <= run.tick && run.enemies.some(enemy => enemy.hp > 0);
}
