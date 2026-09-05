import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commit = git(['rev-parse', 'HEAD']);
const remote = git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s+/)[0];
assert.equal(remote, commit, 'Local HEAD and origin/main must match');
const base = new URL('https://willcoming.github.io/SurvivalTowerDefense/');
const dist = join(root, 'dist');
const version = JSON.parse(readFileSync(join(dist, 'version.json'), 'utf8'));
assert.equal(version.commit, commit, 'Build the current commit before checking Pages');
const localHtml = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = html => [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1]).sort();
const expectedAssets = assets(localHtml);
assert.ok(expectedAssets.length >= 2, 'Built HTML must reference JS and CSS');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const fetchFile = async relative => {
  const url = new URL(relative, base);
  url.searchParams.set('v', commit);
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${url.pathname}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};
const deadline = Date.now() + 300000;
let attempts = 0;
while (true) {
  try {
    const liveHtml = await fetchFile('index.html');
    const liveVersion = JSON.parse((await fetchFile('version.json')).toString());
    assert.equal(liveVersion.commit, commit, 'Pages still serves a different revision');
    assert.equal(liveVersion.contentVersion, version.contentVersion);
    assert.equal(hash(liveHtml), hash(Buffer.from(localHtml)), 'Live index.html differs from dist');
    assert.deepEqual(assets(liveHtml.toString()), expectedAssets, 'Live asset filenames differ from dist');
    const checked = [{ path: 'index.html', sha256: hash(liveHtml) }];
    for (const pathname of expectedAssets) {
      assert.ok(pathname.startsWith(base.pathname + 'assets/'), 'Assets must stay under the project path');
      const relative = pathname.slice(base.pathname.length);
      const local = readFileSync(join(dist, relative));
      const live = await fetchFile(relative);
      assert.equal(hash(live), hash(local), `${relative}: live bytes differ from dist`);
      checked.push({ path: relative, sha256: hash(live), bytes: live.length });
    }
    const result = { passed: true, checkedAt: new Date().toISOString(), commit, remoteMain: remote, contentVersion: version.contentVersion, url: `${base.href}?v=${commit}`, version: liveVersion, files: checked };
    writeFileSync(join(dist, 'live-verification.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    break;
  } catch (error) {
    if (Date.now() >= deadline) throw error;
    if (attempts++ % 3 === 0) console.log(`Waiting for Pages to publish ${commit.slice(0, 7)}: ${error.message.split('\n')[0]}`);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
