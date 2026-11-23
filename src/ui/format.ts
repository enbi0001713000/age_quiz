/**
 * 推定結果を画面用の文章にする（設計書 5.10 の表示ルール）。
 *
 * - 確信度「高」：推定生年を1年単位で表示し、推定範囲を添える
 * - 確信度「中」：生年の範囲
 * - 確信度「低」：年代（前半・後半）で表す広い範囲
 * 年齢は誕生日を聞いていないため、常に「〜歳」の範囲で表す。
 */
import type { ConfidenceLevel, Estimate } from '../engine';

/** 1985 → "1980年代後半"、1990 → "1990年代前半" */
export function halfDecadeLabel(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}年代${year % 10 < 5 ? '前半' : '後半'}`;
}

/** 生年の範囲を年代の言葉で表す（例：1985〜1999 → "1980年代後半〜1990年代後半"） */
export function eraRangeLabel(from: number, to: number): string {
  const a = halfDecadeLabel(from);
  const b = halfDecadeLabel(to);
  if (a === b) return a;
  // 同じ年代の前半〜後半は「◯◯年代」とまとめる
  if (Math.floor(from / 10) === Math.floor(to / 10) && from % 10 < 5 && to % 10 >= 5) {
    return `${Math.floor(from / 10) * 10}年代`;
  }
  return `${a}〜${b}`;
}

export interface BirthText {
  /** 大きく表示する見出し（例：「1992年生まれ」「1988〜1993年生まれ」） */
  headline: string;
  /** 補足（例：「推定範囲 1990〜1994年」） */
  detail: string | null;
}

export function birthText(e: Estimate): BirthText {
  const [from, to] = e.displayRange;
  if (e.confidence === 'high') {
    return {
      headline: `${e.birthYear}年生まれ`,
      detail: `推定範囲 ${e.birthRange[0]}〜${e.birthRange[1]}年`,
    };
  }
  if (e.confidence === 'medium') return { headline: `${from}〜${to}年生まれ`, detail: null };
  return { headline: `${eraRangeLabel(from, to)}生まれ`, detail: `${from}〜${to}年` };
}

/** 年齢の範囲（例：「33〜34歳」） */
export function ageText(e: Estimate): string {
  const [a, b] = e.ageRange;
  return a === b ? `${a}歳` : `${a}〜${b}歳`;
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/** 確信度のゲージ（5段階）の点灯数 */
export function confidenceMeter(level: ConfidenceLevel): number {
  return { high: 5, medium: 3, low: 1 }[level];
}
