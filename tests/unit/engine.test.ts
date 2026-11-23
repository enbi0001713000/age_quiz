/**
 * 推理エンジンのテスト（Phase 3）。
 * 実データ（48問）でモデルを作り、仕組みの性質と、年代別の回答パターンでの動作を確認する。
 */
import { describe, expect, it } from 'vitest';
import { compileModel, InferenceSession, buildReport, DEFAULT_CONFIG } from '../../src/engine';
import type { CompiledQuestion } from '../../src/engine';
import { summarize, calibrate, highestDensitySet } from '../../src/engine/estimate';
import { optionProbabilities, type ModelContext } from '../../src/engine/optionModel';
import { answerPoints, posteriorFrom } from '../../src/engine/posterior';
import { expectedInformationGain } from '../../src/engine/selector';
import { loadDataset } from '../../scripts/lib/loadDataset';

const REF = 2026;
const { dataset } = loadDataset();
const model = compileModel(dataset, { referenceYear: REF });
const ctx: ModelContext = {
  subjects: new Map(dataset.subjects.map((s) => [s.id, s])),
  stats: new Map(dataset.statistics.map((s) => [s.id, s])),
};
const BASIC = ['NEW-001', 'GAM-001', 'MOB-001', 'APP-001', 'SCH-001'];

/** 生年 b の人として「最も選びやすい選択肢」を答える理想的な回答者 */
function idealAnswer(cq: CompiledQuestion, b: number): string {
  const p = optionProbabilities(cq.question, b, ctx);
  let best = -1;
  p.forEach((v, i) => {
    if (v !== null && (best < 0 || v > p[best]!)) best = i;
  });
  return cq.question.options[best]!.id;
}

function play(b: number, seed = 1, answer = (cq: CompiledQuestion) => idealAnswer(cq, b)) {
  const s = new InferenceSession(model, { seed });
  for (let q = s.nextQuestion(); q; q = s.nextQuestion()) s.answer(answer(q));
  return s;
}

describe('生年候補と事前確率', () => {
  it('生年候補は基準年の95年前〜8年前（88候補）', () => {
    expect(model.grid.years[0]).toBe(REF - 95);
    expect(model.grid.years.at(-1)).toBe(REF - 8);
    expect(model.grid.years).toHaveLength(88);
  });

  it('事前確率は合計1、推理対象（10〜85歳）は一様、その外側は低い（Q5）', () => {
    const p = model.prior;
    expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 10);
    const at = (age: number) => p[model.grid.years.indexOf(REF - age)]!;
    expect(at(20)).toBeCloseTo(at(70), 12);
    expect(at(9)).toBeLessThan(at(20));
    expect(at(90)).toBeLessThan(at(20));
  });
});

describe('回答状態の区別（設計書 5.5）', () => {
  it('「覚えていない」は推定確率を変えない', () => {
    const s = new InferenceSession(model, { seed: 1, basicOrder: BASIC });
    const before = s.posterior();
    const rec = s.answer('x'); // NEW-001 の「覚えていない」
    expect(rec.kind).toBe('dont_remember');
    expect(rec.informative).toBe(false);
    expect(Array.from(s.posterior())).toEqual(Array.from(before));
  });

  it('「該当しない」は推定確率を変えず、関連質問を以後出題しない', () => {
    const s = new InferenceSession(model, {
      seed: 1,
      basicOrder: ['SCH-001', ...BASIC.filter((b) => b !== 'SCH-001')],
    });
    const before = s.posterior();
    s.answer('y'); // SCH-001 の「該当しない」
    expect(Array.from(s.posterior())).toEqual(Array.from(before));
    const asked: string[] = [];
    for (let q = s.nextQuestion(); q; q = s.nextQuestion()) {
      asked.push(q.question.id);
      s.answer(idealAnswer(q, 1990));
    }
    expect(asked).not.toContain('SCH-002'); // SCH-001 の関連質問
  });

  it('「知らない」は推理に使う（推定確率が変わる）', () => {
    const s = new InferenceSession(model, { seed: 1, basicOrder: ['NET-001', ...BASIC] });
    s.answer('a'); // パソコン通信（年代の情報として使われる）
    const rec = s.answers[0]!;
    expect(rec.informative).toBe(true);
    expect(rec.klBits).toBeGreaterThan(0);
  });
});

describe('特定の回答だけで確信度が過度に高くならない（要件 4-3）', () => {
  it('どの質問のどの選択肢でも、1問だけでは80%区間が20年以上・最大確率10%以下', () => {
    for (const cq of model.questions) {
      for (const i of cq.mainOptions) {
        const e = model.config.temperature * cq.weight;
        const post = posteriorFrom(model.prior, answerPoints(cq.likelihood[i]!, e));
        const est = summarize(post, model.grid, model.config);
        expect(est.width, `${cq.question.id}/${i}`).toBeGreaterThanOrEqual(20);
        expect(Math.max(...post), `${cq.question.id}/${i}`).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it('1回答で生年どうしの確率比が動く倍率には上限がある（ランダム回答の混合 λ）', () => {
    const { lapse, temperature } = DEFAULT_CONFIG;
    for (const cq of model.questions) {
      const k = cq.mainOptions.length;
      const bound = ((1 - lapse + lapse / k) / (lapse / k)) ** (temperature * cq.weight);
      for (const i of cq.mainOptions) {
        const l = cq.likelihood[i]!;
        const ratio = (Math.max(...l) / Math.min(...l)) ** (temperature * cq.weight);
        expect(ratio).toBeLessThanOrEqual(bound + 1e-9);
      }
    }
  });

  it('関連質問は2問目以降の証拠の重みが割り引かれる', () => {
    const s = new InferenceSession(model, { seed: 1, basicOrder: ['MOB-001', 'MOB-003'] });
    const first = s.answer(idealAnswer(s.nextQuestion()!, 1975));
    const second = s.answer(idealAnswer(s.nextQuestion()!, 1975));
    const w = (id: string) => model.byId.get(id)!.weight * DEFAULT_CONFIG.temperature;
    expect(first.exponent).toBeCloseTo(w('MOB-001'));
    expect(second.exponent).toBeCloseTo(w('MOB-003') * DEFAULT_CONFIG.relatedDiscount);
  });
});

describe('期待情報利得と質問選択', () => {
  it('期待情報利得は0以上で、事前確率の状態では年代を広く分ける質問ほど大きい', () => {
    const gains = model.questions.map((cq) => ({
      id: cq.question.id,
      gain: expectedInformationGain(model.prior, cq, DEFAULT_CONFIG.temperature * cq.weight),
    }));
    for (const g of gains) expect(g.gain).toBeGreaterThanOrEqual(0);
    const byId = new Map(gains.map((g) => [g.id, g.gain]));
    // 全年代を分ける時代選択型（消費税）は、ごく一部の人しか経験しない題材（ショルダーホン）より大きい
    expect(byId.get('NEW-001')!).toBeGreaterThan(byId.get('MOB-004')!);
  });

  it('同じ質問を2回出題しない', () => {
    for (const b of [1950, 1985, 2010]) {
      const ids = play(b).answers.map((a) => a.questionId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('基本質問は共通プールから5問（Q6）。シードが違えば組み合わせが変わる', () => {
    const pool = new Set(model.basicPool.map((q) => q.question.id));
    const sets = [1, 2, 3, 4, 5, 6].map((seed) => {
      const s = new InferenceSession(model, { seed });
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const q = s.nextQuestion()!;
        expect(s.phase).toBe('basic');
        ids.push(q.question.id);
        s.answer(idealAnswer(q, 1990));
      }
      expect(s.phase).not.toBe('basic');
      for (const id of ids) expect(pool.has(id)).toBe(true);
      return ids.sort().join(',');
    });
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it('同じシード・同じ回答なら同じ展開になる（再現性）', () => {
    const a = play(1988, 42).answers.map((r) => r.questionId);
    const b = play(1988, 42).answers.map((r) => r.questionId);
    expect(a).toEqual(b);
  });
});

describe('終了判定', () => {
  it('最低10問より前には終了しない', () => {
    for (const b of [1940, 1970, 2000, 2015]) {
      expect(play(b).answers.length).toBeGreaterThanOrEqual(
        DEFAULT_CONFIG.termination.minQuestions,
      );
    }
  });

  it('すべて「覚えていない」なら情報が増えず、上限の25問で終了し、確信度は低い', () => {
    const s = play(1990, 1, () => 'x');
    expect(s.answers.length).toBe(DEFAULT_CONFIG.termination.maxQuestions);
    expect(s.reason).toBe('max_questions');
    expect(s.estimate().confidence).toBe('low');
  });

  it('プレイ時間が上限を超えたら、その回答で終了する', () => {
    const s = new InferenceSession(model, { seed: 1, startedAt: 0 });
    s.answer(idealAnswer(s.nextQuestion()!, 1990), 7 * 60 * 1000);
    expect(s.reason).toBe('time');
    expect(s.nextQuestion()).toBeNull();
  });
});

describe('推定結果の計算（設計書 5.10）', () => {
  const pointMass = (year: number) => {
    const p = new Float64Array(model.grid.years.length);
    p[model.grid.years.indexOf(year)] = 1;
    return p;
  };

  it('校正後の確率は合計1で、1点に集中した推定でも幅を持つ（σ=1.5 → 80%区間は5年）', () => {
    const est = summarize(pointMass(1990), model.grid, model.config);
    expect(est.distribution.reduce((s, d) => s + d.probability, 0)).toBeCloseTo(1, 10);
    expect(est.birthYear).toBe(1990);
    expect(est.birthRange).toEqual([1988, 1992]);
    expect(est.width).toBe(5);
    expect(est.confidence).toBe('high');
  });

  it('年齢は誕生日の前後を含む範囲で表す（満年齢を断定しない）', () => {
    const est = summarize(pointMass(1990), model.grid, model.config);
    expect(est.displayRange).toEqual([1990, 1990]);
    expect(est.ageRange).toEqual([REF - 1990 - 1, REF - 1990]);
  });

  it('確信度が低いときは、生年を5年単位に丸めた広い範囲で表す', () => {
    const est = summarize(model.prior, model.grid, model.config);
    expect(est.confidence).toBe('low');
    expect(est.displayRange[0] % 5).toBe(0);
    expect((est.displayRange[1] + 1) % 5).toBe(0);
  });

  it('離れた2つの年代に候補が分かれている場合は検出し、確信度を高にしない', () => {
    const p = new Float64Array(model.grid.years.length);
    p[model.grid.years.indexOf(1960)] = 0.5;
    p[model.grid.years.indexOf(2000)] = 0.5;
    const est = summarize(p, model.grid, model.config);
    expect(est.multimodal).toBe(true);
    expect(est.modes.map((m) => m.center).sort()).toEqual([1960, 2000]);
    expect(est.confidence).toBe('low');
  });

  it('80%区間は確率の高い順に80%に達するまでの集合（同じ確率の生年はまとめて含め、偏らせない）', () => {
    const p = calibrate(pointMass(1980), 1.5);
    const set = highestDensitySet(p, 0.8);
    const mass = set.reduce((s, i) => s + p[i]!, 0);
    expect(mass).toBeGreaterThanOrEqual(0.8);
    const years = set.map((i) => model.grid.years[i]!);
    expect(years).toEqual([1978, 1979, 1980, 1981, 1982]);
  });

  it('同じ確率の生年がない場合は、80%に達した時点で止める（最小の集合）', () => {
    const p = new Float64Array([0.5, 0.31, 0.12, 0.07]);
    expect(highestDensitySet(p, 0.8)).toEqual([0, 1]);
  });
});

describe('年代別の回答パターン（理想的な回答者）', () => {
  it.each([1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010])(
    '%i年生まれ：推定誤差3年以内、実際の生年が80%区間に入る',
    (b) => {
      const est = play(b, b).estimate();
      expect(Math.abs(est.birthYear - b)).toBeLessThanOrEqual(3);
      expect(b).toBeGreaterThanOrEqual(est.birthRange[0]);
      expect(b).toBeLessThanOrEqual(est.birthRange[1]);
    },
  );
});

describe('回答が矛盾した場合', () => {
  it('前半を1960年生まれ、後半を2005年生まれとして答えると、意外な回答を検出し確信度は高にならない', () => {
    let n = 0;
    const s = play(0, 7, (cq) => idealAnswer(cq, n++ < 6 ? 1960 : 2005));
    expect(s.surpriseCount).toBeGreaterThan(0);
    expect(s.estimate().confidence).not.toBe('high');
  });
});

describe('推理レポート', () => {
  it('影響の大きい回答から最大5件、支持する生年の範囲つきで返す', () => {
    const s = play(1985, 3);
    const r = buildReport(s, s.estimate());
    expect(r.keyAnswers.length).toBeGreaterThan(0);
    expect(r.keyAnswers.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < r.keyAnswers.length; i++) {
      expect(r.keyAnswers[i - 1]!.influence).toBeGreaterThanOrEqual(r.keyAnswers[i]!.influence);
    }
    expect(r.genreInfluence.length).toBeGreaterThan(0);
    const top = r.decadePoints.reduce((a, b) => (b.points > a.points ? b : a));
    expect(top.decade).toBe(1980);
  });
});
