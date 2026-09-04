import { createHash } from 'node:crypto';
import { command, createRun, stepRun } from '../../src/sim/engine';
import type { Command, RunConfig, RunState } from '../../src/sim/types';
import { cardPriority, castDecision, configFor, POLICY_VERSION, rankOf, type BuildPolicy } from './policies';

const FOCUS_CHOICES = [1, 4, 7, 10, 13, 16];

/** Unit fixtures may modify snapshots; this formal runner never does. */
export function resolvePolicyDraft(state: RunState, policy: BuildPolicy): void {
  let draft = state.draft;
  if (!draft) throw new Error('Policy called without a draft');
  const choose = (nodeId: string) => {
    const offerId = state.draft!.id;
    if (!command(state, { type: 'choose', offerId, nodeId })) throw new Error(`Policy rejected choice ${nodeId} at offer ${offerId}`);
  };
  const corePrep = policy.cores.find(route => rankOf(state, route) < 2);
  if (FOCUS_CHOICES.includes(draft.choice) && corePrep) {
    command(state, { type: 'focus', characterId: corePrep.slice(0, 3) as RunConfig['captainId'], branch: corePrep.at(-1) as 'A' | 'B' });
    choose(`${corePrep}-${rankOf(state, corePrep) + 1}`);
    return;
  }
  const readyCore = policy.cores.find(route => rankOf(state, route) === 2);
  if (readyCore && state.evolvedCount < state.evolutionLimit) {
    const nodeId = `${readyCore}-3`;
    command(state, { type: 'evolution', nodeId });
    choose(nodeId);
    return;
  }
  if (FOCUS_CHOICES.includes(draft.choice)) {
    const support = policy.supports.find(route => rankOf(state, route) < 2);
    if (support) command(state, { type: 'focus', characterId: support.slice(0, 3) as RunConfig['captainId'], branch: support.at(-1) as 'A' | 'B' });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    draft = state.draft!;
    const ranked = [...draft.cards].sort((a, b) => cardPriority(state, policy, a.nodeId) - cardPriority(state, policy, b.nodeId) || a.nodeId.localeCompare(b.nodeId));
    const best = ranked[0];
    if (!best) throw new Error(`Draft ${draft.id} has no completion card`);
    const priority = cardPriority(state, policy, best.nodeId);
    if (priority >= 60 && state.rerollsRemaining > 0 && command(state, { type: 'reroll', offerId: draft.id })) continue;
    if (!Number.isFinite(priority)) throw new Error(`policy-no-legal-card: ${draft.cards.map(x => x.nodeId).join(',')}`);
    choose(best.nodeId);
    return;
  }
  throw new Error('Policy reroll loop exceeded legal three-reroll budget');
}

export interface RunReport {
  contentVersion: string; schemaVersion: number; policyVersion: string; buildId: string; seed: number;
  config: RunConfig; mode: string; initialSnapshotDigest: string; spawnPlanDigest: string; outcome: RunState['outcome']; endTick: number;
  effectiveSeconds: number; wallHp: number; wallMaxHp: number; wallHpDamage: number; wallShieldAbsorbed: number;
  choices: RunState['stats']['choices']; casts: { tick: number; reason: string }[];
  evolvedRoutes: string[]; completedCoreRoutes: string[]; routeRanks: { id: string; rank: number }[];
  commonRanks: Record<string, number>; choicesEarned: number; choicesSpent: number; rerollsRemaining: number;
  characterDamage: Record<string, number>; wallDamageByEnemy: Record<string, number>; controls: Record<string, number>;
  commandLog: RunState['actions']; finalDigest: string; finalSimulationSteps: number;
}

export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function initialCombatState(state: RunState) {
  return {
    wallHp: state.wallHp, wallMaxHp: state.wallMaxHp, shields: state.shields,
    weapons: state.weapons, commonRanks: state.commonRanks, xp: state.xp,
    choicesEarned: state.choicesEarned, choicesSpent: state.choicesSpent,
    rerollsRemaining: state.rerollsRemaining, evolutionLimit: state.evolutionLimit,
    tacticalReadyAt: state.tacticalReadyAt,
  };
}

export function replayDigest(state: RunState): string {
  const { runId: _runId, events: _events, ...rest } = state;
  return digest(rest);
}

export function runPolicy(policy: BuildPolicy, seed: number, options: { mode?: 'timed' | 'immediate'; config?: RunConfig } = {}): { state: RunState; report: RunReport } {
  const mode = options.mode ?? (policy.id === 'T02' ? 'immediate' : 'timed');
  const state = createRun(options.config ?? configFor(policy, seed));
  const initialSnapshotDigest = digest(initialCombatState(state));
  const casts: RunReport['casts'] = [];
  let steps = 0;
  let safety = 0;
  while (state.phase !== 'ended') {
    if (++safety > 16000) throw new Error(`Run did not terminate within 480s plus choices: ${policy.id}/${seed} tick=${state.tick}`);
    if (state.draft) { resolvePolicyDraft(state, policy); continue; }
    if (state.bossIntro && command(state, { type: 'finish-boss-intro' })) continue;
    if (state.pauseReasons.length) throw new Error(`Unexpected autonomous pause: ${state.pauseReasons.join(',')}`);
    const decision = castDecision(state, policy, mode);
    if (decision && command(state, decision.command)) casts.push({ tick: state.tick, reason: decision.reason });
    const oldTick = state.tick;
    stepRun(state);
    steps++;
    if (state.tick === oldTick && !state.draft && (state.phase as RunState['phase']) !== 'ended') throw new Error(`Simulation stalled at ${state.tick}`);
  }
  const evolvedRoutes = state.weapons.filter(w => w.rank === 3).map(w => `${w.id}-${w.branch}`);
  const report: RunReport = {
    contentVersion: state.contentVersion, schemaVersion: state.schemaVersion, policyVersion: POLICY_VERSION,
    buildId: policy.id, seed, config: state.config, mode, initialSnapshotDigest, spawnPlanDigest: digest(state.spawnPlan),
    outcome: state.outcome, endTick: state.tick, effectiveSeconds: state.tick / 30,
    wallHp: state.wallHp, wallMaxHp: state.wallMaxHp,
    wallHpDamage: Object.values(state.stats.wallDamageByEnemy).reduce((a, b) => a + b, 0),
    wallShieldAbsorbed: state.stats.shieldAbsorbed, choices: state.stats.choices, casts,
    evolvedRoutes, completedCoreRoutes: policy.cores.filter(r => evolvedRoutes.includes(r)),
    routeRanks: state.weapons.map(w => ({ id: `${w.id}-${w.branch ?? '-'}`, rank: w.rank })),
    commonRanks: state.commonRanks, choicesEarned: state.choicesEarned, choicesSpent: state.choicesSpent,
    rerollsRemaining: state.rerollsRemaining, characterDamage: state.stats.damageByCharacter,
    wallDamageByEnemy: state.stats.wallDamageByEnemy, controls: state.stats.controlTicks,
    commandLog: state.actions, finalDigest: replayDigest(state), finalSimulationSteps: steps,
  };
  return { state, report };
}

/** Replays only recorded accepted player commands, without policy observations. */
export function replayCommands(config: RunConfig, actions: RunState['actions']): RunState {
  const state = createRun(config);
  let cursor = 0;
  for (let iterations = 0; iterations < 16000 && state.phase !== 'ended'; iterations++) {
    while (cursor < actions.length && actions[cursor].tick === state.tick) {
      const action = actions[cursor++];
      if (!command(state, structuredClone(action.command) as Command)) throw new Error(`Replay rejected seq=${action.seq} tick=${action.tick}`);
    }
    if ((state.phase as RunState['phase']) === 'ended') break;
    if (state.pauseReasons.length) throw new Error(`Replay stalled at tick=${state.tick} action=${cursor}`);
    stepRun(state);
  }
  if (cursor !== actions.length || state.phase !== 'ended') throw new Error('Replay command stream incomplete');
  return state;
}
