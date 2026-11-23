/**
 * 推理精度の回帰テスト（仮想回答者・「ずれ：小」シナリオ）。
 * データやロジックを変更したときに、精度・校正・質問数が基準を下回らないかを確認する。
 * 詳細な評価は npm run simulate（docs/phase3/simulation-report.md）。
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/engine';
import { loadDataset } from '../../scripts/lib/loadDataset';
import { metrics, SCENARIOS, simulate } from '../../scripts/lib/simulation';

const { dataset } = loadDataset();
const mild = SCENARIOS.find((s) => s.name === 'mild')!;

describe('推理精度の回帰テスト（仮想回答者 81人、10〜90歳）', () => {
  const results = simulate({
    dataset,
    config: DEFAULT_CONFIG,
    scenario: mild,
    referenceYear: 2026,
    perYear: 1,
    seed: 401, // 調整用（201・202）・評価用（301）とは別のシード
  });
  const m = metrics(results);

  it('生年の誤差の中央値は3年以内、±5年以内は85%以上', () => {
    expect(m.medianError).toBeLessThanOrEqual(3);
    expect(m.within5).toBeGreaterThanOrEqual(0.85);
  });

  it('80%区間に正解が入る割合は65〜97%（過信も過度な慎重さもない）', () => {
    expect(m.coverage).toBeGreaterThanOrEqual(0.65);
    expect(m.coverage).toBeLessThanOrEqual(0.97);
  });

  it('確信度「高」で誤差3年超は15%以下', () => {
    expect(m.highWrongRate ?? 0).toBeLessThanOrEqual(0.15);
  });

  it('平均質問数は12〜21問、最大30問以内（3〜5分）', () => {
    expect(m.meanQuestions).toBeGreaterThanOrEqual(12);
    expect(m.meanQuestions).toBeLessThanOrEqual(21);
    expect(m.maxQuestions).toBeLessThanOrEqual(30);
  });
});
