/**
 * アプリの基本情報。
 * タイトルは仮称（正式名は Phase 4 までに決定）。
 * version はプレイ履歴に保存し、ロジック更新前後の結果比較時の注意表示に使う（設計書 8章）。
 */
export const APP_INFO = {
  name: '年齢推理ゲーム（仮称）',
  concept: 'あなたの記憶から、AIが年齢を推理する。',
  version: __APP_VERSION__,
} as const;
