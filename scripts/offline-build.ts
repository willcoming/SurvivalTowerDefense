import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin, ResolvedConfig } from 'vite';

export interface OfflineEntry {
  url: string;
  bytes: number;
  sha256: string;
  integrity: string;
}

export interface OfflineSnapshot {
  buildId: string;
  base: string;
  cachePrefix: string;
  entries: OfflineEntry[];
  bytesTotal: number;
}

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest();
const excluded = /^(?:sw\.js|deployment-receipt\.json|live-verification\.json|offline-(?:local|live)-verification\.json|\.nojekyll|test-results(?:\/|$)|playwright-report(?:\/|$)|validation(?:\/|$))$/;

async function listFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(resolve(directory, prefix), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const name = `${prefix}${entry.name}`;
    if (excluded.test(name) || entry.name.startsWith('.')) return [];
    if (entry.isDirectory()) return listFiles(directory, `${name}/`);
    return entry.isFile() ? [name] : [];
  }));
  return files.flat().sort();
}

/** Reusable by production checks that build isolated upgrade fixtures. */
export async function writeOfflineWorker(directory: string, base: string, templatePath = new URL('./offline-worker.js', import.meta.url)): Promise<OfflineSnapshot> {
  if (!base.startsWith('/') || !base.endsWith('/') || base.startsWith('//') || /[?#]/.test(base)) {
    throw new Error('Offline builds require an absolute, same-origin Vite base ending in /.');
  }
  const template = await readFile(templatePath, 'utf8');
  const files = await listFiles(directory);
  if (!files.includes('index.html')) throw new Error('Offline builds require a completed dist/index.html.');
  const entries = await Promise.all(files.map(async (file): Promise<OfflineEntry> => {
    const content = await readFile(resolve(directory, file));
    const digest = hash(content);
    return {
      url: base + file.split('/').map(encodeURIComponent).join('/'),
      bytes: content.byteLength,
      sha256: digest.toString('hex'),
      integrity: `sha256-${digest.toString('base64')}`,
    };
  }));
  const snapshot: OfflineSnapshot = {
    buildId: hash(JSON.stringify({ base, entries, worker: hash(template).toString('hex') })).toString('hex'),
    base,
    cachePrefix: `starfall-offline-${hash(base).toString('hex').slice(0, 16)}-`,
    entries,
    bytesTotal: entries.reduce((total, entry) => total + entry.bytes, 0),
  };
  if (!template.includes('__OFFLINE_SNAPSHOT__')) throw new Error('Offline worker template is missing its snapshot placeholder.');
  await writeFile(resolve(directory, 'sw.js'), template.replace('__OFFLINE_SNAPSHOT__', JSON.stringify(snapshot)));
  return snapshot;
}

/** Runs after Vite has written bundled and public files, so every shipped asset is included. */
export function offlineBuildPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'starfall-complete-offline-snapshot',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) { config = resolved; },
    closeBundle: {
      order: 'post',
      async handler() {
        if (config.build.write === false || config.build.ssr) return;
        const snapshot = await writeOfflineWorker(resolve(config.root, config.build.outDir), config.base, pathToFileURL(resolve(config.root, 'scripts/offline-worker.js')));
        config.logger.info(`Offline snapshot: ${snapshot.entries.length} files, ${(snapshot.bytesTotal / 1_000_000).toFixed(1)} MB (${snapshot.buildId.slice(0, 12)})`);
      },
    },
  };
}
