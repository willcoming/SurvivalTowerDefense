import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { CONTENT_VERSION } from './src/data/content';

const buildCommit = process.env.GITHUB_SHA ?? (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'unknown'; }
})();

export default defineConfig({
  base: process.env.PAGES_BASE_PATH ?? '/',
  plugins: [{
    name: 'build-revision',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'build-revision', content: buildCommit }, injectTo: 'head' }],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ commit: buildCommit, contentVersion: CONTENT_VERSION }, null, 2) + '\n' });
    },
  }],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { target: ['es2022'], chunkSizeWarningLimit: 1600 },
});
