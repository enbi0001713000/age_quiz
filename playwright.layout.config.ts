import { defineConfig } from '@playwright/test';

/** 全質問のレイアウト確認（開発サーバーで tests/layout のプレビューを使う）：npm run test:layout */
const PORT = 5175;
export default defineConfig({
  testDir: 'tests/layout',
  retries: 0,
  reporter: process.env.CI ? [['list']] : 'list',
  timeout: 300_000,
  use: { baseURL: `http://localhost:${PORT}/age_quiz/`, browserName: 'chromium', trace: 'off' },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/age_quiz/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
