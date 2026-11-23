/**
 * data/ 以下のJSONを読み込み、形式（Zod）を検査してデータ一式を返す（Node専用）。
 * 形式エラーは例外にせず formatErrors に集めて返す（検証スクリプトでまとめて表示するため）。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { z } from 'zod';
import {
  GenerationsFileSchema,
  QuestionsFileSchema,
  SourcesFileSchema,
  StatisticSchema,
  SubjectsFileSchema,
  type Dataset,
} from '../../src/data/schema';

export const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');

export interface LoadResult {
  dataset: Dataset;
  formatErrors: string[];
  files: string[];
}

function jsonFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

export function loadDataset(dataDir = DATA_DIR): LoadResult {
  const formatErrors: string[] = [];
  const files: string[] = [];
  const dataset: Dataset = { sources: [], subjects: [], questions: [], statistics: [] };

  const parse = <S extends z.ZodType>(file: string, schema: S): z.infer<S> | undefined => {
    files.push(file);
    const name = relative(dataDir, file);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      formatErrors.push(`${name}: JSONとして読めません（${(e as Error).message}）`);
      return undefined;
    }
    const r = schema.safeParse(json);
    if (!r.success) {
      for (const issue of r.error.issues) {
        formatErrors.push(`${name}: ${issue.path.join('.')} — ${issue.message}`);
      }
      return undefined;
    }
    return r.data;
  };

  const src = parse(join(dataDir, 'sources.json'), SourcesFileSchema);
  if (src) dataset.sources.push(...src.sources);
  for (const f of jsonFiles(join(dataDir, 'subjects'))) {
    const r = parse(f, SubjectsFileSchema);
    if (r) dataset.subjects.push(...r.subjects);
  }
  for (const f of jsonFiles(join(dataDir, 'questions'))) {
    const r = parse(f, QuestionsFileSchema);
    if (r) dataset.questions.push(...r.questions);
  }
  for (const f of jsonFiles(join(dataDir, 'statistics'))) {
    const r = parse(f, StatisticSchema);
    if (r) dataset.statistics.push(r);
  }
  const generationsFile = join(dataDir, 'generations.json');
  if (existsSync(generationsFile)) {
    const r = parse(generationsFile, GenerationsFileSchema);
    if (r) dataset.generations = r;
  }
  return { dataset, formatErrors, files };
}
