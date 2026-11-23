import { describe, expect, it } from 'vitest';
import type { Statistic, Subject } from '../../src/data/schema';
import {
  activity,
  estimateExperience,
  seriesValueAt,
  yearOf,
  type StatisticsIndex,
} from '../../src/engine/exposure';

const noStats: StatisticsIndex = new Map();

/** テスト用の対象（1990年発売、1990〜1994年が流行期、10〜15歳が中心） */
function trendSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: 'test-item',
    name: 'テスト商品',
    genre: 'toy',
    kind: 'trend',
    facts: {
      start: { date: '1990', status: 'verified', sources: ['src-x'] },
      peak: { from: '1990', to: '1994', status: 'verified', sources: ['src-x'] },
    },
    model: {
      ageWindow: { value: [10, 15], status: 'estimated', rationale: 'テスト' },
      ceiling: { value: 0.8, status: 'estimated', rationale: 'テスト' },
      floor: 0.02,
      awareness: { floor: 0.1, ceiling: 0.95, rationale: 'テスト' },
    },
    ...overrides,
  };
}

describe('yearOf', () => {
  it('年・年月・年月日を小数の年に変換する', () => {
    expect(yearOf('1990')).toBe(1990);
    expect(yearOf('1990-07')).toBeCloseTo(1990.5);
    expect(yearOf('1990-01-15')).toBe(1990);
  });
});

describe('seriesValueAt（統計の補間）', () => {
  const series = { '1960-02': 10, '1970-02': 50 };
  it('調査時点の間は直線で補間する', () => {
    expect(seriesValueAt(series, yearOf('1965-02'))).toBeCloseTo(30);
  });
  it('最初の調査より1年以上前は0、最後の調査より後は最後の値', () => {
    expect(seriesValueAt(series, 1950)).toBe(0);
    expect(seriesValueAt(series, 1990)).toBe(50);
  });
});

describe('activity（活動度）', () => {
  it('登場前は0、流行期は1、終了後は0', () => {
    const s = trendSubject();
    expect(activity(s, 1989, noStats)).toBe(0);
    expect(activity(s, 1992, noStats)).toBe(1);
    expect(activity(s, 1996, noStats)).toBe(0);
  });

  it('流行期の直前2年は0.5、それより前（一部の人だけの時期）は0.1', () => {
    const s = trendSubject({
      facts: {
        start: { date: '1980', status: 'verified', sources: ['src-x'] },
        diffusion: { from: '1990', to: '1994', status: 'verified', sources: ['src-x'] },
      },
    });
    expect(activity(s, 1981, noStats)).toBe(0.1);
    expect(activity(s, 1988, noStats)).toBe(0.5);
    expect(activity(s, 1990, noStats)).toBe(1);
  });

  it('月まで分かる日付は年の大半に当てはまるかで丸める（下半期の開始は翌年から、上半期の終了は前年まで）', () => {
    const s = trendSubject({
      facts: {
        start: { date: '1994-12-03', status: 'verified', sources: ['src-x'] },
        end: { date: '1998-03', status: 'verified', sources: ['src-x'] },
      },
    });
    expect(activity(s, 1994, noStats)).toBe(0);
    expect(activity(s, 1995, noStats)).toBe(1);
    expect(activity(s, 1997, noStats)).toBe(1);
    expect(activity(s, 1998, noStats)).toBe(0);
  });

  it('出来事（event）は丸めず、起きた年をそのまま使う', () => {
    const s = trendSubject({
      kind: 'event',
      facts: {
        start: { date: '1964-10', status: 'verified', sources: ['src-x'] },
        end: { date: '1964-10', status: 'verified', sources: ['src-x'] },
      },
    });
    expect(activity(s, 1964, noStats)).toBe(1);
    expect(activity(s, 1965, noStats)).toBe(0);
  });

  it('終了の事実だけがある対象は、それ以前ずっと続いていたとみなす', () => {
    const s = trendSubject({
      facts: { end: { date: '1992-09', status: 'verified', sources: ['src-x'] } },
    });
    expect(activity(s, 1950, noStats)).toBe(1);
    expect(activity(s, 1993, noStats)).toBe(0);
  });

  it('世帯保有型は統計の普及率（%）を0〜1で返す', () => {
    const stat: Statistic = {
      id: 'st',
      sourceId: 'src-x',
      title: 't',
      unit: '%',
      note: '',
      series: { tv: { '1960': 20, '1970': 80 } },
    };
    const s = trendSubject({
      kind: 'household',
      facts: { series: { statId: 'st', key: 'tv', kind: 'household_penetration' } },
    });
    expect(activity(s, 1965, new Map([['st', stat]]))).toBeCloseTo(0.5);
  });
});

describe('estimateExperience（経験確率）', () => {
  const s = trendSubject();

  it('中心世代（流行期に10〜15歳）の経験確率は上限に近く、離れた世代は下限に近い', () => {
    const center = estimateExperience(s, 1979, noStats); // 1990年に11歳
    const old = estimateExperience(s, 1940, noStats); // 1990年に50歳
    const young = estimateExperience(s, 2005, noStats); // 流行期より後に生まれた
    expect(center.pExperience).toBeGreaterThan(0.7);
    expect(old.pExperience).toBeLessThan(0.05);
    expect(young.pExperience).toBeLessThan(0.05);
  });

  it('知っている確率は必ず経験確率以上で、1を超えない', () => {
    for (let b = 1930; b <= 2018; b++) {
      const e = estimateExperience(s, b, noStats);
      expect(e.pAware).toBeGreaterThanOrEqual(e.pExperience);
      expect(e.pAware).toBeLessThanOrEqual(1);
      expect(e.pExperience).toBeGreaterThanOrEqual(0);
    }
  });

  it('「発売年だけ」で決めない：同じ発売年でも対象年齢が違えば中心世代が変わる', () => {
    const adult = trendSubject({
      model: {
        ...s.model,
        ageWindow: { value: [30, 40], status: 'estimated', rationale: 'テスト' },
      },
    });
    // 1980年生まれ（流行期に10〜14歳）は子ども向けでは中心、大人向けでは中心外
    expect(estimateExperience(s, 1980, noStats).pExperience).toBeGreaterThan(
      estimateExperience(adult, 1980, noStats).pExperience + 0.5,
    );
    // 1955年生まれ（流行期に35〜39歳）は逆
    expect(estimateExperience(adult, 1955, noStats).pExperience).toBeGreaterThan(
      estimateExperience(s, 1955, noStats).pExperience + 0.5,
    );
  });
});
