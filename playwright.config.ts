import { defineConfig } from '@playwright/test';
import { CONTENT_VERSION } from './src/data/content';
const port = process.env.E2E_PORT ?? '5173';
const output = process.env.VALIDATION_OUTPUT_DIR ?? `artifacts/validation/${CONTENT_VERSION}`;
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, expect: { timeout: 10000 }, workers: 1,
  outputDir: `${output}/browser-results/test-output`,
  reporter: [['list'], ['json', { outputFile: `${output}/browser-results/results.json` }]],
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: `npm run dev -- --host 0.0.0.0 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true, timeout: 30000 },
});
