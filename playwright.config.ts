import { defineConfig } from '@playwright/test';
import { CONTENT_VERSION } from './src/data/content';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, expect: { timeout: 10000 }, workers: 1,
  outputDir: `artifacts/validation/${CONTENT_VERSION}/browser-results/test-output`,
  reporter: [['list'], ['json', { outputFile: `artifacts/validation/${CONTENT_VERSION}/browser-results/results.json` }]],
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'npm run dev -- --host 0.0.0.0 --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
});
