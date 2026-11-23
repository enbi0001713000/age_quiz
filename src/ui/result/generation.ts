/**
 * 世代分類（確認事項 Q7：独自の世代名を主、一般的な世代名を「諸説あり」として併記）。
 */
import type { CommonGeneration, Generations, OriginalGeneration } from '../../data/schema';
import type { Estimate } from '../../engine';

export interface GenerationResult {
  /** 最も確率の高い独自の世代 */
  primary: OriginalGeneration;
  /** その世代に入る確率（校正後の推定確率の合計。モデル上の値） */
  probability: number;
  /** すべての独自の世代とその確率（確率の高い順） */
  ranking: { generation: OriginalGeneration; probability: number }[];
  /** 推定生年（点推定）が含まれる一般的な世代名 */
  common: CommonGeneration[];
}

export function inBand(g: { from: number | null; to: number | null }, year: number): boolean {
  return (g.from === null || year >= g.from) && (g.to === null || year <= g.to);
}

export function classifyGeneration(estimate: Estimate, generations: Generations): GenerationResult {
  const ranking = generations.original
    .map((generation) => ({
      generation,
      probability: estimate.distribution
        .filter((d) => inBand(generation, d.birthYear))
        .reduce((s, d) => s + d.probability, 0),
    }))
    .sort((a, b) => b.probability - a.probability);
  return {
    primary: ranking[0]!.generation,
    probability: ranking[0]!.probability,
    ranking,
    common: generations.common.filter((c) => inBand(c, estimate.birthYear)),
  };
}

export function findGeneration(
  generations: Generations,
  id: string,
): OriginalGeneration | undefined {
  return generations.original.find((g) => g.id === id);
}
