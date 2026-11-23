/**
 * 検証ルールが不正なデータを確実に検出することのテスト（壊したデータを与えて確認する）。
 */
import { describe, expect, it } from 'vitest';
import type { Dataset, Question, Subject } from '../../src/data/schema';
import { SubjectSchema } from '../../src/data/schema';
import { validateDataset } from '../../src/data/validate';

function baseDataset(): Dataset {
  const subject: Subject = {
    id: 'item',
    name: '商品',
    genre: 'toy',
    kind: 'trend',
    facts: {
      start: { date: '1990', status: 'verified', sources: ['src-a'] },
      end: { date: '1995', status: 'verified', sources: ['src-a'] },
    },
    model: {
      ageWindow: { value: [6, 12], status: 'estimated', rationale: 'テスト' },
      ceiling: { value: 0.5, status: 'estimated', rationale: 'テスト' },
      floor: 0.03,
      awareness: { floor: 0.2, ceiling: 0.9, rationale: 'テスト' },
    },
  };
  const question: Question = {
    id: 'TOY-001',
    status: 'verified',
    genre: 'toy',
    difficulty: 'easy',
    type: 'experience',
    text: '遊んだことはありますか？',
    subject: 'item',
    options: [
      { id: 'a', label: 'よく遊んだ', kind: 'heavy' },
      { id: 'b', label: '少し遊んだ', kind: 'light' },
      { id: 'c', label: '知っているが遊んでいない', kind: 'aware_only' },
      { id: 'd', label: '知らない', kind: 'unaware' },
      { id: 'x', label: '覚えていない', kind: 'dont_remember' },
    ],
    importance: 1,
    priority: 1,
    relatedIds: [],
    basicPool: false,
  };
  return {
    sources: [
      {
        id: 'src-a',
        title: '公式',
        publisher: 'メーカー',
        url: 'https://example.com/a',
        type: 'official',
        accessed: '2026-11-23',
        reliability: 'A',
      },
      {
        id: 'src-c',
        title: '百科事典',
        publisher: '百科事典サイト',
        url: 'https://example.com/c',
        type: 'encyclopedia',
        accessed: '2026-11-23',
        reliability: 'C',
      },
    ],
    subjects: [subject],
    questions: [question],
    statistics: [],
  };
}

const errorsOf = (d: Dataset) => validateDataset(d).errors;

describe('validateDataset', () => {
  it('正しいデータではエラーなし', () => {
    expect(errorsOf(baseDataset())).toEqual([]);
  });

  it('未登録の出典を参照するとエラー', () => {
    const d = baseDataset();
    d.subjects[0]!.facts.start!.sources = ['src-missing'];
    expect(errorsOf(d).join()).toContain('出典 src-missing が未登録');
  });

  it('信頼性Cの出典だけを根拠にした事実はエラー（補助出典は単独根拠不可）', () => {
    const d = baseDataset();
    d.subjects[0]!.facts.start!.sources = ['src-c'];
    expect(errorsOf(d).join()).toContain('信頼性Cの出典だけ');
  });

  it('信頼性Cの出典でも、A/Bの出典と併用していればエラーにならない', () => {
    const d = baseDataset();
    d.subjects[0]!.facts.start!.sources = ['src-a', 'src-c'];
    expect(errorsOf(d)).toEqual([]);
  });

  it('開始が終了より後ならエラー', () => {
    const d = baseDataset();
    d.subjects[0]!.facts.start!.date = '2000';
    expect(errorsOf(d).join()).toContain('開始（2000）が終了（1995）より後');
  });

  it('derived の事実に導出規則がないとエラー', () => {
    const d = baseDataset();
    d.subjects[0]!.facts.start!.status = 'derived';
    expect(errorsOf(d).join()).toContain('導出規則');
  });

  it('主要選択肢が4個未満ならエラー（特殊回答は数えない）', () => {
    const d = baseDataset();
    d.questions[0]!.options = d.questions[0]!.options.filter((o) => o.kind !== 'light');
    expect(errorsOf(d).join()).toContain('主要選択肢は4〜6個');
  });

  it('「覚えていない」がないとエラー', () => {
    const d = baseDataset();
    d.questions[0]!.options = d.questions[0]!.options.filter((o) => o.kind !== 'dont_remember');
    expect(errorsOf(d).join()).toContain('覚えていない');
  });

  it('未登録の対象・関連質問を参照するとエラー', () => {
    const d = baseDataset();
    d.questions[0]!.subject = 'nothing';
    d.questions[0]!.relatedIds = ['TOY-999'];
    const e = errorsOf(d).join();
    expect(e).toContain('対象 nothing が未登録');
    expect(e).toContain('関連質問 TOY-999 が未登録');
  });

  it('時代選択型に ageWindow や時代の選択肢がないとエラー', () => {
    const d = baseDataset();
    const q = d.questions[0]!;
    q.type = 'era_choice';
    delete q.subject;
    const e = errorsOf(d).join();
    expect(e).toContain('ageWindow が必要');
    expect(e).toContain('時代の選択肢が2つ以上必要');
  });

  it('流行の終わりが決められない対象（end・peak・activeUntil なし）はエラー', () => {
    const d = baseDataset();
    delete d.subjects[0]!.facts.end;
    expect(errorsOf(d).join()).toContain('model.activeUntil が必要');
  });
});

describe('SubjectSchema（形式）', () => {
  it('事実に出典がない場合は形式エラー', () => {
    const s = baseDataset().subjects[0]!;
    const broken = { ...s, facts: { start: { date: '1990', status: 'verified', sources: [] } } };
    expect(SubjectSchema.safeParse(broken).success).toBe(false);
  });

  it('発売年などの事実に「推定（estimated）」は使えない', () => {
    const s = baseDataset().subjects[0]!;
    const broken = {
      ...s,
      facts: { start: { date: '1990', status: 'estimated', sources: ['src-a'] } },
    };
    expect(SubjectSchema.safeParse(broken).success).toBe(false);
  });
});
