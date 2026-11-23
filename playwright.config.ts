import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_PATH = process.env.BASE_PATH ?? '/age_quiz/';

/**
 * E2E テストは本番と同じ「ビルド成果物＋公開パス（/age_quiz/）」で実行する。
 * GitHub Pages のサブパス配信で壊れないことの確認を兼ねる。
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'off',
  },
  projects: [
    {
      name: 'mobile-small',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
    { name: 'mobile-pixel7', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
