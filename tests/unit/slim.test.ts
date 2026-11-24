/**
 * 本番ビルドの同梱データの軽量化（src/data/slim.ts）が推理に影響しないことの確認。
 * 出典の引用文・導出規則・推定の根拠・注記を除いたデータでも、推理モデル（尤度表・重み・関連）と
 * 1プレイの結果が完全に一致すること。
 */
import { describe, expect, it } from 'vitest';
import { loadBundledDataset } from '../../src/data/bundle';
import { RUNTIME_UNUSED_KEYS, slimData } from '../../src/data/slim';
import { compileModel, InferenceSession } from '../../src/engine';

const full = loadBundledDataset();
const slim = {
  ...full,
  subjects: full.subjects.map((s) => slimData(s)),
  questions: full.questions.map((q) => slimData(q)),
};

describe('同梱データの軽量化', () => {
  it('説明用の項目（引用文・規則・根拠・注記）を除き、ほかの項目は残す', () => {
    const json = JSON.stringify({ subjects: slim.subjects, questions: slim.questions });
    for (const key of RUNTIME_UNUSED_KEYS) expect(json).not.toContain(`"${key}":`);
    expect(slim.subjects.length).toBe(full.subjects.length);
    expect(slim.questions.map((q) => q.text)).toEqual(full.questions.map((q) => q.text));
    // 1割以上小さくなる
    const fullJson = JSON.stringify({ subjects: full.subjects, questions: full.questions });
    expect(json.length).toBeLessThan(fullJson.length * 0.9);
  });

  it('推理モデル（尤度表・重み・関連質問・基本質問）が完全に一致する', () => {
    const a = compileModel(full, { referenceYear: 2026 });
    const b = compileModel(slim, { referenceYear: 2026 });
    expect(Array.from(b.prior)).toEqual(Array.from(a.prior));
    expect(b.questions.length).toBe(a.questions.length);
    a.questions.forEach((qa, i) => {
      const qb = b.questions[i]!;
      expect(qb.question.id).toBe(qa.question.id);
      expect(qb.weight).toBe(qa.weight);
      expect([...qb.related].sort()).toEqual([...qa.related].sort());
      qa.likelihood.forEach((l, j) => {
        expect(qb.likelihood[j] ? Array.from(qb.likelihood[j]!) : null).toEqual(
          l ? Array.from(l) : null,
        );
      });
    });
    expect(b.basicPool.map((q) => q.question.id)).toEqual(a.basicPool.map((q) => q.question.id));
  });

  it('同じ乱数と同じ回答なら、1プレイの推定結果も一致する', () => {
    const play = (data: typeof full) => {
      const s = new InferenceSession(compileModel(data, { referenceYear: 2026 }), { seed: 42 });
      for (let q = s.nextQuestion(), i = 0; q; q = s.nextQuestion(), i++) {
        s.answer(q.question.options[i % q.question.options.length]!.id);
      }
      return s.estimate();
    };
    expect(play(slim)).toEqual(play(full));
  });
});
