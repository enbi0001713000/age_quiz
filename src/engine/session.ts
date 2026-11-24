/**
 * 1プレイの進行管理（推理エンジンの入口）。
 *
 * 1. 基本質問：共通プールから毎回 basic.count 問をランダムに選んで出題（Q6）
 * 2. 追加質問：EIG にもとづく適応型選択（selector.ts）
 * 3. 回答ごとに確率を更新し、終了判定（termination.ts）
 *
 * UI からは nextQuestion() で質問を受け取り、answer() で回答を渡すだけでよい。
 * 時刻は引数で受け取る（テスト・シミュレーションで再現できるようにするため）。
 */
import type { OptionKind } from '../data/schema';
import type { CompiledQuestion, EngineModel } from './compile';
import { summarize, type Estimate } from './estimate';
import {
  answerPoints,
  klDivergenceBits,
  meanOf,
  posteriorFrom,
  predictiveProbability,
} from './posterior';
import { createRandom, sample, type Random } from './random';
import { answerExponent, evaluateCandidates, pickCandidate, type Candidate } from './selector';
import { cautious, checkTermination, type FinishReason } from './termination';

export type SessionPhase = 'basic' | 'adaptive' | 'finished';

export interface AnswerRecord {
  questionId: string;
  optionId: string;
  kind: OptionKind;
  phase: 'basic' | 'adaptive';
  /** 推理に使ったか（「覚えていない」「該当しない」は使わない） */
  informative: boolean;
  /** 証拠の強さ τ·w·γ^k（使わない回答は0） */
  exponent: number;
  /** 回答前の予測確率（使わない回答は null） */
  predictive: number | null;
  /** 意外な回答か（予測確率がしきい値未満） */
  surprise: boolean;
  /** この回答で各生年に加わったポイント（平均を0にそろえたもの。使わない回答は null） */
  points: Float64Array | null;
  /** この回答で推定がどれだけ動いたか（bit） */
  klBits: number;
  /** 平均生年の移動量（年） */
  meanShift: number;
}

export interface SessionOptions {
  seed: number;
  /** 開始時刻（ミリ秒）。省略時は0 */
  startedAt?: number;
  /** 基本質問の出題順を固定する（テスト・検証用。通常は省略してランダムに選ぶ） */
  basicOrder?: string[];
}

export class InferenceSession {
  readonly model: EngineModel;
  private readonly random: Random;
  private readonly startedAt: number;
  private readonly basicQueue: CompiledQuestion[];
  private readonly history: CompiledQuestion[] = [];
  private readonly records: AnswerRecord[] = [];
  private readonly answeredIds = new Set<string>();
  private readonly excluded = new Set<string>();
  private points: Float64Array;
  private current: Float64Array;
  private pending: CompiledQuestion | null = null;
  private finishReason: FinishReason | null = null;
  private surprises = 0;
  /** 推理に使った回答の尤度（最終推定との整合性の確認に使う） */
  private readonly usedLikelihoods: Float64Array[] = [];
  private lowGainStreak = 0;
  private lastCandidates: Candidate[] | null = null;
  private readonly basicTotal: number;

  constructor(model: EngineModel, options: SessionOptions) {
    this.model = model;
    this.random = createRandom(options.seed);
    this.startedAt = options.startedAt ?? 0;
    this.basicQueue = options.basicOrder
      ? options.basicOrder.map((id) => {
          const q = model.byId.get(id);
          if (!q) throw new Error(`基本質問 ${id} がありません`);
          return q;
        })
      : sample(model.basicPool, model.config.basic.count, this.random);
    this.basicTotal = this.basicQueue.length;
    this.points = new Float64Array(model.grid.years.length);
    this.current = Float64Array.from(model.prior);
  }

  get phase(): SessionPhase {
    if (this.finishReason) return 'finished';
    return this.records.length < this.basicCount ? 'basic' : 'adaptive';
  }

  /** この回の基本質問の数（プールが少ない場合はプールの数） */
  get basicCount(): number {
    return this.basicTotal;
  }

  get answers(): readonly AnswerRecord[] {
    return this.records;
  }

  get reason(): FinishReason | null {
    return this.finishReason;
  }

  get surpriseCount(): number {
    return this.surprises;
  }

  /** 慎重モード（意外な回答が多く、最低・最大質問数を引き上げている状態） */
  get isCautious(): boolean {
    return cautious({ surprises: this.surprises }, this.model.config);
  }

  /** 現在の推定確率（校正前） */
  posterior(): Float64Array {
    return Float64Array.from(this.current);
  }

  /**
   * 現在の推定から見て「意外な回答」になっている回答の数。
   * 回答直後の判定（surpriseCount）と違い、推定が固まった後に振り返って数える。
   * 前半と後半で別の世代のように答えた場合、回答直後の判定は最初の1回しか反応しないため。
   */
  get conflictCount(): number {
    const threshold = this.model.config.surpriseThreshold;
    return this.usedLikelihoods.filter((l) => predictiveProbability(this.current, l) < threshold)
      .length;
  }

  /** 現在の推定結果（校正後） */
  estimate(): Estimate {
    const e = summarize(this.current, this.model.grid, this.model.config);
    if (
      e.confidence === 'high' &&
      this.conflictCount > this.model.config.confidence.maxConflictsForHigh
    ) {
      return { ...e, confidence: 'medium' };
    }
    return e;
  }

  /** 次に出題する質問（終了していれば null）。回答するまで同じ質問を返す */
  nextQuestion(): CompiledQuestion | null {
    if (this.finishReason) return null;
    if (!this.pending) this.pending = this.chooseNext();
    if (!this.pending) this.finishReason = 'exhausted';
    return this.pending;
  }

  /** 現在の質問に回答する */
  answer(optionId: string, now = this.startedAt): AnswerRecord {
    const cq = this.nextQuestion();
    if (!cq) throw new Error('出題中の質問がありません（終了済み）');
    const optionIndex = cq.question.options.findIndex((o) => o.id === optionId);
    if (optionIndex < 0) throw new Error(`${cq.question.id}: 選択肢 ${optionId} がありません`);
    const option = cq.question.options[optionIndex]!;
    const likelihood = cq.likelihood[optionIndex] ?? null;
    const phase = this.phase === 'basic' ? 'basic' : 'adaptive';

    let record: AnswerRecord;
    if (likelihood) {
      const exponent = answerExponent(this.model, cq, this.answeredIds);
      const predictive = predictiveProbability(this.current, likelihood);
      const surprise = predictive < this.model.config.surpriseThreshold;
      const added = answerPoints(likelihood, exponent);
      const before = this.current;
      for (let i = 0; i < added.length; i++) this.points[i]! += added[i]!;
      this.current = posteriorFrom(this.model.prior, this.points);
      const mean = added.reduce((s, v) => s + v, 0) / added.length;
      if (surprise) this.surprises++;
      this.usedLikelihoods.push(likelihood);
      record = {
        questionId: cq.question.id,
        optionId,
        kind: option.kind,
        phase,
        informative: true,
        exponent,
        predictive,
        surprise,
        points: Float64Array.from(added, (v) => v - mean),
        klBits: klDivergenceBits(this.current, before),
        meanShift:
          meanOf(this.current, this.model.grid.years) - meanOf(before, this.model.grid.years),
      };
      this.answeredIds.add(cq.question.id);
    } else {
      // 「覚えていない」「該当しない」は推理に使わない
      if (option.kind === 'not_applicable') for (const id of cq.related) this.excluded.add(id);
      record = {
        questionId: cq.question.id,
        optionId,
        kind: option.kind,
        phase,
        informative: false,
        exponent: 0,
        predictive: null,
        surprise: false,
        points: null,
        klBits: 0,
        meanShift: 0,
      };
    }
    this.records.push(record);
    this.history.push(cq);
    this.pending = null;
    this.afterAnswer(now);
    return record;
  }

  /** 回答後：次の候補を評価し、終了判定を行う */
  private afterAnswer(now: number): void {
    const estimate = this.estimate();
    const inBasic = this.records.length < this.basicCount;
    const candidates = inBasic ? null : this.evaluate(estimate.width);
    const bestGain = inBasic
      ? Infinity
      : candidates && candidates.length
        ? Math.max(...candidates.map((c) => c.gain))
        : null;
    if (bestGain !== null && bestGain < this.model.config.termination.minExpectedGainBits) {
      this.lowGainStreak++;
    } else {
      this.lowGainStreak = 0;
    }
    this.finishReason = checkTermination(
      {
        asked: this.records.length,
        surprises: this.surprises,
        intervalWidth: estimate.width,
        bestGain,
        lowGainStreak: this.lowGainStreak,
        elapsedMs: now - this.startedAt,
      },
      this.model.config,
    );
    this.lastCandidates = candidates;
  }

  private evaluate(intervalWidth: number): Candidate[] {
    return evaluateCandidates({
      model: this.model,
      posterior: this.current,
      intervalWidth,
      history: this.history,
      answeredIds: this.answeredIds,
      excluded: this.excluded,
      random: this.random,
    });
  }

  private chooseNext(): CompiledQuestion | null {
    const asked = new Set(this.history.map((q) => q.question.id));
    while (this.basicQueue.length > 0) {
      const next = this.basicQueue.shift()!;
      if (!asked.has(next.question.id) && !this.excluded.has(next.question.id)) return next;
    }
    const candidates = this.lastCandidates ?? this.evaluate(this.estimate().width);
    this.lastCandidates = null;
    return (
      pickCandidate(candidates, this.model.config.selection.randomBand, this.random)?.question ??
      null
    );
  }
}
