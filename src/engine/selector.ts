/**
 * 次の質問の選択（設計書 5.8）。
 *
 *   スコア = 期待情報利得（EIG）× 出題優先度 × 難易度の適合 × 多様性
 *
 * EIG：「この質問をしたら、生年の不確かさ（エントロピー）が平均でどれだけ減るか」（bit）。
 * 最高スコアの一定割合以上の候補からランダムに選び、同じ答え方でも毎回同じ展開にならないようにする。
 */
import type { CompiledQuestion, EngineModel } from './compile';
import { entropyBits, predictiveProbability, updatedPosterior } from './posterior';
import type { Random } from './random';

/** 回答による証拠の強さ（指数）：τ × w × γ^（すでに答えた関連質問の数） */
export function answerExponent(
  model: EngineModel,
  cq: CompiledQuestion,
  answeredIds: ReadonlySet<string>,
): number {
  let relatedAnswered = 0;
  for (const id of cq.related) if (answeredIds.has(id)) relatedAnswered++;
  return model.config.temperature * cq.weight * model.config.relatedDiscount ** relatedAnswered;
}

/** 期待情報利得（bit） */
export function expectedInformationGain(
  posterior: Float64Array,
  cq: CompiledQuestion,
  exponent: number,
): number {
  const h0 = entropyBits(posterior);
  let expected = 0;
  for (const i of cq.mainOptions) {
    const l = cq.likelihood[i]!;
    const pa = predictiveProbability(posterior, l);
    if (pa <= 0) continue;
    expected += pa * entropyBits(updatedPosterior(posterior, l, exponent));
  }
  return Math.max(0, h0 - expected);
}

export interface SelectionContext {
  model: EngineModel;
  posterior: Float64Array;
  /** 現在の80%区間の幅（年） */
  intervalWidth: number;
  /** すでに出題した質問 */
  history: readonly CompiledQuestion[];
  answeredIds: ReadonlySet<string>;
  /** 出題しない質問（「該当しない」と答えた質問の関連質問など） */
  excluded: ReadonlySet<string>;
  random: Random;
}

export interface Candidate {
  question: CompiledQuestion;
  gain: number;
  score: number;
}

/** 出題できる全質問の EIG とスコア */
export function evaluateCandidates(ctx: SelectionContext): Candidate[] {
  const { model, history } = ctx;
  const s = model.config.selection;
  const asked = new Set(history.map((q) => q.question.id));
  const previous = history[history.length - 1];
  const genreCount = new Map<string, number>();
  for (const q of history) {
    genreCount.set(q.question.genre, (genreCount.get(q.question.genre) ?? 0) + 1);
  }
  const unlocked = ctx.intervalWidth <= s.hardUnlockWidth;
  const difficulty = unlocked ? s.difficultyAfterUnlock : s.difficultyBeforeUnlock;

  const candidates: Candidate[] = [];
  for (const cq of model.questions) {
    const q = cq.question;
    if (asked.has(q.id) || ctx.excluded.has(q.id)) continue;
    const gain = expectedInformationGain(
      ctx.posterior,
      cq,
      answerExponent(model, cq, ctx.answeredIds),
    );
    let diversity = 1;
    if (previous && previous.question.genre === q.genre) diversity *= s.sameGenreAsPrevious;
    if ((genreCount.get(q.genre) ?? 0) >= 2) diversity *= s.genreUsedTwice;
    if ([...cq.related].some((id) => asked.has(id))) diversity *= s.relatedAsked;
    const score = gain * q.priority * difficulty[q.difficulty] * diversity;
    candidates.push({ question: cq, gain, score });
  }
  return candidates;
}

/** スコア上位の帯からランダムに1問選ぶ（候補がなければ null） */
export function pickCandidate(
  candidates: readonly Candidate[],
  band: number,
  random: Random,
): Candidate | null {
  if (candidates.length === 0) return null;
  const best = Math.max(...candidates.map((c) => c.score));
  const pool = candidates.filter((c) => c.score >= band * best);
  return pool[Math.floor(random() * pool.length)] ?? null;
}
