/** 確率ベクトルを合計1に正規化する（その場で書き換えて返す） */
export function normalizeInPlace(p: Float64Array): Float64Array {
  let s = 0;
  for (const v of p) s += v;
  if (!(s > 0)) throw new Error('確率の合計が0です');
  for (let i = 0; i < p.length; i++) p[i]! /= s;
  return p;
}
