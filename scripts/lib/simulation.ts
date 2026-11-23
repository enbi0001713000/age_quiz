/**
 * 仮想回答者によるシミュレーション（設計書 12.1）。
 *
 * 回答者は「モデルそのもの」ではなく、モデルとずれた「現実」から回答を作る。
 * モデルから作った回答だけで評価すると、精度を楽観的に見積もってしまうため。
 *
 * 現実のずれ（シナリオごとに強さを変える）：
 * - 個人の文化的なずれ δ：兄姉の影響・地域差などで、文化的には数年ずれた世代のように答える
 * - ジャンルの関心：アニメに興味がない人は「知らない」が増える、など
 * - データの誤差：質問ごとに年代の情報が数年ずれている可能性
 * - モデル値の誤差（感度）：推定値である年齢窓・経験率の上限が実際とずれている可能性
 * - ランダムな回答・「覚えていない」
 */
import type { Dataset, Genre, Subject } from '../../src/data/schema';
import { GENRES, SPECIAL_OPTION_KINDS } from '../../src/data/schema';
import { compileModel, InferenceSession, type EngineConfig } from '../../src/engine';
import type { EngineModel } from '../../src/engine/compile';
import { summarize } from '../../src/engine/estimate';
import { optionProbabilities, type ModelContext } from '../../src/engine/optionModel';
import { posteriorFrom } from '../../src/engine/posterior';
import { createRandom, gaussian, type Random } from '../../src/engine/random';

export interface Scenario {
  name: string;
  label: string;
  /** 個人の文化的なずれ（標準偏差・年） */
  personOffsetSd: number;
  /** ジャンルの関心のばらつき（対数正規の標準偏差） */
  genreInterestSd: number;
  /** 質問ごとのデータの年代誤差（標準偏差・年） */
  itemShiftSd: number;
  /** 年齢窓のずれ（標準偏差・年） */
  ageWindowSd: number;
  /** 経験率の上限の倍率の範囲 */
  ceilingRange: [number, number];
  /** ランダムに答える割合 */
  randomAnswerRate: number;
  /** 「覚えていない」と答える割合 */
  dontRememberRate: number;
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'ideal',
    label: '理想（モデルどおりの回答者）',
    personOffsetSd: 0,
    genreInterestSd: 0,
    itemShiftSd: 0,
    ageWindowSd: 0,
    ceilingRange: [1, 1],
    randomAnswerRate: 0,
    dontRememberRate: 0,
  },
  {
    name: 'mild',
    label: '現実的（ずれ：小）',
    personOffsetSd: 1,
    genreInterestSd: 0.25,
    itemShiftSd: 1.5,
    ageWindowSd: 1,
    ceilingRange: [0.75, 1.25],
    randomAnswerRate: 0.05,
    dontRememberRate: 0.05,
  },
  {
    name: 'harsh',
    label: '厳しめ（ずれ：大）',
    personOffsetSd: 2,
    genreInterestSd: 0.6,
    itemShiftSd: 2.5,
    ageWindowSd: 2,
    ceilingRange: [0.6, 1.4],
    randomAnswerRate: 0.1,
    dontRememberRate: 0.08,
  },
];

export interface PlayResult {
  trueBirthYear: number;
  estimate: number;
  range: [number, number];
  width: number;
  confidence: 'high' | 'medium' | 'low';
  questions: number;
  reason: string;
  surprises: number;
  /** 回答を1つだけ取り除いたときの推定生年の最大変化（年）。1問への依存度を表す */
  leaveOneOutChange: number;
}

/** 回答を1つずつ取り除いて推定し直し、推定生年の最大変化を返す */
export function leaveOneOutChange(session: InferenceSession): number {
  const { model } = session;
  const informative = session.answers.filter((a) => a.points);
  const total = new Float64Array(model.grid.years.length);
  for (const a of informative) a.points!.forEach((v, i) => (total[i]! += v));
  const base = summarize(posteriorFrom(model.prior, total), model.grid, model.config).birthYear;
  let max = 0;
  for (const a of informative) {
    const without = Float64Array.from(total, (v, i) => v - a.points![i]!);
    const b = summarize(posteriorFrom(model.prior, without), model.grid, model.config).birthYear;
    max = Math.max(max, Math.abs(b - base));
  }
  return max;
}

/** シナリオに従って「現実」の対象データ（モデル値の誤差入り）を作る */
function perturbSubjects(subjects: Subject[], sc: Scenario, random: Random): Subject[] {
  return subjects.map((s) => {
    if (s.kind === 'household') return s; // 統計そのものを使う対象は変えない
    const shift = Math.round(gaussian(random) * sc.ageWindowSd);
    const [a0, a1] = s.model.ageWindow.value;
    const mult = sc.ceilingRange[0] + random() * (sc.ceilingRange[1] - sc.ceilingRange[0]);
    return {
      ...s,
      model: {
        ...s.model,
        ageWindow: { ...s.model.ageWindow, value: [Math.max(0, a0 + shift), a1 + shift] },
        ceiling: { ...s.model.ceiling, value: Math.min(0.98, s.model.ceiling.value * mult) },
      },
    };
  });
}

/** ジャンルの関心で経験率の上限を変えた対象 */
function withInterest(subjects: Subject[], interest: Map<Genre, number>): Map<string, Subject> {
  return new Map(
    subjects.map((s) => {
      const m = interest.get(s.genre) ?? 1;
      if (s.kind === 'household' || m === 1) return [s.id, s];
      return [
        s.id,
        {
          ...s,
          model: {
            ...s.model,
            ceiling: { ...s.model.ceiling, value: Math.min(0.98, s.model.ceiling.value * m) },
          },
        },
      ];
    }),
  );
}

export interface SimulationOptions {
  dataset: Dataset;
  config: EngineConfig;
  scenario: Scenario;
  referenceYear: number;
  /** 各生年の人数 */
  perYear: number;
  /** 生年の範囲（年齢10〜90歳） */
  ages?: [number, number];
  seed: number;
  /** 毎回同じモデルを使う場合に渡す（設定を変えないときの高速化） */
  model?: EngineModel;
}

export function simulate(opts: SimulationOptions): PlayResult[] {
  const { dataset, scenario: sc, referenceYear } = opts;
  const random = createRandom(opts.seed);
  const model = opts.model ?? compileModel(dataset, { referenceYear, config: opts.config });
  // 「現実」のデータ：モデル値の誤差と、質問ごとの年代誤差（全回答者で共通）
  const realSubjects = perturbSubjects(dataset.subjects, sc, random);
  const itemShift = new Map(
    dataset.questions.map((q) => [q.id, gaussian(random) * sc.itemShiftSd]),
  );
  const stats = new Map(dataset.statistics.map((s) => [s.id, s]));
  const [minAge, maxAge] = opts.ages ?? [10, 90];

  const results: PlayResult[] = [];
  for (let b = referenceYear - maxAge; b <= referenceYear - minAge; b++) {
    for (let n = 0; n < opts.perYear; n++) {
      const delta = gaussian(random) * sc.personOffsetSd;
      const interest = new Map(
        GENRES.map((g) => [
          g,
          Math.min(1.6, Math.max(0.15, Math.exp(gaussian(random) * sc.genreInterestSd))),
        ]),
      );
      const ctx: ModelContext = { subjects: withInterest(realSubjects, interest), stats };
      const session = new InferenceSession(model, { seed: Math.floor(random() * 2 ** 31) });
      for (let cq = session.nextQuestion(); cq; cq = session.nextQuestion()) {
        const q = cq.question;
        const main = q.options.flatMap((o, i) =>
          SPECIAL_OPTION_KINDS.includes(o.kind) ? [] : [i],
        );
        let optionIndex: number;
        if (random() < sc.dontRememberRate) {
          optionIndex = q.options.findIndex((o) => o.kind === 'dont_remember');
        } else if (random() < sc.randomAnswerRate) {
          optionIndex = main[Math.floor(random() * main.length)]!;
        } else {
          const p = optionProbabilities(q, b + delta + (itemShift.get(q.id) ?? 0), ctx);
          let r = random();
          optionIndex = main[main.length - 1]!;
          for (const i of main) {
            r -= p[i]!;
            if (r <= 0) {
              optionIndex = i;
              break;
            }
          }
        }
        session.answer(q.options[optionIndex]!.id);
      }
      const e = session.estimate();
      results.push({
        trueBirthYear: b,
        estimate: e.birthYear,
        range: e.birthRange,
        width: e.width,
        confidence: e.confidence,
        questions: session.answers.length,
        reason: session.reason ?? '',
        surprises: session.surpriseCount,
        leaveOneOutChange: leaveOneOutChange(session),
      });
    }
  }
  return results;
}

export interface Metrics {
  n: number;
  mae: number;
  medianError: number;
  within2: number;
  within5: number;
  /** 実際の生年が80%区間に入った割合（目標≈0.8） */
  coverage: number;
  meanWidth: number;
  confidenceShare: Record<'high' | 'medium' | 'low', number>;
  /** 確信度「高」のうち誤差3年超の割合 */
  highWrongRate: number | null;
  meanQuestions: number;
  maxQuestions: number;
  /** 回答を1つ取り除いたときの推定生年の変化：95パーセンタイルと最大（年） */
  leaveOneOutP95: number;
  leaveOneOutMax: number;
  reasons: Record<string, number>;
}

const share = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : 0);
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};

export function metrics(rs: PlayResult[]): Metrics {
  const err = rs.map((r) => Math.abs(r.estimate - r.trueBirthYear));
  const high = rs.filter((r) => r.confidence === 'high');
  const reasons: Record<string, number> = {};
  for (const r of rs) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1 / rs.length;
  return {
    n: rs.length,
    mae: err.reduce((s, e) => s + e, 0) / rs.length,
    medianError: quantile(err, 0.5),
    within2: share(err.map((e) => e <= 2)),
    within5: share(err.map((e) => e <= 5)),
    coverage: share(rs.map((r) => r.trueBirthYear >= r.range[0] && r.trueBirthYear <= r.range[1])),
    meanWidth: rs.reduce((s, r) => s + r.width, 0) / rs.length,
    confidenceShare: {
      high: share(rs.map((r) => r.confidence === 'high')),
      medium: share(rs.map((r) => r.confidence === 'medium')),
      low: share(rs.map((r) => r.confidence === 'low')),
    },
    highWrongRate: high.length
      ? share(high.map((r) => Math.abs(r.estimate - r.trueBirthYear) > 3))
      : null,
    meanQuestions: rs.reduce((s, r) => s + r.questions, 0) / rs.length,
    maxQuestions: Math.max(...rs.map((r) => r.questions)),
    leaveOneOutP95: quantile(
      rs.map((r) => r.leaveOneOutChange),
      0.95,
    ),
    leaveOneOutMax: Math.max(...rs.map((r) => r.leaveOneOutChange)),
    reasons,
  };
}

/** 生まれた年代ごとの指標 */
export function metricsByDecade(rs: PlayResult[]): { decade: number; m: Metrics }[] {
  const groups = new Map<number, PlayResult[]>();
  for (const r of rs) {
    const d = Math.floor(r.trueBirthYear / 10) * 10;
    groups.set(d, [...(groups.get(d) ?? []), r]);
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([decade, g]) => ({ decade, m: metrics(g) }));
}
