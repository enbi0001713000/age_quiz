/**
 * 答え合わせ（要件 8章）。入力された実年齢は計算に使うだけで、保存・送信しない。
 */
import type { Estimate } from '../../engine';

export interface AnswerCheck {
  /** 推定した年齢の範囲 */
  estimatedAges: [number, number];
  /** 実年齢が推定範囲の外にある場合の差（歳）。範囲内なら0 */
  difference: number;
  /** 範囲内／実際の方が年上／年下 */
  verdict: 'match' | 'older' | 'younger';
  message: string;
}

export const MIN_AGE = 5;
export const MAX_AGE = 120;

export function isValidAge(age: number): boolean {
  return Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE;
}

export function checkActualAge(estimate: Estimate, actualAge: number): AnswerCheck {
  const [lo, hi] = estimate.ageRange;
  if (actualAge >= lo && actualAge <= hi) {
    return {
      estimatedAges: [lo, hi],
      difference: 0,
      verdict: 'match',
      message: `的中！ 実年齢は推定範囲（${lo}〜${hi}歳）に入っていました。`,
    };
  }
  const older = actualAge > hi;
  const difference = older ? actualAge - hi : lo - actualAge;
  return {
    estimatedAges: [lo, hi],
    difference,
    verdict: older ? 'older' : 'younger',
    message: `推定範囲（${lo}〜${hi}歳）より${difference}歳${older ? '上' : '下'}でした。`,
  };
}
