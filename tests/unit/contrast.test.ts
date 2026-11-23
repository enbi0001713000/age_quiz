/**
 * 配色の読みやすさ（WCAG 2.1 AA：本文はコントラスト比 4.5:1 以上）の確認。
 * src/styles/tokens.css の色を読み取り、画面で使っている文字色と背景色の組み合わせを検査する。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8');
const color = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`色 --${name} が見つかりません`);
  return m[1]!;
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [文字色, 背景色, 用途] */
const PAIRS: [string, string, string][] = [
  ['text-100', 'navy-950', '本文'],
  ['text-100', 'navy-800', 'カード上の本文・選択肢'],
  ['text-300', 'navy-950', '補足文'],
  ['text-300', 'navy-800', 'カード上の補足文'],
  ['text-300', 'navy-700', 'ジャンルのタグ'],
  ['text-400', 'navy-950', '注記・キーボードの案内'],
  ['text-400', 'navy-800', 'カード上の注記'],
  ['cyan-400', 'navy-950', '強調・ステータス'],
  ['cyan-400', 'navy-800', 'カード上の強調・選択肢キー'],
  ['purple-400', 'navy-700', '難易度のタグ'],
  ['cyan-300', 'navy-800', '世代名・履歴の生年・共有の状態表示'],
  ['text-300', 'navy-900', '共有文章のプレビュー'],
  ['text-100', 'navy-700', '答え合わせの結果'],
  ['text-400', 'navy-700', '年代グラフの軸'],
];

describe('配色のコントラスト比（WCAG AA 4.5:1 以上）', () => {
  it.each(PAIRS)('%s on %s（%s）', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['blue-600', 'ボタンのグラデーション左端'],
    ['purple-600', 'ボタンのグラデーション右端'],
  ])('白い文字 on %s（%s）', (bg) => {
    expect(contrast('#ffffff', color(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
