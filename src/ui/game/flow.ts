/**
 * ゲーム進行（画面に依存しないロジック）。
 *
 * 推理エンジンのセッションを包み、画面が必要とする情報（質問・進捗・分析ステータス・
 * 推定年代レーダー）と、演出のきっかけになるイベントを提供する。
 * DOM を使わないため、Node 上の単体テストでそのまま確認できる。
 */
import {
  InferenceSession,
  type CompiledQuestion,
  type EngineModel,
  type Estimate,
  type SessionPhase,
} from '../../engine';
import { GENRE_LABELS, SPECIAL_OPTION_KINDS, type OptionKind } from '../../data/constants';
import { eraRangeLabel } from '../format';

/** 推定年代レーダーを更新する間隔（問） */
export const RADAR_INTERVAL = 3;

export interface QuestionView {
  id: string;
  /** 何問目か（1始まり） */
  number: number;
  text: string;
  genreLabel: string;
  difficulty: 'easy' | 'normal' | 'hard';
  phase: 'basic' | 'adaptive';
  options: { id: string; label: string; key: string }[];
  specialOptions: { id: string; label: string; kind: OptionKind }[];
}

export interface RadarView {
  /** 生まれた年代ごとの推定確率（校正後） */
  bars: { decade: number; probability: number }[];
  /** 推定年代の言葉（候補が広すぎる間は null） */
  label: string | null;
  /** 何問目の回答後の推定か */
  afterAnswers: number;
}

export interface GameView {
  finished: boolean;
  question: QuestionView | null;
  answered: number;
  basicTotal: number;
  phase: SessionPhase;
  /** 解析進捗（0〜1、単調増加）。質問数が固定でないため、質問数と推定の絞り込み具合から計算 */
  progress: number;
  status: string;
  radar: RadarView | null;
}

/** 回答後に起きた出来事（演出のきっかけ） */
export type AnswerEvent = 'phase_change' | 'radar_update' | 'surprise' | 'finished';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
/** 推定年代の言葉を出す、80%区間の幅の上限（年） */
const LABEL_MAX_WIDTH = 30;

export interface GameFlowOptions {
  seed: number;
  startedAt: number;
}

export class GameFlow {
  readonly session: InferenceSession;
  private readonly model: EngineModel;
  private readonly initialWidth: number;
  private progressValue = 0;
  private radarView: RadarView | null = null;
  private lastSurprise = false;

  constructor(model: EngineModel, options: GameFlowOptions) {
    this.model = model;
    this.session = new InferenceSession(model, {
      seed: options.seed,
      startedAt: options.startedAt,
    });
    this.initialWidth = this.session.estimate().width;
  }

  view(): GameView {
    const s = this.session;
    const cq = s.nextQuestion();
    return {
      finished: s.phase === 'finished',
      question: cq ? this.questionView(cq) : null,
      answered: s.answers.length,
      basicTotal: s.basicCount,
      phase: s.phase,
      progress: this.progressValue,
      status: this.statusText(),
      radar: this.radarView,
    };
  }

  /** 回答して、起きた出来事を返す */
  answer(optionId: string, now: number): AnswerEvent[] {
    const s = this.session;
    const before = s.phase;
    const record = s.answer(optionId, now);
    const events: AnswerEvent[] = [];
    this.lastSurprise = record.surprise;
    if (record.surprise) events.push('surprise');

    const estimate = s.estimate();
    this.updateProgress(estimate);
    const phaseChanged = before === 'basic' && s.phase !== 'basic';
    if (phaseChanged && s.phase !== 'finished') events.push('phase_change');
    if (phaseChanged || s.answers.length % RADAR_INTERVAL === 0) {
      this.radarView = this.radarFrom(estimate);
      events.push('radar_update');
    }
    if (s.phase === 'finished') {
      this.progressValue = 1;
      events.push('finished');
    }
    return events;
  }

  /** 最終結果（終了後） */
  finalEstimate(): Estimate {
    return this.session.estimate();
  }

  private questionView(cq: CompiledQuestion): QuestionView {
    const q = cq.question;
    const main = q.options.filter((o) => !SPECIAL_OPTION_KINDS.includes(o.kind));
    return {
      id: q.id,
      number: this.session.answers.length + 1,
      text: q.text,
      genreLabel: GENRE_LABELS[q.genre],
      difficulty: q.difficulty,
      phase: this.session.phase === 'basic' ? 'basic' : 'adaptive',
      options: main.map((o, i) => ({ id: o.id, label: o.label, key: OPTION_KEYS[i]! })),
      specialOptions: q.options
        .filter((o) => SPECIAL_OPTION_KINDS.includes(o.kind))
        .map((o) => ({ id: o.id, label: o.label, kind: o.kind })),
    };
  }

  /**
   * 解析進捗 = 0.6 × 質問数の割合 + 0.4 × 推定の絞り込み具合（単調増加、終了まで最大97%）。
   * 推定は最初の数問で急に絞り込まれるため、絞り込みだけで計算すると序盤で90%に達してしまう。
   */
  private updateProgress(e: Estimate): void {
    const t = this.model.config.termination;
    const maxQ = this.session.isCautious ? t.maxQuestionsWithSurprises : t.maxQuestions;
    const byCount = Math.min(1, this.session.answers.length / maxQ);
    const span = this.initialWidth - t.stopWidth;
    const byWidth = span > 0 ? Math.min(1, Math.max(0, (this.initialWidth - e.width) / span)) : 0;
    const combined = 0.6 * byCount + 0.4 * byWidth;
    this.progressValue = Math.min(0.97, Math.max(this.progressValue, combined));
  }

  private radarFrom(e: Estimate): RadarView {
    return {
      bars: e.decadeProbabilities,
      label: e.width <= LABEL_MAX_WIDTH ? eraRangeLabel(e.birthRange[0], e.birthRange[1]) : null,
      afterAnswers: this.session.answers.length,
    };
  }

  private statusText(): string {
    const s = this.session;
    if (s.phase === 'finished') return '分析完了';
    if (s.phase === 'basic') return `基本スキャン中（${s.answers.length + 1}/${s.basicCount}）`;
    if (this.lastSurprise) return '異なる世代の傾向を検出。再照合しています';
    const width = s.estimate().width;
    if (width <= 10) return '候補をさらに絞り込んでいます';
    return '精密分析中';
  }
}
