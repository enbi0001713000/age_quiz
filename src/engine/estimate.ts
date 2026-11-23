/**
 * 推定結果の算出（設計書 5.10〜5.11）。
 *
 * - 校正：推定確率に「文化的生年と実際の生年のずれ」（標準偏差 σ）を畳み込む
 * - 80%区間：校正後の確率の高い生年から足して80%に達する範囲
 * - 確信度：80%区間の幅で「高・中・低」を決める（モデル上の値。的中率ではない）
 * - 年齢：誕生日を聞かないため、生年 b の人は基準年に「Y−b−1 歳 または Y−b 歳」
 */
import type { EngineConfig } from './config';
import type { BirthGrid } from './compile';
import { normalizeInPlace } from './math';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Mode {
  /** 山の中心の生年 */
  center: number;
  /** 中心±3年の確率（校正後） */
  mass: number;
}

export interface Estimate {
  referenceYear: number;
  /** 推定生年（点推定） */
  birthYear: number;
  /** 80%区間（最初と最後の生年） */
  birthRange: [number, number];
  /** 80%区間の幅（年） */
  width: number;
  /** 区間が1つながりか（候補が離れた年代に分かれていると false） */
  contiguous: boolean;
  confidence: ConfidenceLevel;
  /** 点推定±2年に入る確率（モデル上の値。的中率ではない） */
  concentration: number;
  /** 表示用の生年範囲：高=点推定、中=80%区間、低=5年単位に丸めた区間 */
  displayRange: [number, number];
  /** 表示範囲に対応する基準年時点の年齢（誕生日の前後を含む） */
  ageRange: [number, number];
  /** 校正後の生年ごとの確率 */
  distribution: { birthYear: number; probability: number }[];
  /** 生まれた年代（10年単位）ごとの確率 */
  decadeProbabilities: { decade: number; probability: number }[];
  /** 候補が離れた複数の年代に分かれているか */
  multimodal: boolean;
  modes: Mode[];
}

/** 正規分布の重みで畳み込む（両端は範囲外へ出た分を捨てて正規化し直す） */
export function calibrate(posterior: Float64Array, sigma: number): Float64Array {
  if (sigma <= 0) return Float64Array.from(posterior);
  const radius = Math.ceil(sigma * 4);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, k) =>
    Math.exp(-0.5 * ((k - radius) / sigma) ** 2),
  );
  const out = new Float64Array(posterior.length);
  for (let i = 0; i < posterior.length; i++) {
    if (posterior[i] === 0) continue;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j >= 0 && j < out.length) out[j]! += posterior[i]! * kernel[k + radius]!;
    }
  }
  return normalizeInPlace(out);
}

/**
 * 確率の高い順に mass に達するまで選んだ index（最短の区間に相当）。
 * 最後に選んだ生年と同じ確率の生年は区別できないため、それらもすべて含める
 * （例：1点に集中した推定を校正すると±2年が同じ確率になり、片方だけを選ぶと区間が偏る）。
 */
export function highestDensitySet(p: Float64Array, mass: number): number[] {
  const order = Array.from(p.keys()).sort((a, b) => p[b]! - p[a]! || a - b);
  const chosen: number[] = [];
  let acc = 0;
  let k = 0;
  for (; k < order.length; k++) {
    const i = order[k]!;
    chosen.push(i);
    acc += p[i]!;
    if (acc >= mass - 1e-12) break;
  }
  const last = p[order[k]!]!;
  for (k++; k < order.length && Math.abs(p[order[k]!]! - last) <= 1e-12 * Math.max(1, last); k++) {
    chosen.push(order[k]!);
  }
  return chosen.sort((a, b) => a - b);
}

/** 中央値の index（lo〜hi の範囲内） */
function medianIndex(p: Float64Array, lo = 0, hi = p.length - 1): number {
  let total = 0;
  for (let i = lo; i <= hi; i++) total += p[i]!;
  let acc = 0;
  for (let i = lo; i <= hi; i++) {
    acc += p[i]!;
    if (acc >= total / 2) return i;
  }
  return hi;
}

/** 候補の山（モード）を探す。離れた年代に分かれているかの判定に使う */
export function findModes(
  p: Float64Array,
  years: readonly number[],
  config: EngineConfig['multimodal'],
): Mode[] {
  const n = p.length;
  const window = 2;
  const smooth = Float64Array.from(p, (_, i) => {
    let s = 0;
    for (let k = Math.max(0, i - window); k <= Math.min(n - 1, i + window); k++) s += p[k]!;
    return s;
  });
  const peaks: number[] = [];
  for (let i = 0; i < n; i++) {
    let isPeak = true;
    for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) {
      if (smooth[k]! > smooth[i]! || (smooth[k] === smooth[i] && k < i)) isPeak = false;
    }
    if (isPeak) peaks.push(i);
  }
  const massAround = (i: number) => {
    let s = 0;
    for (let k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) s += p[k]!;
    return s;
  };
  const candidates = peaks
    .map((i) => ({ i, mass: massAround(i) }))
    .filter((m) => m.mass >= config.minModeMass)
    .sort((a, b) => b.mass - a.mass);
  // 十分離れていて、間に谷がある山だけを残す
  const kept: { i: number; mass: number }[] = [];
  for (const c of candidates) {
    const separated = kept.every((k) => {
      if (Math.abs(k.i - c.i) < config.minSeparationYears) return false;
      const [a, b] = k.i < c.i ? [k.i, c.i] : [c.i, k.i];
      let valley = Infinity;
      for (let x = a; x <= b; x++) valley = Math.min(valley, smooth[x]!);
      return valley < 0.5 * Math.min(smooth[a]!, smooth[b]!);
    });
    if (separated) kept.push(c);
  }
  return kept.map((k) => ({ center: years[k.i]!, mass: k.mass }));
}

export function summarize(
  posterior: Float64Array,
  grid: BirthGrid,
  config: EngineConfig,
): Estimate {
  const { years, referenceYear } = grid;
  const p = calibrate(posterior, config.calibrationSigma);
  const set = highestDensitySet(p, config.intervalMass);
  const lo = set[0]!;
  const hi = set[set.length - 1]!;
  const width = years[hi]! - years[lo]! + 1;
  const contiguous = set.length === hi - lo + 1;
  const modes = findModes(p, years, config.multimodal);
  const multimodal = modes.length >= 2;

  // 点推定：中央値。候補が分かれている場合は、確率が最も大きい山の中での中央値
  let pointIdx = medianIndex(p);
  if (multimodal) {
    const top = years.indexOf(modes[0]!.center);
    const half = Math.floor(config.multimodal.minSeparationYears / 2);
    pointIdx = medianIndex(p, Math.max(0, top - half), Math.min(p.length - 1, top + half));
  }
  const birthYear = years[pointIdx]!;
  let concentration = 0;
  for (let i = Math.max(0, pointIdx - 2); i <= Math.min(p.length - 1, pointIdx + 2); i++) {
    concentration += p[i]!;
  }

  const confidence: ConfidenceLevel =
    width <= config.confidence.highMaxWidth && !multimodal
      ? 'high'
      : width <= config.confidence.mediumMaxWidth && !multimodal
        ? 'medium'
        : 'low';
  const range: [number, number] = [years[lo]!, years[hi]!];
  const displayRange: [number, number] =
    confidence === 'high'
      ? [birthYear, birthYear]
      : confidence === 'medium'
        ? range
        : [Math.floor(range[0] / 5) * 5, Math.floor(range[1] / 5) * 5 + 4];
  const ageRange: [number, number] = [
    referenceYear - displayRange[1] - 1,
    referenceYear - displayRange[0],
  ];

  const decades = new Map<number, number>();
  years.forEach((b, i) => {
    const d = Math.floor(b / 10) * 10;
    decades.set(d, (decades.get(d) ?? 0) + p[i]!);
  });

  return {
    referenceYear,
    birthYear,
    birthRange: range,
    width,
    contiguous,
    confidence,
    concentration,
    displayRange,
    ageRange,
    distribution: years.map((b, i) => ({ birthYear: b, probability: p[i]! })),
    decadeProbabilities: [...decades].map(([decade, probability]) => ({ decade, probability })),
    multimodal,
    modes,
  };
}
