/**
 * 「回答から読み取れた特徴」（要件 2-3・7-4）。
 * 回答の傾向だけを述べ、性格・職業・経歴などは推測しない。
 */
import { GENRE_LABELS } from '../../data/constants';
import type { Estimate, ReasoningReport } from '../../engine';
import type { AnswerRecord } from '../../engine';

export function answerTraits(
  answers: readonly AnswerRecord[],
  report: ReasoningReport,
  estimate: Estimate,
): string[] {
  const traits: string[] = [];
  const top = report.genreInfluence[0];
  if (top) {
    traits.push(`「${GENRE_LABELS[top.genre]}」の回答に、年代の手がかりが最も強く表れました。`);
  }
  const informative = answers.filter((a) => a.informative);
  const unaware = informative.filter((a) => a.kind === 'unaware').length;
  if (informative.length > 0 && unaware / informative.length >= 0.3) {
    traits.push(`「知らない」と答えた題材が多め（${unaware}問）でした。`);
  }
  const dontRemember = report.uncertainty.dontRemember;
  if (dontRemember >= 3) {
    traits.push(`「覚えていない」が${dontRemember}問あり、そのぶん手がかりが少なめでした。`);
  }
  if (report.uncertainty.surprises > 0) {
    traits.push(
      `推定した世代とは異なる傾向の回答が${report.uncertainty.surprises}問ありました（兄姉の影響やリバイバルなどで、別の世代の文化に触れていた可能性があります）。`,
    );
  }
  if (estimate.multimodal) traits.push('候補が離れた2つの年代に分かれました。');
  return traits;
}
