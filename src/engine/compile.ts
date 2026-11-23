/**
 * データ一式から推理用のモデル（生年候補・事前確率・各質問の尤度表）を作る。
 * プレイ開始時に1回だけ計算する（48問×88生年で数ミリ秒）。
 */
import type { Dataset, Question, Reliability } from '../data/schema';
import { questionReliability } from '../data/validate';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { normalizeInPlace } from './math';
import { isSpecialOption, optionProbabilities, type ModelContext } from './optionModel';

/** 生年候補（設計書 5.2：基準年の95年前〜8年前、1年刻み） */
export interface BirthGrid {
  referenceYear: number;
  years: number[];
}

export interface CompiledQuestion {
  question: Question;
  reliability: Reliability;
  /** 証拠の重み w = 重要度 × 信頼性の重み */
  weight: number;
  /** 主要選択肢（特殊回答を除く）の index */
  mainOptions: number[];
  /** モデルの確率 P(選択肢|生年)。特殊回答は null */
  raw: (Float64Array | null)[];
  /** ランダム回答を混ぜた尤度 L = (1−λ)P + λ/K。特殊回答は null */
  likelihood: (Float64Array | null)[];
  /** 同じ情報を持つ質問（関連グループ・関連質問ID） */
  related: Set<string>;
}

export interface EngineModel {
  config: EngineConfig;
  grid: BirthGrid;
  prior: Float64Array;
  questions: CompiledQuestion[];
  byId: Map<string, CompiledQuestion>;
  /** 基本質問プール */
  basicPool: CompiledQuestion[];
}

export function createBirthGrid(referenceYear: number, config: EngineConfig): BirthGrid {
  const { oldestAge, youngestAge } = config.birthYears;
  const years: number[] = [];
  for (let b = referenceYear - oldestAge; b <= referenceYear - youngestAge; b++) years.push(b);
  return { referenceYear, years };
}

/** 事前確率：推理対象（10〜85歳）は一様、その外側は緩やかに下げる（Q5） */
export function createPrior(grid: BirthGrid, config: EngineConfig): Float64Array {
  const { fullFromAge, fullToAge, edgeWeight } = config.prior;
  const p = new Float64Array(grid.years.length);
  grid.years.forEach((b, i) => {
    const age = grid.referenceYear - b;
    p[i] = age < fullFromAge || age > fullToAge ? edgeWeight : 1;
  });
  return normalizeInPlace(p);
}

function relatedMap(questions: Question[]): Map<string, Set<string>> {
  const map = new Map(questions.map((q) => [q.id, new Set<string>()]));
  const link = (a: string, b: string) => {
    if (a === b || !map.has(a) || !map.has(b)) return;
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  };
  for (const q of questions) {
    for (const r of q.relatedIds) link(q.id, r);
    if (!q.group) continue;
    for (const other of questions) if (other.group === q.group) link(q.id, other.id);
  }
  return map;
}

export interface CompileOptions {
  referenceYear: number;
  config?: EngineConfig;
}

export function compileModel(dataset: Dataset, options: CompileOptions): EngineModel {
  const config = options.config ?? DEFAULT_CONFIG;
  const grid = createBirthGrid(options.referenceYear, config);
  const ctx: ModelContext = {
    subjects: new Map(dataset.subjects.map((s) => [s.id, s])),
    stats: new Map(dataset.statistics.map((s) => [s.id, s])),
  };
  const verified = dataset.questions.filter((q) => q.status === 'verified');
  const related = relatedMap(verified);

  const questions = verified.map((question): CompiledQuestion => {
    const rows = grid.years.map((b) => optionProbabilities(question, b, ctx));
    const mainOptions = question.options.flatMap((o, i) => (isSpecialOption(o) ? [] : [i]));
    const k = mainOptions.length;
    const raw = question.options.map((o, i) =>
      isSpecialOption(o) ? null : Float64Array.from(rows, (r) => r[i]!),
    );
    const likelihood = raw.map((r) =>
      r ? Float64Array.from(r, (v) => (1 - config.lapse) * v + config.lapse / k) : null,
    );
    const reliability = questionReliability(question, dataset);
    return {
      question,
      reliability,
      weight: question.importance * config.reliabilityWeight[reliability],
      mainOptions,
      raw,
      likelihood,
      related: related.get(question.id)!,
    };
  });

  return {
    config,
    grid,
    prior: createPrior(grid, config),
    questions,
    byId: new Map(questions.map((q) => [q.question.id, q])),
    basicPool: questions.filter((q) => q.question.basicPool),
  };
}
