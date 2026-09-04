import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { CONTENT_VERSION } from '../src/data/content';
import { BUILD_POLICIES, FORMAL_SEEDS, POLICY_VERSION } from '../tests/simulation/policies';
import { digest, runPolicy, replayCommands, replayDigest, type RunReport } from '../tests/simulation/runner';

const quick = process.argv.includes('--quick');
const seeds: readonly number[] = quick ? [101] : FORMAL_SEEDS;
const dir = resolve('artifacts', 'validation', CONTENT_VERSION);
mkdirSync(dir, { recursive: true });
const runs: RunReport[] = [];
const errors: { buildId: string; seed: number; error: string }[] = [];
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(resolve(dir, entry.name)) : [resolve(dir, entry.name)]).sort();
}
const sourceDigest = digest([...sourceFiles(resolve('src')), ...sourceFiles(resolve('tests/simulation'))].map(path => [path.replace(`${process.cwd()}/`, ''), readFileSync(path, 'utf8')]));
let sourceRevision = 'uncommitted';
try { sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* A new local project may not yet have a commit. */ }
const metadata = { createdAt: new Date().toISOString(), contentVersion: CONTENT_VERSION, policyVersion: POLICY_VERSION, sourceRevision, sourceDigest, node: process.version, platform: process.platform, arch: process.arch, command: `npm run test:simulation${quick ? ' -- --quick' : ''}`, formal: !quick };
for (const policy of BUILD_POLICIES) {
  for (const seed of seeds) {
    try {
      const { report } = runPolicy(policy, seed);
      runs.push(report);
      console.log(`${policy.id} seed=${seed} ${report.outcome} ${report.effectiveSeconds.toFixed(2)}s HP=${report.wallHp.toFixed(1)} coreE=${report.completedCoreRoutes.length}/3 choices=${report.choicesSpent}`);
    } catch (error) {
      const entry = { buildId: policy.id, seed, error: error instanceof Error ? error.stack ?? error.message : String(error) };
      errors.push(entry); console.error(entry);
    }
  }
}
const summary = BUILD_POLICIES.map(policy => {
  const relevant = runs.filter(r => r.buildId === policy.id);
  return { buildId: policy.id, runs: relevant.length, wins: relevant.filter(r => r.outcome === 'victory').length, coreCompletions: relevant.filter(r => r.completedCoreRoutes.length === 3).length, passed: !quick && relevant.length === 10 && relevant.filter(r => r.outcome === 'victory' && r.completedCoreRoutes.length === 3).length >= 8 };
});
writeFileSync(resolve(dir, quick ? 'exploratory-runs.json' : 'balance-runs.json'), JSON.stringify({ ...metadata, summary, errors, runs }, null, 2));
console.log(JSON.stringify(summary));

if (!quick) {
  const comparisons = BUILD_POLICIES.map((policy, index) => {
    const seed = [101, 211, 307][index];
    try {
      const baseline = runPolicy(policy, seed, { mode: 'immediate' }).report;
      const adjusted = policy.id === 'T02' ? runPolicy(policy, seed, { mode: 'timed' }).report : runs.find(r => r.buildId === policy.id && r.seed === seed) ?? runPolicy(policy, seed).report;
      const improvement = baseline.wallHpDamage > 0 ? (baseline.wallHpDamage - adjusted.wallHpDamage) / baseline.wallHpDamage : null;
      const winImprovement = baseline.outcome !== 'victory' && adjusted.outcome === 'victory';
      return { comparisonId: `CMP0${index + 1}`, seed, buildId: policy.id, baseline, adjusted, identicalInitialState: baseline.initialSnapshotDigest === adjusted.initialSnapshotDigest, identicalSpawnPlan: baseline.spawnPlanDigest === adjusted.spawnPlanDigest, improvement, winImprovement, passed: baseline.initialSnapshotDigest === adjusted.initialSnapshotDigest && baseline.spawnPlanDigest === adjusted.spawnPlanDigest && (winImprovement || (improvement !== null && improvement >= .2)) };
    } catch (error) { return { comparisonId: `CMP0${index + 1}`, seed, buildId: policy.id, error: String(error), passed: false }; }
  });
  // CMP04 was declared in TEST_POLICIES §5.1 before this execution; original failed CMP02 stays above.
  const t02 = BUILD_POLICIES.find(p => p.id === 'T02')!;
  try {
    const baseline = runPolicy({ ...t02, cores: t02.cores.map(route => route === 'C03-B' ? 'C03-A' : route) }, 211, { mode: 'timed' }).report;
    const adjusted = runPolicy(t02, 211, { mode: 'timed' }).report;
    const improvement = baseline.wallHpDamage > 0 ? (baseline.wallHpDamage - adjusted.wallHpDamage) / baseline.wallHpDamage : null;
    const winImprovement = baseline.outcome !== 'victory' && adjusted.outcome === 'victory';
    comparisons.push({ comparisonId: 'CMP04', seed: 211, buildId: 'T02', baseline, adjusted, identicalInitialState: baseline.initialSnapshotDigest === adjusted.initialSnapshotDigest, identicalSpawnPlan: baseline.spawnPlanDigest === adjusted.spawnPlanDigest, improvement, winImprovement, passed: baseline.initialSnapshotDigest === adjusted.initialSnapshotDigest && baseline.spawnPlanDigest === adjusted.spawnPlanDigest && (winImprovement || (improvement !== null && improvement >= .2)) });
  } catch (error) { comparisons.push({ comparisonId: 'CMP04', seed: 211, buildId: 'T02', error: String(error), passed: false }); }
  try {
    const baseline = runPolicy(t02, 211, { mode: 'timed' }).report;
    const adjusted = runPolicy(t02, 211, { mode: 'immediate' }).report;
    const improvement = baseline.wallHpDamage > 0 ? (baseline.wallHpDamage - adjusted.wallHpDamage) / baseline.wallHpDamage : null;
    const winImprovement = baseline.outcome !== 'victory' && adjusted.outcome === 'victory';
    comparisons.push({ comparisonId: 'CMP05', seed: 211, buildId: 'T02', baseline, adjusted, identicalInitialState: baseline.initialSnapshotDigest === adjusted.initialSnapshotDigest, identicalSpawnPlan: baseline.spawnPlanDigest === adjusted.spawnPlanDigest, improvement, winImprovement, passed: baseline.initialSnapshotDigest === adjusted.initialSnapshotDigest && baseline.spawnPlanDigest === adjusted.spawnPlanDigest && (winImprovement || (improvement !== null && improvement >= .2)) });
  } catch (error) { comparisons.push({ comparisonId: 'CMP05', seed: 211, buildId: 'T02', error: String(error), passed: false }); }
  writeFileSync(resolve(dir, 'comparisons.json'), JSON.stringify({ ...metadata, comparisonPolicyVersion: 'comparison-v3', comparisons }, null, 2));
  const sample = runs.find(r => r.outcome === 'victory');
  let replayPassed = false;
  let replayError: string | null = null;
  if (sample) {
    try { replayPassed = replayDigest(replayCommands(sample.config, sample.commandLog)) === sample.finalDigest; }
    catch (error) { replayError = String(error); }
  }
  writeFileSync(resolve(dir, 'replay-results.json'), JSON.stringify({ ...metadata, type: 'pure simulation; browser replay is separate', sample: sample ? { buildId: sample.buildId, seed: sample.seed } : null, passed: replayPassed, error: replayError }, null, 2));
  console.log(`Formal balance: ${summary.every(s => s.passed) ? 'PASS' : 'FAIL'}; comparisons: ${comparisons.filter(c => c.passed).length} passed out of ${comparisons.length} (need 3); pure replay: ${replayPassed ? 'PASS' : 'FAIL'}`);
  if (errors.length || !summary.every(s => s.passed) || comparisons.filter(c => c.passed).length < 3 || !replayPassed) process.exitCode = 1;
}
