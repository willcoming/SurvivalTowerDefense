import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { STAGES } from '../src/data/content';
import { CHALLENGES } from '../src/data/campaign';
import { difficultyPlan, naturalCommander, POLICIES, simulateDifficulty, type PolicyId } from './lib/difficulty-policy';
import type { ChallengeId, StageId } from '../src/sim/types';

const args = process.argv.slice(2), arg = (key: string, fallback: string) => args.find(a => a.startsWith(`--${key}=`))?.split('=')[1] ?? fallback;
const seeds = arg('seeds', '101,211,307').split(',').map(Number);
const stages = arg('stages', STAGES.map(s => s.id).join(',')).split(',') as StageId[];
const policies = arg('policies', 'balanced,chain,control').split(',') as PolicyId[];
const modes = arg('modes', 'easy,hard').split(',');
const output = arg('output', 'artifacts/difficulty/current');
mkdirSync(output, { recursive: true });
const sourceFiles = ['src/data/progression.ts','src/data/encounters.ts','src/data/encounters-v1.ts','src/data/high-pressure.ts','src/sim/difficulty-v1.ts','src/sim/engine.ts','src/sim/difficulty.ts','src/sim/spawn.ts','src/sim/operations.ts','src/sim/enemies.ts','scripts/lib/difficulty-policy.ts'];
const sourceDigest = createHash('sha256').update(sourceFiles.map(p => readFileSync(p)).join('\n')).digest('hex');
const rows: Array<{stage:StageId;mode:string;policy:PolicyId;seed:number;commanderLevel:number}&ReturnType<typeof simulateDifficulty>> = [];
for (const stage of stages) for (const mode of modes) {
  const challenge = CHALLENGES.includes(mode as Exclude<ChallengeId, null>) ? mode as ChallengeId : null;
  if (challenge && stage.startsWith('X')) continue;
  const difficulty = mode === 'easy' ? 'easy' : 'hard';
  for (const policy of policies) for (const seed of seeds) {
    const { squad, captain, plan } = difficultyPlan(policy, stage, challenge, args.includes('--weak'));
    const commander = naturalCommander(stage, difficulty, challenge);
    const result = simulateDifficulty({ stageId: stage, difficulty, challengeId: challenge, squadIds: squad, captainId: captain, seed, commanderNodes: commander.nodes }, plan, args.includes('--manual'), args.includes('--restore'), args.includes('--legacy'),Number(arg('version','2')) as 1|2);
    rows.push({ stage, mode, policy, seed, commanderLevel: commander.level, ...result });
  }
  const group = rows.filter(r => r.stage === stage && r.mode === mode);
  console.log(`${stage} ${mode}: ${group.filter(r => r.outcome === 'victory').length}/${group.length} wins; HP ${group.map(r => Math.round(r.hpRatio * 100)).join('/')}%; peak ${Math.max(...group.map(r => r.peakEnemies))}`);
  writeFileSync(`${output}/runs.json`, JSON.stringify(rows, null, 2));
}
const median=(xs:number[])=>{const sorted=[...xs].sort((a,b)=>a-b);return sorted.length?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2:null;};
const report = { createdAt: new Date().toISOString(), seeds, policies: Object.fromEntries(policies.map(p => [p, POLICIES[p]])), modes,
  method: 'Actual deterministic simulation; original starter forms; no combat/HP/XP overrides. Easy has zero permanent nodes. Hard uses preceding easy first-clear rewards and this stage easy clear; challenges also include this stage hard clear. Legal character-only point choices. Fixed automatic captain policy unless manual is explicitly selected. These scripted policies measure relative tuning, not human win rates.',
  manual: args.includes('--manual'), weak: args.includes('--weak'), legacy: args.includes('--legacy'), balanceVersion:Number(arg('version','2')), sourceDigest,
  runs: rows.length, wins: rows.filter(r => r.outcome === 'victory').length, peakEnemies: Math.max(...rows.map(r => r.peakEnemies)),
  byMode: Object.fromEntries(modes.map(mode => { const rs = rows.filter(r => r.mode === mode); return [mode, { runs: rs.length, wins: rs.filter(r => r.outcome === 'victory').length, winningMedianHpRatio: median(rs.filter(r=>r.outcome==='victory').map(r=>r.hpRatio)), bossEntryMedianHpRatio:median(rs.flatMap(r=>r.bossEntryHpRatio===null?[]:[r.bossEntryHpRatio])), meanHpRatio: rs.reduce((n,r) => n+r.hpRatio, 0) / Math.max(1,rs.length) }]; })), rows };
writeFileSync(`${output}/balance.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ runs: report.runs, wins: report.wins, byMode: report.byMode }));

// A reliable route must win every listed seed, not just one favorable draw.
const checks = stages.flatMap(stage => modes.filter(mode => !(stage.startsWith('X') && CHALLENGES.includes(mode as Exclude<ChallengeId, null>))).map(mode => {
  const threshold = arg('version','2')==='1'?1:mode==='easy'?.8:mode==='hard'?.6:.5;
  const reliable = policies.filter(policy => rows.filter(r => r.stage === stage && r.mode === mode && r.policy === policy && r.outcome === 'victory').length >= Math.ceil(seeds.length*threshold));
  const required = mode === 'easy' || mode === 'hard' ? 2 : 1;
  return { stage, mode, threshold, reliable, required, passed: reliable.length >= required };
}));
const integrity = rows.every(r => r.outcome !== null && r.points <= r.expectedPoints && (r.outcome !== 'victory' || r.points === r.expectedPoints) && (r.mode !== 'easy' || r.commanderNodes.length === 0) && (!args.includes('--restore') || r.restored));
writeFileSync(`${output}/acceptance.json`, JSON.stringify({ passed: integrity && checks.every(c => c.passed), integrity, checks }, null, 2));
if (args.includes('--gate') && (!integrity || checks.some(c => !c.passed))) process.exitCode = 1;
