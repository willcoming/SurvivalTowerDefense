import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { DEEP_NODE_MAP } from '../src/data/deep-trees';
import { difficultyPlan, naturalCommander, simulateDifficulty, type PolicyId } from './lib/difficulty-policy';
import type { ChallengeId, StageId } from '../src/sim/types';

const args = process.argv.slice(2);
const arg = (key: string, fallback: string) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = arg('root', 'artifacts/difficulty-v2/final');
type Row = ReturnType<typeof simulateDifficulty> & { stage: StageId; mode: string; policy: string; seed: number };
const auto: Row[] = JSON.parse(readFileSync(`${root}/auto/runs.json`, 'utf8'));
const manual: Row[] = JSON.parse(readFileSync(`${root}/manual/runs.json`, 'utf8'));
const explicit = arg('cases', '');
const cases = explicit ? explicit.split(',') : [...new Set(auto.map(r => `${r.stage}/${r.mode}/${r.seed}`))].filter(key => {
  const [stage, mode, seed] = key.split('/');
  return ![...auto, ...manual].some(r => r.stage === stage && r.mode === mode && r.seed === Number(seed) && r.outcome === 'victory');
});
const sourceFiles = ['src/data/progression.ts','src/data/encounters.ts','src/data/encounters-v1.ts','src/data/high-pressure.ts','src/sim/difficulty-v1.ts','src/sim/engine.ts','src/sim/difficulty.ts','src/sim/spawn.ts','src/sim/operations.ts','src/sim/enemies.ts','scripts/lib/difficulty-policy.ts'];
const sourceDigest = createHash('sha256').update(sourceFiles.map(p => readFileSync(p)).join('\n')).digest('hex');
const route = (id: string): string[] => [...new Set([...DEEP_NODE_MAP[id].parents.slice(0, 1).flatMap(route), id])];
// Fixed, seed-independent alternatives: change the order of crowd control,
// piercing, splash and shield counters. Every purchase uses the normal engine.
const recipes = [
  ['C04-A/11', 'C05-A/8', 'C03-A/7'],
  ['C04-B/7', 'C05-B/7', 'C03-A/7'],
  ['C03-A/7', 'C05-B/7', 'C02-A/9'],
  ['C05-B/7', 'C03-A/7', 'C02-A/9'],
  ['C01-B/8', 'C03-A/7', 'C02-A/9'],
  ['C02-A/9', 'C03-A/7', 'C01-B/8'],
  ['C05-A/8', 'C04-A/11', 'C03-B/8'],
  ['C03-B/8', 'C05-B/7', 'C02-A/9'],
  ['C06-C/8', 'C03-A/7', 'C05-B/7'],
];
const rows: Array<Row & { sourceDigest: string; terminals: string[]; manual: boolean; squad: string[]; captain: string }> = [];
for (const key of cases) {
  const [stageText, mode, seedText] = key.split('/'), stage = stageText as StageId, seed = Number(seedText);
  const difficulty = mode === 'easy' ? 'easy' : 'hard';
  const challenge = mode === 'easy' || mode === 'hard' ? null : mode as ChallengeId;
  const commander = naturalCommander(stage, difficulty, challenge);
  let solved = false;
  search: for (const policy of ['control', 'chain', 'balanced'] as PolicyId[]) for (const recipe of recipes) {
    const base = difficultyPlan(policy, stage, challenge);
    const terminals = recipe.filter(id => base.squad.includes(DEEP_NODE_MAP[id].ownerId as typeof base.squad[number])).slice(0, challenge === 'two-evolutions' ? 2 : 3);
    const plan = [...new Set([...terminals.flatMap(route), ...base.plan])];
    for (const manual of mode === 'easy' || mode === 'no-skill' ? [false] : [false, true]) {
      const result = simulateDifficulty({ stageId: stage, difficulty, challengeId: challenge, squadIds: base.squad, captainId: base.captain, seed, commanderNodes: commander.nodes }, plan, manual, true);
      const row = { stage, mode, seed, policy: `counter-${policy}`, sourceDigest, terminals, manual, squad: base.squad, captain: base.captain, ...result };
      rows.push(row);
      if (result.outcome === 'victory') { console.log(JSON.stringify({ key, policy, terminals, manual, hp: result.hpRatio })); solved = true; break search; }
    }
  }
  if (!solved) { console.error(`No counter-build found: ${key}`); process.exitCode = 1; }
  writeFileSync(`${root}/rescue.json`, JSON.stringify(rows, null, 2));
}
if (!cases.length) writeFileSync(`${root}/rescue.json`, '[]\n');
