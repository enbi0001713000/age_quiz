/**
 * 推理レポート用の根拠の抽出（設計書 5.12）。表示は Phase 5 で行う。
 *
 * - 推理に影響した回答：その回答で推定がどれだけ動いたか（KLダイバージェンス）の大きい順
 * - その回答が支持する生年の範囲：回答の尤度が最大値の半分以上になる生年
 * - 影響したジャンル：ジャンルごとの影響の合計
 * - 年代ポイント：全回答のポイントを生まれた年代ごとに平均し、0〜100に換算した相対値
 * - 不確実性：「覚えていない」の数、意外な回答、候補の分かれ方、80%区間の幅
 */
import type { Genre } from '../data/schema';
import type { Estimate } from './estimate';
import type { InferenceSession } from './session';

export interface KeyAnswer {
  questionId: string;
  questionText: string;
  optionId: string;
  optionLabel: string;
  /** 回答が示す年代的特徴（質問データの説明文） */
  insight: string | undefined;
  /** 推定がどれだけ動いたか（bit） */
  influence: number;
  /** この回答が支持する生年の範囲 */
  supportsBirthYears: [number, number] | null;
}

export interface ReasoningReport {
  keyAnswers: KeyAnswer[];
  genreInfluence: { genre: Genre; influence: number }[];
  /** 生まれた年代ごとの年代ポイント（0〜100、相対値） */
  decadePoints: { decade: number; points: number }[];
  uncertainty: {
    dontRemember: number;
    notApplicable: number;
    surprises: number;
    surprisingQuestionIds: string[];
    multimodal: boolean;
    intervalWidth: number;
  };
}

/** 値が最大値の半分以上になる範囲（年代差が小さい場合は null） */
function halfMaxRange(values: Float64Array, years: readonly number[]): [number, number] | null {
  let max = -Infinity;
  let min = Infinity;
  for (const v of values) {
    max = Math.max(max, v);
    min = Math.min(min, v);
  }
  if (max - min < 0.05) return null;
  const threshold = min + (max - min) / 2;
  let lo = -1;
  let hi = -1;
  values.forEach((v, i) => {
    if (v >= threshold) {
      if (lo < 0) lo = i;
      hi = i;
    }
  });
  return [years[lo]!, years[hi]!];
}

export function buildReport(
  session: InferenceSession,
  estimate: Estimate,
  topN = 5,
): ReasoningReport {
  const { model } = session;
  const years = model.grid.years;
  const answers = session.answers;

  const keyAnswers = answers
    .filter((a) => a.informative)
    .map((a): KeyAnswer => {
      const cq = model.byId.get(a.questionId)!;
      const idx = cq.question.options.findIndex((o) => o.id === a.optionId);
      const option = cq.question.options[idx]!;
      return {
        questionId: a.questionId,
        questionText: cq.question.text,
        optionId: a.optionId,
        optionLabel: option.label,
        insight: option.insight,
        influence: a.klBits,
        supportsBirthYears: halfMaxRange(cq.raw[idx]!, years),
      };
    })
    .sort((x, y) => y.influence - x.influence)
    .slice(0, topN);

  const genre = new Map<Genre, number>();
  for (const a of answers) {
    if (!a.informative) continue;
    const g = model.byId.get(a.questionId)!.question.genre;
    genre.set(g, (genre.get(g) ?? 0) + a.klBits);
  }

  const total = new Float64Array(years.length);
  for (const a of answers) if (a.points) a.points.forEach((v, i) => (total[i]! += v));
  const byDecade = new Map<number, { sum: number; n: number }>();
  years.forEach((b, i) => {
    const d = Math.floor(b / 10) * 10;
    const e = byDecade.get(d) ?? { sum: 0, n: 0 };
    e.sum += total[i]!;
    e.n++;
    byDecade.set(d, e);
  });
  const avg = [...byDecade].map(([decade, e]) => ({ decade, value: e.sum / e.n }));
  const lo = Math.min(...avg.map((x) => x.value));
  const hi = Math.max(...avg.map((x) => x.value));
  const decadePoints = avg.map(({ decade, value }) => ({
    decade,
    points: hi > lo ? Math.round(((value - lo) / (hi - lo)) * 100) : 50,
  }));

  return {
    keyAnswers,
    genreInfluence: [...genre]
      .map(([g, influence]) => ({ genre: g, influence }))
      .sort((a, b) => b.influence - a.influence),
    decadePoints,
    uncertainty: {
      dontRemember: answers.filter((a) => a.kind === 'dont_remember').length,
      notApplicable: answers.filter((a) => a.kind === 'not_applicable').length,
      surprises: session.surpriseCount,
      surprisingQuestionIds: answers.filter((a) => a.surprise).map((a) => a.questionId),
      multimodal: estimate.multimodal,
      intervalWidth: estimate.width,
    },
  };
}
