/**
 * アプリに同梱する質問データ（data/ のJSON）を読み込む。
 *
 * データの形式・整合性はビルド前（npm run validate:data、CI）に検査済みのため、
 * 実行時は検査ライブラリ（Zod）を同梱せず、省略可能な項目の既定値だけを補う。
 * 同梱データが検査済みデータと一致することは tests/unit/ui-logic.test.ts で確認している。
 */
import type { Dataset, Generations, Question, Source, Statistic, Subject } from './schema';

type Files<T> = Record<string, T>;

const sources = import.meta.glob<{ sources: Source[] }>('/data/sources.json', {
  eager: true,
  import: 'default',
});
const subjects = import.meta.glob<{ subjects: Subject[] }>('/data/subjects/*.json', {
  eager: true,
  import: 'default',
});
const questions = import.meta.glob<{ questions: Question[] }>('/data/questions/*.json', {
  eager: true,
  import: 'default',
});
const statistics = import.meta.glob<Statistic>('/data/statistics/*.json', {
  eager: true,
  import: 'default',
});
const generations = import.meta.glob<Generations>('/data/generations.json', {
  eager: true,
  import: 'default',
});

/** ファイル名順に並べて結合する（検査用の読み込みと同じ順序にそろえる） */
function ordered<T>(files: Files<T>): T[] {
  return Object.keys(files)
    .sort()
    .map((k) => files[k]!);
}

export function loadBundledDataset(): Dataset {
  return {
    sources: ordered(sources).flatMap((f) => f.sources),
    subjects: ordered(subjects).flatMap((f) =>
      f.subjects.map((s) => ({ ...s, model: { ...s.model, floor: s.model.floor ?? 0.03 } })),
    ),
    questions: ordered(questions).flatMap((f) =>
      f.questions.map((q) => ({
        ...q,
        relatedIds: q.relatedIds ?? [],
        basicPool: q.basicPool ?? false,
      })),
    ),
    statistics: ordered(statistics),
    generations: ordered(generations)[0],
  };
}
