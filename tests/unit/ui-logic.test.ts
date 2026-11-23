/**
 * 画面ロジック（Phase 4）のテスト：同梱データ・ゲーム進行・表示用の文言。
 */
import { describe, expect, it } from 'vitest';
import { loadBundledDataset } from '../../src/data/bundle';
import { compileModel, type Estimate } from '../../src/engine';
import { GameFlow, RADAR_INTERVAL } from '../../src/ui/game/flow';
import { ageText, birthText, eraRangeLabel, halfDecadeLabel } from '../../src/ui/format';
import { loadDataset } from '../../scripts/lib/loadDataset';

describe('同梱データ（実行時に読み込むデータ）', () => {
  it('検査済みのデータ（Zodで形式検査したもの）と完全に一致する', () => {
    const validated = loadDataset();
    expect(validated.formatErrors).toEqual([]);
    expect(loadBundledDataset()).toEqual(validated.dataset);
  });
});

describe('ゲーム進行', () => {
  const model = compileModel(loadBundledDataset(), { referenceYear: 2026 });

  /** 最初の主要選択肢を答え続ける */
  function playThrough(seed: number) {
    const flow = new GameFlow(model, { seed, startedAt: 0 });
    const log: { progress: number; events: string[]; phase: string }[] = [];
    for (let v = flow.view(); !v.finished; v = flow.view()) {
      const events = flow.answer(v.question!.options[0]!.id, 0);
      log.push({ progress: flow.view().progress, events, phase: flow.view().phase });
    }
    return { flow, log };
  }

  it('最初の質問は基本質問で、問番号・選択肢キー（A〜）・ステータスを持つ', () => {
    const v = new GameFlow(model, { seed: 1, startedAt: 0 }).view();
    expect(v.question!.number).toBe(1);
    expect(v.question!.phase).toBe('basic');
    expect(v.question!.options.map((o) => o.key).slice(0, 2)).toEqual(['A', 'B']);
    expect(v.question!.specialOptions.some((o) => o.kind === 'dont_remember')).toBe(true);
    expect(v.status).toBe('基本スキャン中（1/5）');
    expect(v.radar).toBeNull();
  });

  it('解析進捗は単調に増え、終了時に100%になる', () => {
    const { log } = playThrough(3);
    for (let i = 1; i < log.length; i++) {
      expect(log[i]!.progress).toBeGreaterThanOrEqual(log[i - 1]!.progress);
    }
    expect(log.at(-1)!.progress).toBe(1);
    expect(log.slice(0, -1).every((l) => l.progress < 1)).toBe(true);
  });

  it('基本質問が終わると「追加質問への移行」が1回だけ起きる', () => {
    const { log } = playThrough(5);
    const changes = log.flatMap((l, i) => (l.events.includes('phase_change') ? [i] : []));
    expect(changes).toEqual([4]); // 5問目の回答後
  });

  it('推定年代レーダーは数問ごと（3問ごと、および追加質問への移行時）に更新される', () => {
    const { log } = playThrough(7);
    const updates = log.flatMap((l, i) => (l.events.includes('radar_update') ? [i + 1] : []));
    for (const n of updates) expect(n % RADAR_INTERVAL === 0 || n === 5).toBe(true);
    expect(updates.length).toBeGreaterThanOrEqual(3);
  });

  it('終了イベントは最後の回答でだけ起き、終了後は質問がない', () => {
    const { flow, log } = playThrough(9);
    expect(log.at(-1)!.events).toContain('finished');
    expect(log.slice(0, -1).some((l) => l.events.includes('finished'))).toBe(false);
    expect(flow.view().question).toBeNull();
    expect(flow.view().status).toBe('分析完了');
  });
});

describe('表示用の文言', () => {
  it('年代の言葉：前半・後半、同じ年代の前半〜後半はまとめる', () => {
    expect(halfDecadeLabel(1985)).toBe('1980年代後半');
    expect(halfDecadeLabel(1990)).toBe('1990年代前半');
    expect(eraRangeLabel(1985, 1999)).toBe('1980年代後半〜1990年代後半');
    expect(eraRangeLabel(1990, 1999)).toBe('1990年代');
    expect(eraRangeLabel(1990, 1994)).toBe('1990年代前半');
  });

  const base = {
    birthYear: 1992,
    birthRange: [1990, 1994],
    ageRange: [33, 34],
  } as const;

  it('確信度「高」は1年単位＋推定範囲、「中」は範囲、「低」は年代の言葉', () => {
    const high = { ...base, confidence: 'high', displayRange: [1992, 1992] } as unknown as Estimate;
    expect(birthText(high)).toEqual({ headline: '1992年生まれ', detail: '推定範囲 1990〜1994年' });
    const medium = {
      ...base,
      confidence: 'medium',
      displayRange: [1988, 1993],
    } as unknown as Estimate;
    expect(birthText(medium).headline).toBe('1988〜1993年生まれ');
    const low = { ...base, confidence: 'low', displayRange: [1985, 1999] } as unknown as Estimate;
    expect(birthText(low)).toEqual({
      headline: '1980年代後半〜1990年代後半生まれ',
      detail: '1985〜1999年',
    });
  });

  it('年齢は範囲で表す（満年齢を断定しない）', () => {
    expect(ageText({ ageRange: [33, 34] } as unknown as Estimate)).toBe('33〜34歳');
  });
});
