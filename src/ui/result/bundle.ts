/**
 * 結果画面に表示する情報一式をまとめる。
 */
import type { Generations } from '../../data/schema';
import { buildReport, type Estimate, type ReasoningReport } from '../../engine';
import type { GameFlow } from '../game/flow';
import { classifyGeneration, type GenerationResult } from './generation';
import { answerTraits } from './traits';

export interface ResultBundle {
  estimate: Estimate;
  answered: number;
  report: ReasoningReport;
  generation: GenerationResult;
  traits: string[];
}

export function buildResultBundle(flow: GameFlow, generations: Generations): ResultBundle {
  const estimate = flow.finalEstimate();
  const report = buildReport(flow.session, estimate);
  return {
    estimate,
    answered: flow.session.answers.length,
    report,
    generation: classifyGeneration(estimate, generations),
    traits: answerTraits(flow.session.answers, report, estimate),
  };
}
