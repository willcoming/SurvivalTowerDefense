import { mkdirSync, writeFileSync } from 'node:fs';
import { createRun, command, restoreRun, stepRun } from '../src/sim/engine';
import { deepLegalNodes, deepNodeCost } from '../src/sim/deep-tree';
import { deepTreesFor } from '../src/data/deep-trees';
import { STAGES, CONTENT_VERSION } from '../src/data/content';
import { PREVIOUS_TACTICAL_VERSION } from '../src/data/tactical-skills';
import { operationProfile } from '../src/data/progression';
import { MAIN_IDS, SIDE_IDS } from '../src/data/campaign';
import { migrateCommander } from '../src/storage/commander';
import { commanderProgress } from '../src/data/commander';
import { choose } from './tactical-policy';
import type { CharacterId, RunConfig, StageId } from '../src/sim/types';

const output = process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? 'artifacts/validation/assault-v4';
mkdirSync(output, { recursive: true });
const builds: { name: string; ids: CharacterId[]; branch: string; shield: boolean }[] = [
  { name: '米菈擊退', ids: ['C04','C01','C03','C05','C06'], branch: 'B', shield: false },
  { name: '雷娜磁荷', ids: ['C02','C01','C03','C05','C06'], branch: 'B', shield: false },
  { name: '芙蕾侵蝕與護盾', ids: ['C05','C01','C03','C04','C06'], branch: 'A', shield: true },
  { name: '米菈擊退與連鎖支援', ids: ['C04','C02','C03','C05','C06'], branch: 'B', shield: false },
];
function play(config: RunConfig, balanceVersion: 3|4, build: typeof builds[number]) {
  let s = createRun(config, balanceVersion === 3 ? PREVIOUS_TACTICAL_VERSION : CONTENT_VERSION, { balanceVersion });
  const primary = deepTreesFor(build.ids[0], s)[['A','B','C'].indexOf(build.branch)];
  const priority = [...(build.shield ? ['C06-C4/0'] : []), ...primary.nodes.map(node => node.id)];
  const limit = Math.round((operationProfile(s).bossAt + 300) * 30);
  let peak = 0, earlyDamage = 0, earlyShield = 0, firstHit: number | null = null, restored = false;
  while (!s.outcome && s.tick < limit) {
    if (s.bossIntro) { command(s, { type: 'finish-boss-intro' }); continue; }
    if (s.draft) {
      const legal = deepLegalNodes(s).filter(id => deepNodeCost(id, s) <= s.draft!.pointTarget! - s.choicesSpent);
      const id = priority.find(id => legal.includes(id)) ?? choose(s, 'balanced');
      if (!command(s, { type: 'buy-node', offerId: s.draft.id, nodeId: id })) throw new Error(`Illegal build ${id}`);
      continue;
    }
    if (!restored && s.choicesSpent >= 6) { s = restoreRun(s); restored = true; }
    const prior = s.tick; stepRun(s); if (s.tick === prior) throw new Error(`Stalled ${s.pauseReasons}`);
    peak = Math.max(peak, s.enemies.length);
    const damage = Object.values(s.stats.wallDamageByEnemy).reduce((n, value) => n + value, 0);
    if (damage && firstHit === null) firstHit = s.tick / 30;
    if (s.tick <= 60 * 30) { earlyDamage = damage; earlyShield = s.stats.shieldAbsorbed; }
    if (s.tick % 300 === 0) s.events = [];
  }
  return { outcome: s.outcome ?? 'timeout', hp: Math.round(s.wallHp), seconds: s.tick / 30,
    damage: Object.values(s.stats.wallDamageByEnemy).reduce((n, value) => n + value, 0),
    absorbed: s.stats.shieldAbsorbed, earlyDamage, earlyShield, firstHit, peak, restored, spent: s.choicesSpent, plan: s.treeNodes };
}
type Task = { stageId: StageId; mode: string; seed: number; split: string };
const tasks: Task[] = [];
for (const stageId of ['S01','S02','S03'] as const) for (let i = 0; i < 30; i++) tasks.push({
  stageId, mode: 'easy', seed: i < 20 ? 101+i*106 : (stageId==='S01'?110101:90101)+(i-20)*113, split: i < 20 ? 'calibration' : 'holdout',
});
for (const stage of STAGES) for (const mode of ['easy','hard',...(!stage.id.startsWith('X') ? ['four','no-skill','two-evolutions'] : [])]) {
  if (mode === 'easy' && ['S01','S02','S03'].includes(stage.id)) continue;
  tasks.push({ stageId: stage.id, mode, seed: 101, split: 'smoke' });
}
tasks.push({ stageId: 'S03', mode: 'hundred', seed: 101, split: 'smoke' });
const stageFilter=process.argv.find(a=>a.startsWith('--stage='))?.slice(8);
if(stageFilter)tasks.splice(0,tasks.length,...tasks.filter(task=>task.stageId===stageFilter));
const rows: object[] = [], groups = new Map<string, ReturnType<typeof play>[]>();
const start = performance.now();
for (const task of tasks) for (const build of builds) for (const version of [3,4] as const) {
  const preceding = task.mode === 'hundred' ? MAIN_IDS : task.stageId.startsWith('X')
    ? [...MAIN_IDS.slice(0,3), ...SIDE_IDS.slice(0,SIDE_IDS.indexOf(task.stageId))] : MAIN_IDS.slice(0,MAIN_IDS.indexOf(task.stageId));
  const earned = commanderProgress(migrateCommander(preceding)).earned;
  const config: RunConfig = { stageId: task.stageId, seed: task.seed, difficulty: ['easy','hundred'].includes(task.mode) ? 'easy' : 'hard',
    mode: task.mode === 'hundred' ? 'hundred' : undefined,
    challengeId: ['four','no-skill','two-evolutions'].includes(task.mode) ? task.mode as RunConfig['challengeId'] : null,
    squadIds: task.mode === 'four' ? build.ids.filter(id => id !== 'C01').slice(0,4) : build.ids,
    captainId: build.ids[0], commanderNodes: ['TEAM/0','TEAM/1','TEAM/2','TEAM/3','TEAM/8','TEAM/9','TEAM/10','TEAM/11','TEAM/4','TEAM/5','TEAM/6','TEAM/7'].slice(0,earned) };
  const result = play(config, version, build);
  rows.push({ ...task, build: build.name, version, config, ...result });
  const key = `${task.stageId}/${task.mode}/${task.split}/${build.name}/v${version}`;
  groups.set(key, [...(groups.get(key) ?? []), result]);
  if (rows.length % 30 === 0) console.log(`${rows.length} runs / ${Math.round((performance.now()-start)/1000)}s`);
}
const summary = [...groups].map(([key, results]) => ({ key, runs: results.length,
  wins: results.filter(r => r.outcome === 'victory').length, timeouts: results.filter(r => r.outcome === 'timeout').length,
  meanHp: results.reduce((n,r) => n+r.hp, 0)/results.length, meanDamage: results.reduce((n,r) => n+r.damage, 0)/results.length,
  meanFirstMinuteDamage: results.reduce((n,r) => n+r.earlyDamage, 0)/results.length,
  maxEnemies: Math.max(...results.map(r => r.peak)) }));
writeFileSync(`${output}/runs.json`, JSON.stringify(rows));
writeFileSync(`${output}/summary.json`, JSON.stringify({ contentVersion: CONTENT_VERSION, runs: rows.length, checkedAt: new Date().toISOString(),
  authoredPressure: 'Wave HP/shield x1.25; wave attack damage x1.8; wave/group intervals x0.75. HP × damage / interval = 3x authored wave pressure, not a win-rate multiplier. S01 boss damage x2; other boss stats and entrance escort stats retain v3 values.',
  limitations: ['S01–S03 easy use 20 calibration plus 10 independent holdout seeds. Other modes use one paired smoke seed and do not establish all-mode solvability.', 'Builds use starter characters and original forms; fixed build policies are not optimal-play proofs.'], groups: summary }, null, 2));
console.log(JSON.stringify({ runs: rows.length, seconds: (performance.now()-start)/1000, output }));
