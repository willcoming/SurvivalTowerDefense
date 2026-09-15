import { spawn } from 'node:child_process';

const root = 'artifacts/difficulty-v2/final';
const seeds = '101,211,307,419,521,613,727,839,947,1051';
const run = (script, args = []) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--import', 'tsx', script, ...args], { stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
});
const common = [`--seeds=${seeds}`, '--restore'];
const matrix = await Promise.allSettled([
  run('scripts/validate-difficulty.ts', [...common, '--version=2', '--modes=easy,hard,four,no-skill,two-evolutions', `--output=${root}/auto`]),
  run('scripts/validate-difficulty.ts', [...common, '--version=2', '--manual', '--modes=hard,four,two-evolutions', `--output=${root}/manual`]),
  run('scripts/validate-difficulty.ts', [...common, '--version=1', '--modes=easy,hard,four,no-skill,two-evolutions', `--output=${root}/baseline`]),
]);
for (const result of matrix) if (result.status === 'rejected') throw result.reason;
await run('scripts/validate-difficulty-rescue.ts', [`--root=${root}`]);
await run('scripts/summarize-high-pressure.ts', [`--root=${root}`, `--rescue=${root}/rescue.json`]);
