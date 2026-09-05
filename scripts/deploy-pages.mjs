import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const origin = 'https://github.com/willcoming/SurvivalTowerDefense.git';
const siteUrl = 'https://willcoming.github.io/SurvivalTowerDefense/';
const read = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const run = (program, args, cwd = root, env = process.env) => {
  const result = spawnSync(program, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${program} ${args.join(' ')} failed`, { cause: result.error });
};
const clean = () => !read(['status', '--porcelain', '--untracked-files=normal']);
if (read(['remote', 'get-url', 'origin']) !== origin) throw new Error('origin must point to willcoming/SurvivalTowerDefense.');
if (!clean()) throw new Error('Commit the intended source changes before deploying.');
const sourceCommit = read(['rev-parse', 'HEAD']);
const stage = mkdtempSync(join(tmpdir(), 'starfall-publish-'));
const publish = join(stage, 'website');
const env = { ...process.env, GITHUB_SHA: sourceCommit, PAGES_BASE_PATH: '/SurvivalTowerDefense/', VALIDATION_OUTPUT_DIR: join(stage, 'validation') };

try {
  run('npm', ['run', 'test:rules']);
  run('npm', ['run', 'build'], root, env);
  run('npm', ['run', 'test:assets'], root, env);
  const version = JSON.parse(readFileSync(join(root, 'dist', 'version.json'), 'utf8'));
  if (version.commit !== sourceCommit || read(['rev-parse', 'HEAD']) !== sourceCommit || !clean()) {
    throw new Error('Source changed during validation; deployment stopped.');
  }
  run('git', ['push', '--set-upstream', 'origin', 'HEAD:refs/heads/main']);
  const remoteMain = read(['ls-remote', 'origin', 'refs/heads/main']).split(/\s+/)[0];
  if (remoteMain !== sourceCommit) throw new Error('Remote main differs from the validated source.');

  mkdirSync(publish);
  run('git', ['init', '--quiet', '--initial-branch=gh-pages'], publish);
  run('git', ['remote', 'add', 'origin', origin], publish);
  run('git', ['config', 'user.name', read(['show', '-s', '--format=%an', sourceCommit])], publish);
  run('git', ['config', 'user.email', read(['show', '-s', '--format=%ae', sourceCommit])], publish);
  const previous = read(['ls-remote', 'origin', 'refs/heads/gh-pages']);
  if (previous) {
    run('git', ['fetch', '--depth=1', 'origin', 'refs/heads/gh-pages'], publish);
    run('git', ['checkout', '-B', 'gh-pages', 'FETCH_HEAD'], publish);
    run('git', ['rm', '-r', '--quiet', '--ignore-unmatch', '.'], publish);
  }
  for (const entry of readdirSync(join(root, 'dist'))) cpSync(join(root, 'dist', entry), join(publish, entry), { recursive: true });
  writeFileSync(join(publish, '.nojekyll'), '');
  run('git', ['add', '--all'], publish);
  const unchanged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: publish }).status === 0;
  if (!unchanged) run('git', ['commit', '--quiet', '-m', `Deploy ${sourceCommit}`], publish);
  run('git', ['push', 'origin', 'HEAD:refs/heads/gh-pages'], publish);
  const pagesCommit = read(['rev-parse', 'HEAD'], publish);
  const remotePages = read(['ls-remote', 'origin', 'refs/heads/gh-pages'], publish).split(/\s+/)[0];
  if (remotePages !== pagesCommit) throw new Error('Remote Pages branch differs from the built website.');
  writeFileSync(join(root, 'dist', 'deployment-receipt.json'), JSON.stringify({ sourceCommit, remoteMain, pagesCommit, remotePages, siteUrl, publishedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Source and website pushed. Verifying ${siteUrl}?v=${sourceCommit}`);
  run('npm', ['run', 'verify:pages']);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
