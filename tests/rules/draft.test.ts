import { describe, expect, it } from 'vitest';
import { command, createRun, stepRun } from '../../src/sim/engine';
import { ROUTES } from '../../src/data/content';
import type { CharacterId, RunState } from '../../src/sim/types';

// These snapshots intentionally isolate rule edges. Formal balance uses only earned XP.
function fixture(squad: CharacterId[] = ['C01', 'C02', 'C03', 'C04', 'C05']): RunState {
  const state = createRun({ stageId: 'S01', squadIds: squad, captainId: squad[0], seed: 101 });
  state.choicesEarned = 18;
  stepRun(state);
  expect(state.draft).not.toBeNull();
  return state;
}

function choose(state: RunState, nodeId: string) {
  expect(state.draft!.cards.some(c => c.nodeId === nodeId), `missing card ${nodeId}`).toBe(true);
  expect(command(state, { type: 'choose', offerId: state.draft!.id, nodeId })).toBe(true);
  if (!state.draft && state.choicesSpent < state.choicesEarned && state.phase !== 'ended') stepRun(state);
}

function chooseFallback(state: RunState, excluded: string[] = []) {
  const card = state.draft!.cards.find(c => !excluded.includes(c.nodeId)) ?? state.draft!.cards[0];
  choose(state, card.nodeId);
}

describe('AC03/DRAFT01–04 · legal route progression', () => {
  for (const route of ROUTES) {
    it(`makes ${route.id} I → II → E reachable through legal offers`, () => {
      const state = fixture([route.ownerId]);
      for (let guard = 0; guard < 18 && state.weapons[0].rank < 3; guard++) {
        const desired = `${route.id}-${state.weapons[0].rank + 1}`;
        if ([1, 4, 7, 10, 13, 16].includes(state.draft!.choice)) {
          command(state, { type: 'focus', characterId: route.ownerId, branch: route.branch });
        }
        if (state.weapons[0].rank === 2) command(state, { type: 'evolution', nodeId: desired });
        if (state.draft!.cards.some(c => c.nodeId === desired)) choose(state, desired);
        else chooseFallback(state, state.draft!.cards.filter(c => c.nodeId.startsWith(route.ownerId)).map(c => c.nodeId));
      }
      expect(state.weapons[0].branch).toBe(route.branch);
      expect(state.weapons[0].rank).toBe(3);
      expect(state.evolvedCount).toBe(1);
      expect(state.choicesSpent).toBeLessThanOrEqual(5);
    });
  }

  it('removes the other branch and refuses a stale offer, repeat choice, absent node, and skipped prerequisites', () => {
    const state = fixture(['C01', 'C02']);
    command(state, { type: 'focus', characterId: 'C01', branch: 'A' });
    const oldOffer = state.draft!.id;
    choose(state, 'C01-A-1');
    expect(state.draft!.cards.every(c => !c.nodeId.startsWith('C01-B'))).toBe(true);
    const snapshot = JSON.stringify(state);
    expect(command(state, { type: 'choose', offerId: oldOffer, nodeId: 'C01-A-1' })).toBe(false);
    expect(command(state, { type: 'choose', offerId: state.draft!.id, nodeId: 'C01-A-3' })).toBe(false);
    expect(command(state, { type: 'choose', offerId: state.draft!.id, nodeId: 'C06-B-1' })).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('never offers an evolution after the standard or challenge limit is already occupied', () => {
    for (const challengeId of [null, 'two-evolutions'] as const) {
      const state = createRun({ stageId: 'S01', squadIds: ['C01', 'C02', 'C03', 'C04', 'C05'], captainId: 'C01', seed: 211, challengeId });
      const limit = challengeId ? 2 : 3;
      state.weapons.forEach((w, i) => { w.branch = 'A'; w.rank = i < limit ? 3 : 2; w.readyAt = i; });
      state.evolvedCount = limit;
      state.choicesEarned = 1;
      stepRun(state);
      expect(state.evolutionLimit).toBe(limit);
      expect(state.draft!.cards.every(c => !/^C\d\d-[AB]-3$/.test(c.nodeId))).toBe(true);
      expect(command(state, { type: 'evolution', nodeId: `C0${limit + 1}-A-3` })).toBe(false);
    }
  });
});

describe('AC04/DRAFT05–08 · focus and evolution lifecycle', () => {
  it('changes only the focus slot, without advancing random state or changing general slots', () => {
    const state = fixture();
    const before = state.draft!.cards.filter(c => c.kind === 'random');
    const rng = state.rng.draft;
    const tick = state.tick;
    expect(command(state, { type: 'focus', characterId: 'C02', branch: 'B' })).toBe(true);
    expect(state.draft!.cards.find(c => c.kind === 'focus')?.nodeId).toBe('C02-B-1');
    expect(state.draft!.cards.filter(c => c.kind === 'random')).toEqual(before);
    expect(state.rng.draft).toBe(rng);
    expect(state.tick).toBe(tick);
  });

  it('offers ready E on the immediately following choice and permits switching between ready evolutions', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C01', 'C02', 'C03'], captainId: 'C01', seed: 307 });
    state.weapons[0].branch = 'A'; state.weapons[0].rank = 2; state.weapons[0].readyAt = 1;
    state.weapons[1].branch = 'B'; state.weapons[1].rank = 2; state.weapons[1].readyAt = 2;
    state.choicesEarned = 1;
    stepRun(state);
    expect(state.draft!.cards.filter(c => c.kind === 'evolution').map(c => c.nodeId)).toEqual(['C01-A-3']);
    const randomBefore = state.draft!.cards.filter(c => c.kind === 'random');
    const rng = state.rng.draft;
    expect(command(state, { type: 'evolution', nodeId: 'C02-B-3' })).toBe(true);
    expect(state.draft!.cards.filter(c => c.kind === 'evolution').map(c => c.nodeId)).toEqual(['C02-B-3']);
    expect(state.draft!.cards.filter(c => c.kind === 'random')).toEqual(randomBefore);
    expect(state.rng.draft).toBe(rng);
    expect(state.evolvedCount).toBe(0);
    expect(new Set(state.draft!.cards.map(c => c.nodeId)).size).toBe(state.draft!.cards.length);
  });

  it('never duplicates a focus card that is also the guaranteed E', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C01', 'C02'], captainId: 'C01', seed: 401 });
    state.weapons[0].branch = 'A'; state.weapons[0].rank = 2; state.weapons[0].readyAt = 1;
    state.choicesEarned = 1;
    stepRun(state);
    command(state, { type: 'focus', characterId: 'C01' });
    expect(state.draft!.cards.filter(c => c.nodeId === 'C01-A-3')).toHaveLength(1);
    expect(new Set(state.draft!.cards.map(c => c.nodeId)).size).toBe(state.draft!.cards.length);
  });
});

describe('AC05/DRAFT09–16 · finite choices, rerolls and empty pool', () => {
  it('focus16 switches away from an exhausted captain when another teammate still has legal nodes', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C01', 'C02'], captainId: 'C01', seed: 709 });
    state.weapons[0].branch = 'A'; state.weapons[0].rank = 3; state.evolvedCount = 1;
    state.commonRanks = Object.fromEntries(['G01', 'G02', 'G03', 'G04', 'G05', 'G06'].map(id => [id, 2]));
    state.choicesEarned = 16; state.choicesSpent = 15;
    stepRun(state);
    expect(state.draft!.choice).toBe(16);
    expect(state.draft!.focusId).toBe('C02');
    expect(state.draft!.cards.some(c => c.nodeId.startsWith('C02-'))).toBe(true);
    expect(state.draft!.cards.some(c => c.nodeId === 'EMPTY')).toBe(false);
    expect(command(state, { type: 'focus', characterId: 'C01' })).toBe(false);
  });
  it('uses no more than three shared rerolls and preserves guaranteed cards', () => {
    const state = fixture();
    const guaranteed = state.draft!.cards.filter(c => c.kind !== 'random');
    for (let index = 0; index < 3; index++) {
      expect(command(state, { type: 'reroll', offerId: state.draft!.id })).toBe(true);
      expect(state.draft!.cards.filter(c => c.kind !== 'random')).toEqual(guaranteed);
    }
    expect(state.rerollsRemaining).toBe(0);
    const snapshot = JSON.stringify(state);
    expect(command(state, { type: 'reroll', offerId: state.draft!.id })).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('a fully exhausted solo pool can consume a pending choice without granting stats or getting stuck', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C01'], captainId: 'C01', seed: 503 });
    state.weapons[0].branch = 'A'; state.weapons[0].rank = 3; state.evolvedCount = 1;
    state.commonRanks = Object.fromEntries(['G01', 'G02', 'G03', 'G04', 'G05', 'G06'].map(id => [id, 2]));
    state.choicesEarned = 1;
    stepRun(state);
    expect(state.draft!.cards.map(c => c.nodeId)).toEqual(['EMPTY']);
    const before = { hp: state.wallHp, max: state.wallMaxHp, common: { ...state.commonRanks }, rank: state.weapons[0].rank };
    expect(command(state, { type: 'reroll', offerId: state.draft!.id })).toBe(false);
    expect(state.rerollsRemaining).toBe(3);
    choose(state, 'EMPTY');
    expect(state.choicesSpent).toBe(1);
    expect(state.pauseReasons).not.toContain('upgrade');
    expect({ hp: state.wallHp, max: state.wallMaxHp, common: state.commonRanks, rank: state.weapons[0].rank }).toEqual(before);
  });

  it('consumes a three-level queue one offer at a time and keeps upgrade pause until all are spent', () => {
    const state = createRun({ stageId: 'S01', squadIds: ['C01', 'C02'], captainId: 'C01', seed: 601 });
    state.choicesEarned = 3;
    stepRun(state);
    for (let spent = 1; spent <= 3; spent++) {
      expect(state.pauseReasons).toContain('upgrade');
      const tick = state.tick;
      chooseFallback(state);
      expect(state.choicesSpent).toBe(spent);
      expect(state.tick).toBe(tick);
    }
    expect(state.draft).toBeNull();
    expect(state.pauseReasons).not.toContain('upgrade');
  });
});
