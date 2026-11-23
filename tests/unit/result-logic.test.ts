/**
 * 結果画面まわりのロジック（Phase 5）：世代分類・答え合わせ・回答の特徴・共有文・保存。
 */
import { describe, expect, it } from 'vitest';
import { loadBundledDataset } from '../../src/data/bundle';
import { dataVersion } from '../../src/data/version';
import { buildReport, compileModel, InferenceSession } from '../../src/engine';
import { summarize } from '../../src/engine/estimate';
import {
  addHistory,
  clearHistory,
  deleteHistory,
  HISTORY_KEY,
  HISTORY_MAX,
  loadHistory,
  type HistoryEntry,
} from '../../src/storage/history';
import { loadSettings, saveSettings } from '../../src/storage/settings';
import { memoryStore, type KeyValueStore } from '../../src/storage/storage';
import { birthText } from '../../src/ui/format';
import { checkActualAge, isValidAge } from '../../src/ui/result/answerCheck';
import { classifyGeneration } from '../../src/ui/result/generation';
import { copyText, shareText, xIntentUrl } from '../../src/ui/result/share';
import { answerTraits } from '../../src/ui/result/traits';

const dataset = loadBundledDataset();
const model = compileModel(dataset, { referenceYear: 2026 });
const generations = dataset.generations!;

/** 1点に集中した推定（校正で±2年ほど広がる） */
function estimateAt(year: number) {
  const p = new Float64Array(model.grid.years.length);
  p[model.grid.years.indexOf(year)] = 1;
  return summarize(p, model.grid, model.config);
}

describe('世代分類（Q7）', () => {
  it('独自の世代名は生年の範囲が連続して全生年をカバーし、背景はすべて出典付きの対象に基づく', () => {
    const ids = new Set(dataset.subjects.map((s) => s.id));
    for (const g of generations.original) {
      for (const b of g.background) for (const s of b.subjects) expect(ids.has(s)).toBe(true);
    }
    for (let y = 1931; y <= 2018; y++) {
      const hits = generations.original.filter(
        (g) => (g.from === null || y >= g.from) && (g.to === null || y <= g.to),
      );
      expect(hits, String(y)).toHaveLength(1);
    }
  });

  it('推定生年に応じた独自の世代名を返す', () => {
    expect(classifyGeneration(estimateAt(1975), generations).primary.name).toBe('ファミコン世代');
    expect(classifyGeneration(estimateAt(2005), generations).primary.name).toBe(
      'スマホネイティブ世代',
    );
    expect(classifyGeneration(estimateAt(1945), generations).primary.name).toBe('テレビ黎明世代');
  });

  it('一般的な世代名は出典で確認できた定義の範囲に入る場合だけ併記する', () => {
    const c1972 = classifyGeneration(estimateAt(1972), generations).common.map((c) => c.name);
    expect(c1972).toEqual(['団塊ジュニア']);
    const c1960 = classifyGeneration(estimateAt(1960), generations).common;
    expect(c1960).toEqual([]); // 出典で確認できた一般的な呼び方がない年代
    for (const c of generations.common) expect(c.sources.length).toBeGreaterThan(0);
  });

  it('世代の確率は合計1（モデル上の値）', () => {
    const r = classifyGeneration(estimateAt(1990), generations);
    expect(r.ranking.reduce((s, x) => s + x.probability, 0)).toBeCloseTo(1, 10);
    expect(r.probability).toBe(r.ranking[0]!.probability);
  });
});

describe('答え合わせ（要件 8章）', () => {
  const e = estimateAt(1990); // 推定年齢 33〜38歳あたり
  it('推定範囲内なら「的中」、範囲外なら差を年上・年下で示す', () => {
    const [lo, hi] = e.ageRange;
    expect(checkActualAge(e, lo).verdict).toBe('match');
    expect(checkActualAge(e, hi + 3)).toMatchObject({ verdict: 'older', difference: 3 });
    expect(checkActualAge(e, lo - 2)).toMatchObject({ verdict: 'younger', difference: 2 });
  });
  it('年齢の入力は5〜120歳の整数のみ受け付ける', () => {
    expect(isValidAge(35)).toBe(true);
    expect(isValidAge(3)).toBe(false);
    expect(isValidAge(35.5)).toBe(false);
    expect(isValidAge(130)).toBe(false);
  });
});

describe('回答から読み取れた特徴', () => {
  it('回答の傾向だけを述べ、最も手がかりの強いジャンルを含む', () => {
    const s = new InferenceSession(model, { seed: 3 });
    for (let q = s.nextQuestion(); q; q = s.nextQuestion()) s.answer('x'); // すべて「覚えていない」
    const e = s.estimate();
    const traits = answerTraits(s.answers, buildReport(s, e), e);
    expect(traits.some((t) => t.includes('「覚えていない」が'))).toBe(true);
    for (const t of traits) expect(t).not.toMatch(/性格|職業|経歴|あなたは.*な人/);
  });
});

describe('共有（要件 10章）', () => {
  const e = estimateAt(1990);
  const text = shareText(e, 'SNS世代');
  it('共有文は推定結果だけを含み、URLとハッシュタグを付けられる', () => {
    expect(text).toContain('推定');
    expect(text).toContain('SNS世代');
    expect(copyText(text, 'https://example.com/age_quiz/')).toContain('#年齢推理ゲーム');
  });
  it('Xの投稿画面URLは文章・URL・ハッシュタグをエンコードして渡す', () => {
    const u = new URL(xIntentUrl(text, 'https://example.com/age_quiz/'));
    expect(u.origin).toBe('https://twitter.com');
    expect(u.searchParams.get('text')).toBe(text);
    expect(u.searchParams.get('url')).toBe('https://example.com/age_quiz/');
    expect(u.searchParams.get('hashtags')).toBe('年齢推理ゲーム');
  });
});

describe('プレイ履歴と設定の保存（要件 9章）', () => {
  const entry = (id: string, year = 1990): HistoryEntry => ({
    id,
    playedAt: '2026-11-24T10:00:00.000Z',
    estimate: {
      birthYear: year,
      birthRange: [year - 2, year + 2],
      displayRange: [year - 2, year + 2],
      ageRange: [2026 - year - 3, 2026 - year + 2],
      generationId: 'gen-sns',
      confidence: 'medium',
    },
    engineVersion: '0.1.0',
    dataVersion: 'test',
  });

  it('履歴の見出しは結果画面と同じ表し方（確信度「低」は年代の言葉）', () => {
    const low: HistoryEntry = {
      ...entry('low', 1975),
      estimate: {
        ...entry('low', 1975).estimate,
        birthRange: [1963, 1988],
        displayRange: [1960, 1989],
        confidence: 'low',
      },
    };
    expect(birthText(low.estimate).headline).toBe('1960年代前半〜1980年代後半生まれ');
    expect(birthText(entry('m', 1990).estimate).headline).toBe('1988〜1992年生まれ');
  });

  it('追加は新しい順、削除・全削除ができ、履歴がなければ空', () => {
    const store = memoryStore();
    expect(loadHistory(store)).toEqual([]);
    addHistory(store, entry('a'));
    addHistory(store, entry('b'));
    expect(loadHistory(store).map((e) => e.id)).toEqual(['b', 'a']);
    deleteHistory(store, 'b');
    expect(loadHistory(store).map((e) => e.id)).toEqual(['a']);
    clearHistory(store);
    expect(loadHistory(store)).toEqual([]);
  });

  it(`上限（${HISTORY_MAX}件）を超えると古いものから削除`, () => {
    const store = memoryStore();
    for (let i = 0; i < HISTORY_MAX + 5; i++) addHistory(store, entry(`e${i}`));
    const list = loadHistory(store);
    expect(list).toHaveLength(HISTORY_MAX);
    expect(list[0]!.id).toBe(`e${HISTORY_MAX + 4}`);
  });

  it('壊れたデータは読み飛ばし、保存領域が使えなくても例外を出さない', () => {
    const store = memoryStore();
    store.setItem(HISTORY_KEY, '{"schemaVersion":1,"entries":[{"id":1},{"broken":true}]}');
    expect(loadHistory(store)).toEqual([]);
    store.setItem(HISTORY_KEY, 'not json');
    expect(loadHistory(store)).toEqual([]);
    const failing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadHistory(failing)).toEqual([]);
    expect(addHistory(failing, entry('x'))).toBe(false);
  });

  it('履歴には回答内容・実年齢の項目がない', () => {
    const store = memoryStore();
    addHistory(store, entry('a'));
    const raw = store.getItem(HISTORY_KEY)!;
    expect(raw).not.toMatch(/answers|optionId|actualAge|実年齢/);
  });

  it('設定（演出を短縮）は保存・読み込みでき、不正な値は既定値に戻る', () => {
    const store = memoryStore();
    expect(loadSettings(store).motion).toBe('system');
    saveSettings(store, { motion: 'reduce' });
    expect(loadSettings(store).motion).toBe('reduce');
    store.setItem('agequiz.settings.v1', '{"motion":"weird"}');
    expect(loadSettings(store).motion).toBe('system');
  });
});

describe('データの版', () => {
  it('同じデータなら同じ値、質問数を含む', () => {
    expect(dataVersion(dataset)).toBe(dataVersion(dataset));
    expect(dataVersion(dataset)).toMatch(/^48q-[0-9a-f]{8}$/);
  });
});
