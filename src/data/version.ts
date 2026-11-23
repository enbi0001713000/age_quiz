/**
 * 質問データの版（履歴に保存し、データ更新前後の結果を比べる際の注意表示に使う）。
 * 質問・対象のデータから計算した短いハッシュ（FNV-1a）。
 */
import type { Dataset } from './schema';

export function dataVersion(dataset: Pick<Dataset, 'questions' | 'subjects'>): string {
  const text = JSON.stringify([dataset.questions, dataset.subjects]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${dataset.questions.length}q-${h.toString(16).padStart(8, '0')}`;
}
