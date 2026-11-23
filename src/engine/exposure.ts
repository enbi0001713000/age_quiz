/**
 * 曝露ウィンドウモデル（設計書 5.4）。
 *
 * 「その人が対象年齢だった期間」と「対象が国内で出回っていた期間」の重なりから、
 * 生年ごとの経験確率・認知確率を計算する。
 *
 * - 活動度 A(t)：暦年 t に対象がどれだけ出回っていたか（0〜1）。出典付きの事実（facts）から作る。
 * - 年齢窓 W(age)：対象を経験しやすい年齢帯（境界はなめらか）。
 * - 曝露量 E(b) = Σ_t A(t)·W(t−b)
 * - 経験確率 P_exp(b) = f + (c − f)·(1 − e^(−E/κ))
 *
 * UI・ブラウザ API に依存しない純粋な関数のみ（ESLint で強制）。
 */
import type { Statistic, Subject } from '../data/schema';

/** モデル定数（設計書 5.14 の初期値。Phase 3 のシミュレーションで調整する） */
export const EXPOSURE_CONSTANTS = {
  /** 計算する暦年の範囲 */
  yearFrom: 1900,
  yearTo: 2035,
  /** 年齢窓・活動期間の境界のなめらかさ（年） */
  edgeSoftness: 0.7,
  /** 何年分重なれば十分経験したとみなすか（κ） */
  kappa: { trend: 1.5, event: 0.3, household: 1.5 },
  /** 認知の計算に使う年齢窓の広げ方（前に3年、後ろに25年） */
  awarenessWindowExtension: [-3, 25] as const,
  awarenessKappa: 1.0,
  /** 流行の中心期に入る直前（rampYears 年間）の活動度 */
  rampLevel: 0.5,
  rampYears: 2,
  /** それより前（登場はしたが一部の人しか使っていなかった時期）の活動度 */
  earlyLevel: 0.1,
  /** 流行の中心期を過ぎてから終了（end）までの活動度 */
  tailLevel: 0.4,
  /** よく経験した人の割合 h = base + scale × 飽和度 */
  heavyShare: { base: 0.25, scale: 0.5 },
  /** 世帯保有型で「家にはなかったがよそで見た」人の割合（推定） */
  householdAwareShare: 0.7,
} as const;

/** 'YYYY' / 'YYYY-MM' / 'YYYY-MM-DD' を小数の年に変換（月の初めとみなす） */
export function yearOf(date: string): number {
  const [y, m] = date.split('-');
  const year = Number(y);
  return m ? year + (Number(m) - 1) / 12 : year;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** [from, to] の範囲で 1、外側でなめらかに 0 に近づく関数 */
function softBox(x: number, from: number, to: number, softness: number): number {
  return sigmoid((x - from + 0.5) / softness) * sigmoid((to - x + 0.5) / softness);
}

/** 統計系列から暦年 year の値を線形補間で取り出す（範囲外：前は0、後ろは最後の値） */
export function seriesValueAt(series: Record<string, number>, year: number): number {
  const points = Object.entries(series)
    .map(([k, v]) => [yearOf(k), v] as const)
    .sort((a, b) => a[0] - b[0]);
  if (points.length === 0) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (year <= first[0]) return year < first[0] - 1 ? 0 : first[1];
  if (year >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (year <= x1) return y0 + ((y1 - y0) * (year - x0)) / (x1 - x0);
  }
  return last[1];
}

export type StatisticsIndex = ReadonlyMap<string, Statistic>;

function householdShare(subject: Subject, year: number, stats: StatisticsIndex): number {
  const ref = subject.facts.series;
  if (!ref) return 0;
  const stat = stats.get(ref.statId);
  const series = stat?.series[ref.key];
  if (!series) throw new Error(`統計系列が見つかりません: ${ref.statId}/${ref.key}`);
  const lastYear = Math.max(...Object.keys(series).map(yearOf));
  let value = seriesValueAt(series, year);
  if (year > lastYear && ref.after?.mode === 'linear_to_zero') {
    const span = ref.after.untilYear - lastYear;
    value *= span > 0 ? Math.max(0, 1 - (year - lastYear) / span) : 0;
  }
  return Math.min(1, Math.max(0, value / 100));
}

/**
 * 活動期間を事実から決める。
 * start〜coreFrom：流行が広がる途中 / coreFrom〜coreTo：中心期 / coreTo〜end：衰退期
 */
export function activePeriod(subject: Subject): {
  start: number;
  coreFrom: number;
  coreTo: number;
  end: number;
} {
  const f = subject.facts;
  const C = EXPOSURE_CONSTANTS;
  // 年単位で計算するため、月まで分かる日付は「その年の大半に当てはまるか」で丸める。
  // 下半期に始まった流行は翌年から、上半期に終わったものは前年までとみなす（出来事は丸めない）。
  const shift = subject.kind === 'trend';
  const fromYear = (d: string) => {
    const [y, m] = d.split('-').map(Number);
    return shift && m !== undefined && m > 6 ? y! + 1 : y!;
  };
  const toYear = (d: string) => {
    const [y, m] = d.split('-').map(Number);
    return shift && m !== undefined && m <= 6 ? y! - 1 : y!;
  };
  // 開始の事実がない（「〜まで」だけが分かる）場合は、計算範囲の最初から続いていたとみなす
  const start = f.start
    ? fromYear(f.start.date)
    : f.diffusion
      ? fromYear(f.diffusion.from)
      : f.peak
        ? fromYear(f.peak.from)
        : C.yearFrom;
  const coreFrom = f.peak
    ? fromYear(f.peak.from)
    : f.diffusion
      ? fromYear(f.diffusion.from)
      : start;
  const coreToRaw = f.peak
    ? toYear(f.peak.to)
    : f.diffusion
      ? toYear(f.diffusion.to)
      : f.end
        ? toYear(f.end.date)
        : subject.model.activeUntil?.value;
  if (coreToRaw === undefined) {
    throw new Error(
      `${subject.id}: 流行の終わり（peak/diffusion/end/activeUntil）が決められません`,
    );
  }
  const coreTo = Math.max(coreFrom, coreToRaw);
  const endCandidates = [coreTo];
  if (f.end) endCandidates.push(toYear(f.end.date));
  if (f.diffusion && f.peak) endCandidates.push(toYear(f.diffusion.to));
  return { start: Math.min(start, coreFrom), coreFrom, coreTo, end: Math.max(...endCandidates) };
}

/** 活動度 A(t)：暦年 t に対象が国内でどれだけ出回っていたか（0〜1） */
export function activity(subject: Subject, year: number, stats: StatisticsIndex): number {
  if (subject.kind === 'household') return householdShare(subject, year, stats);
  const { start, coreFrom, coreTo, end } = activePeriod(subject);
  const C = EXPOSURE_CONSTANTS;
  if (year < start) return 0;
  if (year < coreFrom) {
    return year >= coreFrom - C.rampYears ? C.rampLevel : C.earlyLevel;
  }
  if (year <= coreTo) return 1;
  if (year <= end) return C.tailLevel;
  return 0;
}

/** 曝露量 E(b)：年齢窓 [a0, a1] と活動期間の重なり（年単位） */
export function exposure(
  subject: Subject,
  birthYear: number,
  window: readonly [number, number],
  stats: StatisticsIndex,
): number {
  const C = EXPOSURE_CONSTANTS;
  let e = 0;
  for (let t = C.yearFrom; t <= C.yearTo; t++) {
    const a = activity(subject, t, stats);
    if (a === 0) continue;
    e += a * softBox(t - birthYear, window[0], window[1], C.edgeSoftness);
  }
  return e;
}

export interface ExperienceEstimate {
  /** 経験した確率 */
  pExperience: number;
  /** 知っている確率（常に pExperience 以上） */
  pAware: number;
  /** 経験者のうち「よく経験した」人の割合 */
  heavyShare: number;
}

/** 生年 birthYear の人がその対象を経験した／知っている確率 */
export function estimateExperience(
  subject: Subject,
  birthYear: number,
  stats: StatisticsIndex,
): ExperienceEstimate {
  const C = EXPOSURE_CONSTANTS;
  const m = subject.model;
  const [a0, a1] = m.ageWindow.value;

  if (subject.kind === 'household') {
    // 世帯普及率そのものを確率として使う（統計に基づく）
    let maxShare = 0;
    for (let age = a0; age <= a1; age++) {
      maxShare = Math.max(maxShare, activity(subject, birthYear + age, stats));
    }
    const atStart = activity(subject, birthYear + a0, stats);
    const rest = 1 - maxShare;
    return {
      pExperience: maxShare,
      pAware: Math.min(1, maxShare + rest * C.householdAwareShare),
      heavyShare: maxShare > 0 ? atStart / maxShare : 0,
    };
  }

  const kappa = C.kappa[subject.kind];
  const sat = 1 - Math.exp(-exposure(subject, birthYear, [a0, a1], stats) / kappa);
  const pExperience = m.floor + (m.ceiling.value - m.floor) * sat;

  const [d0, d1] = C.awarenessWindowExtension;
  const awareWindow = [Math.max(0, a0 + d0), a1 + d1] as const;
  const satAware =
    1 - Math.exp(-exposure(subject, birthYear, awareWindow, stats) / C.awarenessKappa);
  const aw = m.awareness;
  const pAware = Math.max(pExperience, aw.floor + (aw.ceiling - aw.floor) * satAware);

  return {
    pExperience,
    pAware: Math.min(1, pAware),
    heavyShare: C.heavyShare.base + C.heavyShare.scale * sat,
  };
}

/** 時代選択型の選択肢用：質問が指定する年齢窓での飽和度（0〜1） */
export function eraSaturation(
  subject: Subject,
  birthYear: number,
  window: readonly [number, number],
  stats: StatisticsIndex,
): number {
  const kappa = EXPOSURE_CONSTANTS.kappa[subject.kind];
  return 1 - Math.exp(-exposure(subject, birthYear, window, stats) / kappa);
}
