import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };
import { slimData } from './src/data/slim.ts';

/**
 * 公開先のパス。GitHub Pages（プロジェクトページ）は https://<ユーザー>.github.io/age_quiz/ で配信されるため
 * 既定値は '/age_quiz/'。デプロイ時は GitHub Actions が BASE_PATH を渡す（独自ドメイン等への移行に備える）。
 */
const base = process.env.BASE_PATH ?? '/age_quiz/';

const APP_NAME = '年齢推理ゲーム（仮称）';
const THEME = '#060b1f';

/** 本番ビルドで、質問・対象データから実行時に使わない説明用の項目を除く（src/data/slim.ts） */
function slimDataPlugin(): Plugin {
  return {
    name: 'slim-data',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/data\/(subjects|questions)\/[^/]+\.json$/.test(id.split('?')[0]!)) return null;
      return { code: JSON.stringify(slimData(JSON.parse(code))), map: null };
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    svelte(),
    slimDataPlugin(),
    /**
     * オフライン対応（設計書 9章 O1）：ビルド時に全ファイルの一覧とハッシュを作り、Service Worker が一括キャッシュする。
     * 新しい版は裏で取得して待機させ、タイトル画面で利用者が「更新」を押したときだけ切り替える（プレイ中は切り替えない）。
     */
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: APP_NAME,
        short_name: '年齢推理',
        description: 'あなたの記憶から、AIが年齢を推理する。質問に答えるだけの年代推理ゲーム。',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: THEME,
        theme_color: THEME,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // 外部への通信はしないため、実行時キャッシュは設定しない（同一オリジンの配信ファイルのみ）
      },
    }),
  ],
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
