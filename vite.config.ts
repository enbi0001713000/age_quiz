import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

/**
 * 公開先のパス。GitHub Pages（プロジェクトページ）は https://<ユーザー>.github.io/age_quiz/ で配信されるため
 * 既定値は '/age_quiz/'。デプロイ時は GitHub Actions が BASE_PATH を渡す（独自ドメイン等への移行に備える）。
 */
const base = process.env.BASE_PATH ?? '/age_quiz/';

export default defineConfig({
  base,
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/simulation/**/*.test.ts'],
    testTimeout: 60_000,
    environment: 'node',
  },
});
