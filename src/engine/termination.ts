/**
 * 終了判定（設計書 5.9）。
 */
import type { EngineConfig } from './config';

export type FinishReason =
  /** 確信度に到達（最低質問数以上で80%区間が十分狭い） */
  | 'confident'
  /** これ以上質問しても改善が見込めない */
  | 'no_gain'
  /** 質問数の上限 */
  | 'max_questions'
  /** プレイ時間の上限 */
  | 'time'
  /** 出題できる質問がない */
  | 'exhausted';

export interface TerminationState {
  /** 回答した質問数（「覚えていない」なども含む） */
  asked: number;
  /** 意外な回答の数 */
  surprises: number;
  /** 校正後の80%区間の幅（年） */
  intervalWidth: number;
  /** 残りの質問の最大EIG（bit）。候補がなければ null */
  bestGain: number | null;
  /** 最大EIGが下限未満だった連続回数 */
  lowGainStreak: number;
  /** 開始からの経過時間（ミリ秒） */
  elapsedMs: number;
}

export function cautious(
  state: Pick<TerminationState, 'surprises'>,
  config: EngineConfig,
): boolean {
  return state.surprises >= config.termination.surprisesForCaution;
}

export function checkTermination(
  state: TerminationState,
  config: EngineConfig,
): FinishReason | null {
  const t = config.termination;
  const careful = cautious(state, config);
  const minQ = careful ? t.minQuestionsWithSurprises : t.minQuestions;
  const maxQ = careful ? t.maxQuestionsWithSurprises : t.maxQuestions;

  if (state.bestGain === null) return 'exhausted';
  if (state.asked >= maxQ) return 'max_questions';
  if (state.elapsedMs >= t.maxDurationMs) return 'time';
  if (state.asked < minQ) return null;
  if (state.intervalWidth <= t.stopWidth) return 'confident';
  if (state.lowGainStreak >= t.lowGainStreak) return 'no_gain';
  return null;
}
