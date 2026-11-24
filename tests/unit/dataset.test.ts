/**
 * 実データ（data/）の品質テスト。
 * 形式・整合性に加え、統計から導いた期間の再計算と、代表的な質問の振る舞いを確認する。
 */
import { describe, expect, it } from 'vitest';
import { GENRES, SPECIAL_OPTION_KINDS } from '../../src/data/schema';
import { questionReliability, validateDataset } from '../../src/data/validate';
import { optionProbabilities, type ModelContext } from '../../src/engine/optionModel';
import { loadDataset } from '../../scripts/lib/loadDataset';

const { dataset, formatErrors } = loadDataset();
const ctx: ModelContext = {
  subjects: new Map(dataset.subjects.map((s) => [s.id, s])),
  stats: new Map(dataset.statistics.map((s) => [s.id, s])),
};
const question = (id: string) => dataset.questions.find((q) => q.id === id)!;
const subject = (id: string) => dataset.subjects.find((s) => s.id === id)!;

/** 生年 b の人が最も選びやすい選択肢のラベル */
function mostLikely(qid: string, b: number): string {
  const q = question(qid);
  const p = optionProbabilities(q, b, ctx);
  let best = -1;
  p.forEach((v, i) => {
    if (v !== null && (best < 0 || v > p[best]!)) best = i;
  });
  return q.options[best]!.label;
}

describe('データの形式と整合性', () => {
  it('形式エラーがない', () => {
    expect(formatErrors).toEqual([]);
  });

  it('整合性エラーがない（参照切れ・出典ルール・選択肢数など）', () => {
    expect(validateDataset(dataset).errors).toEqual([]);
  });

  it('200〜300問で、12ジャンルすべてを含み、どのジャンルも15問以上・ジャンル間の差は5問以内（Phase 6）', () => {
    const verified = dataset.questions.filter((q) => q.status === 'verified');
    expect(verified.length).toBeGreaterThanOrEqual(200);
    expect(verified.length).toBeLessThanOrEqual(300);
    const counts = GENRES.map((g) => verified.filter((q) => q.genre === g).length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(5);
  });

  it('難易度の配分：EASY・NORMAL・HARD のすべてがあり、NORMAL が最も多い', () => {
    const n = (d: string) => dataset.questions.filter((q) => q.difficulty === d).length;
    expect(n('easy')).toBeGreaterThan(0);
    expect(n('hard')).toBeGreaterThan(0);
    expect(n('normal')).toBeGreaterThan(Math.max(n('easy'), n('hard')));
  });

  it('同じ文の質問がない（重複の検査）', () => {
    const texts = dataset.questions.map((q) => q.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('すべての質問の信頼性が A または B（信頼性Cのみの根拠はない）', () => {
    for (const q of dataset.questions) {
      expect(['A', 'B'], q.id).toContain(questionReliability(q, dataset));
    }
  });

  it('基本質問プールは時代選択型のEASY問題で、8問以上ある', () => {
    const pool = dataset.questions.filter((q) => q.basicPool);
    expect(pool.length).toBeGreaterThanOrEqual(8);
    for (const q of pool) {
      expect(q.type, q.id).toBe('era_choice');
      expect(q.difficulty, q.id).toBe('easy');
    }
  });
});

describe('選択肢の確率モデル（全質問・全生年）', () => {
  it('主要選択肢の確率の合計は1、特殊回答（覚えていない・該当しない）は計算しない', () => {
    for (const q of dataset.questions) {
      for (let b = 1931; b <= 2018; b++) {
        const p = optionProbabilities(q, b, ctx);
        const sum = p.reduce<number>((s, v) => s + (v ?? 0), 0);
        expect(sum, `${q.id} ${b}`).toBeCloseTo(1, 6);
        q.options.forEach((o, i) => {
          if (SPECIAL_OPTION_KINDS.includes(o.kind)) expect(p[i], `${q.id}/${o.id}`).toBeNull();
          else expect(Number.isFinite(p[i]), `${q.id}/${o.id} ${b}`).toBe(true);
        });
      }
    }
  });
});

describe('代表的な質問の振る舞い（事実との整合）', () => {
  it('小学生の頃のゲーム機：1977年生まれはファミコン、2010年生まれは Switch', () => {
    expect(mostLikely('GAM-001', 1977)).toBe('ファミリーコンピュータ');
    expect(mostLikely('GAM-001', 2010)).toBe('Nintendo Switch');
  });

  it('小学生の頃の消費税：1960年生まれは「なかった」、1982年生まれは3%、1995年生まれは5%', () => {
    expect(mostLikely('NEW-001', 1960)).toBe('消費税はなかった');
    expect(mostLikely('NEW-001', 1982)).toBe('3%');
    expect(mostLikely('NEW-001', 1995)).toBe('5%');
  });

  it('消費税が導入された年（1989年4月）は、導入後の3%として扱う', () => {
    // 6〜12歳が1985〜1991年の人（1979年生まれ）でも「3%」の確率が無視できない
    const q = question('NEW-001');
    const p = optionProbabilities(q, 1979, ctx);
    const idx3 = q.options.findIndex((o) => o.label === '3%');
    expect(p[idx3]!).toBeGreaterThan(0.3);
  });

  it('小学生の頃の土曜日：1975年生まれは毎週授業、2000年生まれは毎週休み', () => {
    expect(mostLikely('SCH-001', 1975)).toBe('毎週授業があった');
    expect(mostLikely('SCH-001', 2000)).toBe('毎週休みだった');
  });

  it('小学生の頃のテレビ：1945年生まれは「なかった」、1955年生まれは白黒、1980年生まれはカラー', () => {
    expect(mostLikely('APP-001', 1945)).toBe('家にテレビはなかった');
    expect(mostLikely('APP-001', 1955)).toBe('白黒テレビ');
    expect(mostLikely('APP-001', 1980)).toBe('カラーテレビ（白黒ではなかった）');
  });
});

describe('統計から導いた期間の再計算（derived の事実が統計と一致するか）', () => {
  const stat = (id: string) => dataset.statistics.find((s) => s.id === id)!;

  /** 系列の値が最大値の ratio 以上になる最初と最後の年 */
  function rangeAtLeast(series: Record<string, number>, ratio: number): [string, string] {
    const max = Math.max(...Object.values(series));
    const years = Object.keys(series)
      .filter((y) => series[y]! >= ratio * max)
      .sort();
    return [years[0]!, years[years.length - 1]!];
  }

  it.each([
    ['record-era', 'analog_disc', 0.5],
    ['cassette-era', 'cassette', 0.5],
    ['cd-era', 'cd_total', 0.5],
    ['cd-8cm-single', 'cd_8cm', 0.1],
  ] as const)(
    '%s の流行期は日本レコード協会の統計（%s）から再計算した値と一致',
    (sid, key, ratio) => {
      const series = stat('riaj-music-production').series[key]!;
      const peak = subject(sid).facts.peak!;
      expect([peak.from, peak.to]).toEqual(rangeAtLeast(series, ratio));
    },
  );

  it('テレビの時代区分は内閣府の普及率から再計算した値と一致', () => {
    const s = stat('cao-durables-penetration').series;
    const firstSurveyOfYear = (series: Record<string, number>, y: number) =>
      Object.entries(series).find(([k]) => k.startsWith(String(y)))?.[1];
    const years = Array.from({ length: 30 }, (_, i) => 1955 + i);
    const bw = (y: number) => firstSurveyOfYear(s.bw_tv!, y) ?? 0;
    const color = (y: number) => firstSurveyOfYear(s.color_tv!, y) ?? 0;
    const bwEra = years.filter((y) => bw(y) >= 50 && color(y) < 30);
    const transition = years.filter((y) => bw(y) >= 30 && color(y) >= 30);
    const colorStart = years.find((y) => color(y) >= 50 && bw(y) < 30);
    expect(subject('tv-era-bw').facts.peak).toMatchObject({
      from: String(bwEra[0]),
      to: String(bwEra[bwEra.length - 1]),
    });
    expect(subject('tv-era-transition').facts.peak).toMatchObject({
      from: String(transition[0]),
      to: String(transition[transition.length - 1]),
    });
    expect(subject('tv-era-color').facts.start?.date).toBe(String(colorStart));
  });

  it('録画機器の時代区分は内閣府の普及率（VTR・光ディスク）から再計算した値と一致', () => {
    const vtr = stat('cao-durables-penetration').series.vtr!;
    const disc = stat('cao-durables-penetration-2plus').series.optical_disc!;
    const firstYear = (series: Record<string, number>, min: number) =>
      Object.keys(series)
        .sort()
        .find((k) => series[k]! >= min)!
        .slice(0, 4);
    const vhsFrom = firstYear(vtr, 50);
    const discFrom = firstYear(disc, 50);
    expect(subject('rec-vhs-era').facts.peak).toMatchObject({
      from: vhsFrom,
      to: String(Number(discFrom) - 1),
    });
    expect(subject('rec-disc-era').facts.start?.date).toBe(discFrom);
  });

  it('世帯保有型の対象は、統計系列が存在する', () => {
    for (const s of dataset.subjects.filter((x) => x.kind === 'household')) {
      const ref = s.facts.series!;
      expect(stat(ref.statId)?.series[ref.key], s.id).toBeDefined();
    }
  });
});
