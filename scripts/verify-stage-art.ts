import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { CHARACTERS, CONTENT_VERSION } from '../src/data/content';
import { FORMS, POOL, formPortrait } from '../src/data/forms';

const dir = process.env.VALIDATION_OUTPUT_DIR ?? `artifacts/validation/${CONTENT_VERSION}/theme-poses`;
const read = (name: string) => JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
const rules = read('rules.json'), browser = read('browser-results/results.json'), budget = read('asset-budget.json');
const cases: { title: string; project: string; status: string }[] = [];
function visit(suite: any) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) cases.push({ title: spec.title, project: test.projectName, status: test.results.at(-1)?.status ?? 'missing' });
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of browser.suites) visit(suite);
assert.equal(rules.success, true); assert.equal(rules.numPassedTests, 283); assert.equal(rules.numFailedTests, 0);
assert.equal(browser.errors?.length ?? 0, 0); assert.equal(cases.length, 12); assert.ok(cases.every(row => row.status === 'passed'));
assert.equal(budget.passed, true); assert.equal(budget.contentVersion, CONTENT_VERSION);
assert.equal(CHARACTERS.length, 8); assert.equal(FORMS.length, 16); assert.equal(POOL.length, 10);
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as { assetId: string; path: string; width: number; height: number; sha256: string }[];
const previousArt = JSON.parse(readFileSync(`artifacts/validation/${CONTENT_VERSION}/stage-duo/summary.json`, 'utf8')) as { assets: { id: string; path: string; sha256: string }[] };
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const assets = [];
for (const owner of ['C07', 'C08'] as const) for (const theme of ['original', 'summer'] as const) {
  const id = `${owner}-${theme}` as const, path = formPortrait(id), entry = manifest.find(a => a.assetId === `${id}-form`)!;
  assert.equal(path, `/assets/forms/${id}-${theme === 'summer' ? 'pose-v4' : 'stage-v3'}.webp`); assert.equal(entry.path, path);
  assert.deepEqual([entry.width, entry.height], [512, 768]);
  const publicHash = hash(readFileSync(`public${path}`)), builtHash = hash(readFileSync(`dist${path}`));
  const response = await fetch(`http://127.0.0.1:5173${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type') ?? '', /image\/webp/);
  const servedHash = hash(new Uint8Array(await response.arrayBuffer()));
  assert.equal(publicHash, entry.sha256); assert.equal(builtHash, publicHash); assert.equal(servedHash, publicHash);
  const previous = previousArt.assets.find(a => a.id === id)!;
  assert.equal(hash(readFileSync(`public${previous.path}`)), previous.sha256, 'Historical artwork must stay unchanged');
  if (theme === 'original') assert.equal(publicHash, previous.sha256, 'Original pose must stay unchanged');
  else { assert.notEqual(path, previous.path); assert.notEqual(publicHash, previous.sha256, 'Summer must use newly drawn artwork'); }
  assets.push({ id, path, sha256: publicHash, width: entry.width, height: entry.height, builtAndServedMatch: true, previousPath: previous.path, previousFilePreserved: true, summerArtworkReplaced: theme === 'summer' });
}
const walk = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : [`${path}/${e.name}`]).sort();
const result = {
  passed: true, contentVersion: CONTENT_VERSION, measuredAt: new Date().toISOString(), scope: 'C07/C08 distinct summer poses; preserved original stage portraits; recruitment, codex and battle form routing',
  sourceSha256: createHash('sha256').update(walk('src').map(p => p + '\n' + readFileSync(p, 'utf8')).join('\n')).digest('hex'),
  ruleTestsPassed: rules.numPassedTests, browserTestsPassed: cases.length, cases, assets, assetBudgetPassed: budget.passed,
  inventory: { characters: CHARACTERS.length, forms: FORMS.length, poolEntries: POOL.length },
  note: 'Targeted pose-revision verification. Previous full campaign/balance/performance reports were not rerun for this visual-only change. Style, identity, pose distinction and anatomy were visually inspected by the assistant, not asserted by a pixel test. Native selectOption is used on mobile headless WebKit while keyboard button navigation is retained. Earlier stage-duo reports and old art files remain as history; this report does not overwrite them. Desktop browser emulation is not physical phone testing. No public deployment.',
};
writeFileSync(`${dir}/summary.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
