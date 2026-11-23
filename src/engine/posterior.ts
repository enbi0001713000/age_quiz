/**
 * 年代ポイント加算と確率更新（設計書 5.6：対数尤度ポイント方式）。
 *
 *   ポイント S(b) += τ · w · ln L(回答 | b)
 *   推定確率 π(b) ∝ π₀(b) · exp(S(b))
 *
 * ポイントの足し算とベイズ更新は数学的に同じもの。ポイントは推理レポートの根拠表示に使う。
 */
import { normalizeInPlace } from './math';

/** 事前確率と累積ポイントから推定確率を計算 */
export function posteriorFrom(prior: Float64Array, points: Float64Array): Float64Array {
  let max = -Infinity;
  for (const v of points) max = Math.max(max, v);
  const p = new Float64Array(prior.length);
  for (let i = 0; i < p.length; i++) p[i] = prior[i]! * Math.exp(points[i]! - max);
  return normalizeInPlace(p);
}

/** ある回答で各生年に加わるポイント τ·w·ln L(b) */
export function answerPoints(likelihood: Float64Array, exponent: number): Float64Array {
  return Float64Array.from(likelihood, (v) => exponent * Math.log(v));
}

/** 回答前の予測確率 P(回答) = Σ π(b)·L(回答|b)（「意外な回答」の判定に使う） */
export function predictiveProbability(posterior: Float64Array, likelihood: Float64Array): number {
  let s = 0;
  for (let i = 0; i < posterior.length; i++) s += posterior[i]! * likelihood[i]!;
  return s;
}

/** 回答 a を得た後の推定確率 π·L^e（正規化済み） */
export function updatedPosterior(
  posterior: Float64Array,
  likelihood: Float64Array,
  exponent: number,
): Float64Array {
  const p = new Float64Array(posterior.length);
  for (let i = 0; i < p.length; i++) p[i] = posterior[i]! * Math.pow(likelihood[i]!, exponent);
  return normalizeInPlace(p);
}

/** エントロピー（bit） */
export function entropyBits(p: Float64Array): number {
  let h = 0;
  for (const v of p) if (v > 0) h -= v * Math.log2(v);
  return h;
}

/** KL ダイバージェンス KL(p || q)（bit）。回答が推定をどれだけ動かしたかの指標 */
export function klDivergenceBits(p: Float64Array, q: Float64Array): number {
  let d = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i]! > 0 && q[i]! > 0) d += p[i]! * Math.log2(p[i]! / q[i]!);
  }
  return d;
}

/** 期待値（平均生年） */
export function meanOf(p: Float64Array, years: readonly number[]): number {
  let m = 0;
  for (let i = 0; i < p.length; i++) m += p[i]! * years[i]!;
  return m;
}
