/**
 * 推理エンジンの公開API。UI（Phase 4〜）はここからだけ import する。
 *
 * 使い方：
 *   const model = compileModel(dataset, { referenceYear: 2026 });
 *   const session = new InferenceSession(model, { seed, startedAt: Date.now() });
 *   const q = session.nextQuestion();      // 出題（終了なら null）
 *   session.answer(optionId, Date.now());  // 回答
 *   session.estimate();                    // 推定結果（いつでも取得可）
 *   buildReport(session, session.estimate());
 */
export { DEFAULT_CONFIG, type EngineConfig } from './config';
export { compileModel, type CompiledQuestion, type EngineModel } from './compile';
export { InferenceSession, type AnswerRecord, type SessionPhase } from './session';
export { type ConfidenceLevel, type Estimate } from './estimate';
export { type FinishReason } from './termination';
export { buildReport, type ReasoningReport } from './report';
