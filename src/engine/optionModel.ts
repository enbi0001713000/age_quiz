/**
 * 質問の各選択肢が選ばれる確率 P(選択肢 | 生年) のモデル（設計書 5.4・5.5）。
 *
 * - 経験型：経験確率・認知確率から「よく／少し／知っているが未経験／知らない」の確率を作る
 * - 時代選択型：各選択肢の時代と、質問が問う年齢帯との重なりから確率を作る
 * - 「覚えていない」「該当しない」は推理に使わないため、ここでは計算しない（null）
 *
 * ここで計算するのは頑健化（ランダム回答の混合・温度）を入れる前の素のモデル値。
 * 頑健化は Phase 3 の推理エンジンで行う。
 */
import type { Option, Question, Subject } from '../data/schema';
import { SPECIAL_OPTION_KINDS } from '../data/constants';
import { estimateExperience, eraSaturation, type StatisticsIndex } from './exposure';

export const ERA_CONSTANTS = {
  /** どの時代にも当てはまらない人が、ある時代の選択肢を選ぶ最低限の重み */
  epsilon: 0.03,
  /** 「この中にはない」の基本の重み */
  noneBase: 0.05,
  /** どの選択肢の時代にも当てはまらないときの「この中にはない」の重み */
  noneScale: 0.6,
} as const;

export interface ModelContext {
  subjects: ReadonlyMap<string, Subject>;
  stats: StatisticsIndex;
}

export const isSpecialOption = (o: Option) => SPECIAL_OPTION_KINDS.includes(o.kind);

function requireSubject(ctx: ModelContext, id: string | undefined, where: string): Subject {
  const s = id ? ctx.subjects.get(id) : undefined;
  if (!s) throw new Error(`${where}: 対象 ${id ?? '(未指定)'} が見つかりません`);
  return s;
}

/**
 * 生年 birthYear の人が各選択肢を選ぶ確率。
 * 返り値は options と同じ順の配列で、特殊回答は null。主要選択肢の合計は 1。
 */
export function optionProbabilities(
  question: Question,
  birthYear: number,
  ctx: ModelContext,
): (number | null)[] {
  return question.type === 'experience'
    ? experienceProbabilities(question, birthYear, ctx)
    : eraProbabilities(question, birthYear, ctx);
}

function experienceProbabilities(q: Question, b: number, ctx: ModelContext): (number | null)[] {
  const subject = requireSubject(ctx, q.subject, q.id);
  const { pExperience: pe, pAware: pa, heavyShare: h } = estimateExperience(subject, b, ctx.stats);
  const kinds = new Set(q.options.map((o) => o.kind));
  const splitsExperience = kinds.has('heavy') && kinds.has('light');
  const hasUnaware = kinds.has('unaware');

  const raw = q.options.map((o): number | null => {
    switch (o.kind) {
      case 'heavy':
        return splitsExperience ? pe * h : pe;
      case 'light':
        return pe * (1 - h);
      case 'aware_only':
        return pa - pe;
      case 'no_experience':
        // 「知らない」が別にあれば「知っているが経験なし」、なければ「経験なし」全体
        return hasUnaware ? pa - pe : 1 - pe;
      case 'unaware':
        return 1 - pa;
      case 'dont_remember':
      case 'not_applicable':
        return null;
      default:
        throw new Error(`${q.id}: 経験型の質問に使えない選択肢の種類 ${o.kind}`);
    }
  });
  return normalize(raw);
}

function eraProbabilities(q: Question, b: number, ctx: ModelContext): (number | null)[] {
  if (!q.ageWindow) throw new Error(`${q.id}: 時代選択型には ageWindow が必要`);
  const window = q.ageWindow;
  const C = ERA_CONSTANTS;
  const saturations: number[] = [];
  const raw = q.options.map((o): number | null => {
    if (o.kind === 'era') {
      const subject = requireSubject(ctx, o.subject, `${q.id}/${o.id}`);
      const sat = eraSaturation(subject, b, window, ctx.stats);
      saturations.push(sat);
      return C.epsilon + subject.model.ceiling.value * sat;
    }
    return null;
  });
  const noneWeight = C.noneBase + C.noneScale * saturations.reduce((p, s) => p * (1 - s), 1);
  const withNone = raw.map((v, i) => (q.options[i]!.kind === 'none_of_these' ? noneWeight : v));
  return normalize(withNone);
}

function normalize(values: (number | null)[]): (number | null)[] {
  const clean = values.map((v) => (v === null ? null : Math.max(0, v)));
  const total = clean.reduce<number>((s, v) => s + (v ?? 0), 0);
  if (total <= 0) throw new Error('選択肢の確率の合計が0になりました');
  return clean.map((v) => (v === null ? null : v / total));
}
