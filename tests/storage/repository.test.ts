import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { command, createRun, restoreRun, snapshotRun, stepRun } from '../../src/sim/engine';
import { createEnemy, applyEffect, addShield } from '../../src/sim/combat';
import { GameRepository, SAVE_KEY, STORE_NAME, SaveConflictError, SaveValidationError, IncompatibleRunError, completeRun, createDefaultSave } from '../../src/storage/repository';

let counter = 0;
const repos: GameRepository[] = [];
function repo(name = `test-starfall-${++counter}`) { const result = new GameRepository(name); repos.push(result); return result; }
afterEach(() => { for (const repository of repos.splice(0)) repository.close(); });
function run() { return createRun({ stageId: 'S01', squadIds: ['C01', 'C02', 'C04', 'C05', 'C06'], captainId: 'C02', seed: 101 }); }
async function raw(name: string, value?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction(STORE_NAME, value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = value === undefined ? store.get(SAVE_KEY) : store.put(value, SAVE_KEY);
      let result: unknown;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

describe('AC09/SAVE01–06 · complete reproducible local snapshots', () => {
  it('starts without an account and round-trips preferences, combat, offer and RNG through IndexedDB', async () => {
    const repository = repo();
    const save = await repository.load();
    expect(save).toEqual(createDefaultSave());
    save.activeRun = run();
    save.activeRun.choicesEarned = 1;
    stepRun(save.activeRun);
    command(save.activeRun, { type: 'focus', characterId: 'C05', branch: 'B' });
    command(save.activeRun, { type: 'reroll', offerId: save.activeRun.draft!.id });
    await repository.save(save);
    const recovered = await repository.load();
    expect(recovered.activeRun).toEqual(save.activeRun);
    expect(recovered.preferences).toEqual(save.preferences);
    expect(recovered.revision).toBe(1);
  });

  it('preserves shields, independent status expiries, boss state and existing projectiles exactly', () => {
    const original = run();
    const enemy = createEnemy(original, 'B03', 195, 150);
    enemy.chargeKind = 'boss'; enemy.chargeUntil = 90; enemy.summonCount = 3; enemy.phaseTriggered = true;
    applyEffect(original, enemy, { id: 'burn:strong', kind: 'burn', source: 'C05', expires: 90, value: 10, armorIgnore: .5, nextTick: 15 });
    applyEffect(original, enemy, { id: 'burn:weak', kind: 'burn', source: 'C05', expires: 150, value: 4, armorIgnore: .5, nextTick: 15 });
    addShield(original, 'test', 150, 120);
    stepRun(original, 10);
    command(original, { type: 'pause', reason: 'user' });
    const recovered = restoreRun(snapshotRun(original));
    expect(recovered).toEqual(original);
    expect(command(recovered, { type: 'resume', reason: 'user' })).toBe(true);
    command(original, { type: 'resume', reason: 'user' });
    stepRun(original, 30); stepRun(recovered, 30);
    expect(recovered).toEqual(original);
  });

  it('freezes each queued save at call time, then commits in order', async () => {
    const repository = repo();
    const save = await repository.load();
    save.preferences.musicVolume = .1;
    const first = repository.save(save);
    save.preferences.musicVolume = .8;
    const second = repository.save(save);
    save.preferences.musicVolume = .3;
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect((await repository.load()).preferences.musicVolume).toBe(.8);
  });
});

describe('SAVE07–10 · terminal transactions and revisions', () => {
  it('commits terminal progress and removes ActiveRun together without duplicate rewards', async () => {
    const repository = repo();
    const save = await repository.load();
    const completed = run(); completed.outcome = 'victory'; completed.phase = 'ended'; completed.tick = 12000;
    save.activeRun = completed;
    completeRun(save, completed); completeRun(save, completed);
    await repository.save(save);
    const recovered = await repository.load();
    expect(recovered.profile.cleared).toEqual(['S01']);
    expect(recovered.profile.recentRuns).toHaveLength(1);
    expect(recovered.activeRun).toBeNull();
    expect(recovered.profile.best.S01.time).toBe(12000);
  });
  it('keeps only the latest ten summaries, with no permanent combat upgrades', () => {
    const save = createDefaultSave();
    for (let i = 0; i < 11; i++) {
      const completed = run(); completed.runId = `run-${i}`; completed.outcome = i === 0 ? 'victory' : 'wall'; completed.phase = 'ended';
      completeRun(save, completed);
    }
    expect(save.profile.recentRuns).toHaveLength(10);
    expect(save.profile.recentRuns[0].runId).toBe('run-10');
    expect(save.profile.recentRuns.some(r => r.runId === 'run-0')).toBe(false);
    expect(Object.keys(save.profile).sort()).toEqual(['best', 'challengeClears', 'cleared', 'recentRuns', 'schemaVersion', 'seenEnemies']);
    expect(run().wallHp).toBe(1000);
  });
  it('a stale second tab cannot overwrite the first tab revision', async () => {
    const name = `test-conflict-${++counter}`;
    const a = repo(name), b = repo(name);
    const first = await a.load(), stale = await b.load();
    first.preferences.musicVolume = .2;
    await a.save(first);
    stale.preferences.musicVolume = .9;
    await expect(b.save(stale)).rejects.toBeInstanceOf(SaveConflictError);
    expect((await a.load()).preferences.musicVolume).toBe(.2);
    const current = await b.load(); current.preferences.musicVolume = .6;
    await b.save(current);
    expect((await a.load()).preferences.musicVolume).toBe(.6);
  });
});

describe('SAVE12–15 · corrupt/version data preservation and explicit reset', () => {
  it('rejects unknown schema without deleting raw data', async () => {
    const name = `test-schema-${++counter}`;
    const bad = createDefaultSave() as unknown as Record<string, unknown>;
    (bad.profile as { schemaVersion: number }).schemaVersion = 999;
    await raw(name, bad);
    await expect(repo(name).load()).rejects.toBeInstanceOf(SaveValidationError);
    expect(await raw(name)).toEqual(bad);
  });
  it('preserves unlocked profile and raw incompatible run until the player decides to abandon', async () => {
    const name = `test-content-${++counter}`;
    const old = createDefaultSave(); old.profile.cleared = ['S01']; old.activeRun = run(); old.activeRun.contentVersion = 'old-unsupported';
    await raw(name, old);
    const repository = repo(name);
    await expect(repository.load()).rejects.toBeInstanceOf(IncompatibleRunError);
    expect(await raw(name)).toEqual(old);
    // Simulates the explicit "discard incompatible run, preserve profile" choice.
    old.activeRun = null;
    await repository.save(old);
    expect((await repository.load()).profile.cleared).toEqual(['S01']);
  });
  it('rejects corrupted snapshot numeric data and illegal route ranks', () => {
    const invalidNumber = run(); invalidNumber.wallHp = Number.NaN;
    expect(() => restoreRun(invalidNumber)).toThrow();
    const invalidRoute = run(); invalidRoute.weapons[0].rank = 99;
    expect(() => restoreRun(invalidRoute)).toThrow();
  });
  it('explicit reset creates a clean profile with all characters still available', async () => {
    const repository = repo(); const save = await repository.load();
    save.profile.cleared.push('S01'); save.preferences.tutorialSeen = true;
    await repository.save(save); await repository.reset();
    const clean = await repository.load();
    expect(clean.revision).toBeGreaterThan(1);
    expect({ ...clean, revision: 0 }).toEqual(createDefaultSave());
  });
  it('reset keeps a monotonic revision so a pre-reset stale tab cannot restore deleted progress', async () => {
    const name = `test-reset-conflict-${++counter}`;
    const a = repo(name), b = repo(name);
    await a.load(); const stale = await b.load();
    await a.reset();
    stale.profile.cleared = ['S01'];
    await expect(b.save(stale)).rejects.toBeInstanceOf(SaveConflictError);
    expect((await a.load()).profile.cleared).toEqual([]);
  });
});
