import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default defineConfig(
  {
    ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', 'docs/'],
  },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    // 推理エンジンは UI・ブラウザ環境から独立させる（設計書 4.2 / 11章）。
    // Node 上のテスト・シミュレーションでそのまま動かすため、DOM や保存領域に触れない。
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['svelte', 'svelte/*'],
              message: '推理エンジンから Svelte を参照しないでください。',
            },
            {
              group: ['**/ui/**', '**/storage/**', '**/share/**', '*.svelte'],
              message: '推理エンジンから UI・保存・共有の層を参照しないでください。',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch'].map(
          (name) => ({ name, message: '推理エンジンはブラウザ API に依存しないでください。' }),
        ),
      ],
    },
  },
);
