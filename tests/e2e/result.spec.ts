import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { playToEnd, questionNumber, startGame } from './helpers';

/** 結果画面・付加機能（Phase 5）の確認。演出待ちを減らすため「動きを減らす」設定で実行する */
test.use({ reducedMotion: 'reduce', acceptDownloads: true });

const HISTORY_KEY = 'agequiz.history.v1';
const SETTINGS_KEY = 'agequiz.settings.v1';

async function playToResult(page: Page) {
  await startGame(page);
  await playToEnd(page);
  await expect(page.getByText('ANALYSIS COMPLETE')).toBeVisible();
}

async function storageDump(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      out[k] = localStorage.getItem(k)!;
    }
    return out;
  });
}

/** 履歴のテスト用データ（推定結果だけの形式） */
function entry(id: string, playedAt: string, birthYear: number, generationId: string) {
  return {
    id,
    playedAt,
    estimate: {
      birthYear,
      birthRange: [birthYear - 3, birthYear + 3],
      displayRange: [birthYear - 3, birthYear + 3],
      ageRange: [2026 - birthYear - 4, 2026 - birthYear + 3],
      generationId,
      confidence: 'medium',
    },
    engineVersion: '0.1.0',
    dataVersion: 'test',
  };
}

async function seedHistory(page: Page, value: string) {
  await page.goto('./');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [HISTORY_KEY, value]);
  await page.reload();
}

test.describe('結果画面', () => {
  test('生年・年齢・確信度・世代・年代別確率・推理レポートを表示し、履歴に推定結果だけを保存する', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await playToResult(page);

    const headline = (await page.getByRole('heading', { level: 1 }).textContent())!.trim();
    expect(headline).toMatch(/生まれ$/);
    await expect(page.getByText('推定年齢', { exact: true })).toBeVisible();
    await expect(page.getByText('確信度', { exact: true })).toBeVisible();
    await expect(page.getByText(/分析集中度 \d+%/)).toBeVisible();

    // 世代分類：独自の世代名と、一般的な呼び方（諸説あり）
    const generation = page.getByRole('region', { name: /あなたの世代/ });
    await expect(generation).toContainText(/世代/);
    await expect(generation).toContainText('このゲーム独自の呼び名');

    // 年代別の推定確率：1930〜2010年代の9本、合計はおよそ100%
    const chart = page.getByRole('region', { name: /生まれた年代の推定確率/ });
    await expect(chart.getByRole('listitem')).toHaveCount(9);

    // 推理レポート：決め手の回答（最大5件）とジャンル
    const report = page.getByRole('region', { name: /推理レポート/ });
    await expect(report).toContainText('推理の決め手になった回答');
    await expect(report).toContainText('推定に影響したジャンル');
    await expect(report).toContainText('推理の不確実性');

    await expect(page.getByText(/プレイ履歴に保存しました/)).toBeVisible();

    // 保存されるのは推定結果だけ（回答内容・実年齢は含まない）
    const dump = await storageDump(page);
    expect(Object.keys(dump)).toEqual([HISTORY_KEY]);
    const saved = JSON.parse(dump[HISTORY_KEY]!);
    expect(saved.schemaVersion).toBe(1);
    expect(saved.entries).toHaveLength(1);
    expect(Object.keys(saved.entries[0]).sort()).toEqual(
      ['dataVersion', 'engineVersion', 'estimate', 'id', 'playedAt'].sort(),
    );
    expect(Object.keys(saved.entries[0].estimate).sort()).toEqual(
      ['ageRange', 'birthRange', 'birthYear', 'confidence', 'displayRange', 'generationId'].sort(),
    );

    // 履歴画面に同じ結果が並ぶ
    await page.getByRole('button', { name: 'プレイ履歴を見る' }).click();
    await expect(page.getByRole('heading', { name: 'プレイ履歴' })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('listitem')).toContainText(headline);
    expect(errors).toEqual([]);
  });

  test('答え合わせ：入力した年齢は保存・共有されない', async ({ page }) => {
    await playToResult(page);
    const shareTextBefore = await page.locator('.preview').textContent();
    const xBefore = await page.getByRole('link', { name: 'Xで共有' }).getAttribute('href');
    const storageBefore = await storageDump(page);

    const check = page.getByRole('button', { name: '答え合わせ' });
    await expect(check).toBeDisabled();
    await page.getByLabel('実際の年齢').fill('3');
    await expect(check).toBeDisabled(); // 範囲外（5〜120歳）は受け付けない
    await page.getByLabel('実際の年齢').fill('37');
    await check.click();
    await expect(
      page.getByText(/的中！|推定範囲（\d+〜\d+歳）より\d+歳(上|下)でした/),
    ).toBeVisible();

    expect(await page.locator('.preview').textContent()).toBe(shareTextBefore);
    expect(await page.getByRole('link', { name: 'Xで共有' }).getAttribute('href')).toBe(xBefore);
    expect(await storageDump(page)).toEqual(storageBefore);
  });
});

test.describe('結果の共有', () => {
  test('画像を保存：1200×630 の PNG がダウンロードされる', async ({ page }) => {
    await playToResult(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '画像を保存' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('age-quiz-result.png');
    const png = readFileSync((await download.path())!);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    await expect(page.getByText('結果画像を保存しました。')).toBeVisible();
  });

  test('Xで共有：推定結果の文章・URL・ハッシュタグ入りの投稿画面を新しいタブで開くリンク', async ({
    page,
    baseURL,
  }) => {
    await playToResult(page);
    const link = page.getByRole('link', { name: 'Xで共有' });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    const href = new URL((await link.getAttribute('href'))!);
    expect(href.origin + href.pathname).toBe('https://twitter.com/intent/tweet');
    expect(href.searchParams.get('text')).toBe(await page.locator('.preview').textContent());
    expect(href.searchParams.get('text')).toContain('生まれ');
    expect(href.searchParams.get('url')).toBe(baseURL);
    expect(href.searchParams.get('hashtags')).toBe('年齢推理ゲーム');
  });

  test('文章をコピー：推定結果の文章とURLをクリップボードに入れる', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __copied: string[] };
      w.__copied = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (t: string) => void w.__copied.push(t) },
      });
    });
    await playToResult(page);
    const text = await page.locator('.preview').textContent();
    await page.getByRole('button', { name: '文章をコピー' }).click();
    await expect(page.getByText('結果の文章をコピーしました。')).toBeVisible();
    const copied = await page.evaluate(
      () => (window as unknown as { __copied: string[] }).__copied,
    );
    expect(copied).toEqual([`${text} #年齢推理ゲーム\n${baseURL}`]);
  });

  test('共有する（Web Share API）：文章・URL・結果画像を渡す', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: unknown[] };
      w.__shared = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (d: ShareData) =>
          void w.__shared.push({
            title: d.title,
            text: d.text,
            url: d.url,
            files: (d.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
          }),
      });
    });
    await playToResult(page);
    await page.getByRole('button', { name: '共有する' }).click();
    await expect(page.getByText('共有しました。')).toBeVisible();
    const shared = await page.evaluate(
      () => (window as unknown as { __shared: unknown[] }).__shared,
    );
    expect(shared).toHaveLength(1);
    const s = shared[0] as {
      title: string;
      text: string;
      url: string;
      files: { name: string; type: string; size: number }[];
    };
    expect(s.text).toBe(await page.locator('.preview').textContent());
    expect(s.url).toBe(baseURL);
    expect(s.files).toHaveLength(1);
    expect(s.files[0]!.name).toBe('age-quiz-result.png');
    expect(s.files[0]!.type).toBe('image/png');
    expect(s.files[0]!.size).toBeGreaterThan(10_000);
  });

  test('共有する：Web Share API がない環境ではコピーで代替する', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => undefined },
      });
    });
    await playToResult(page);
    await page.getByRole('button', { name: '共有する' }).click();
    await expect(
      page.getByText('この端末では共有機能が使えないため、結果の文章をコピーしました。'),
    ).toBeVisible();
  });
});

test.describe('プレイ履歴', () => {
  test('履歴がないときは案内を表示し、そこから分析を始められる', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'プレイ履歴' }).click();
    await expect(page.getByText('まだプレイ履歴はありません。')).toBeVisible();
    await page.getByRole('button', { name: '分析を開始する' }).click();
    await expect(page.locator('#question-text')).toBeVisible();
  });

  test('新しい順に並び、1件ずつ削除・確認つきで全削除できる', async ({ page }) => {
    const entries = [
      entry('b', '2026-11-20T10:00:00.000Z', 1990, 'gen-sns'),
      entry('a', '2026-11-10T10:00:00.000Z', 1975, 'gen-famicom'),
    ];
    await seedHistory(page, JSON.stringify({ schemaVersion: 1, entries }));
    await page.getByRole('button', { name: 'プレイ履歴' }).click();

    const items = page.getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('1987〜1993年生まれ');
    await expect(items.nth(0)).toContainText('SNS世代');
    await expect(items.nth(1)).toContainText('1972〜1978年生まれ');
    await expect(items.nth(1)).toContainText('ファミコン世代');

    // 1件削除
    await items
      .nth(0)
      .getByRole('button', { name: /の履歴を削除/ })
      .click();
    await expect(items).toHaveCount(1);
    await expect(items.nth(0)).toContainText('ファミコン世代');
    const saved = JSON.parse((await storageDump(page))[HISTORY_KEY]!);
    expect(saved.entries.map((e: { id: string }) => e.id)).toEqual(['a']);

    // 全削除：確認で「やめる」と残る
    await page.getByRole('button', { name: '履歴をすべて削除' }).click();
    await expect(page.getByText('すべての履歴を削除します。元に戻せません。')).toBeVisible();
    await page.getByRole('button', { name: 'やめる' }).click();
    await expect(items).toHaveCount(1);

    await page.getByRole('button', { name: '履歴をすべて削除' }).click();
    await page.getByRole('button', { name: 'すべて削除する' }).click();
    await expect(page.getByText('まだプレイ履歴はありません。')).toBeVisible();
    expect(await storageDump(page)).not.toHaveProperty(HISTORY_KEY);

    // 再読み込みしても空のまま
    await page.reload();
    await page.getByRole('button', { name: 'プレイ履歴' }).click();
    await expect(page.getByText('まだプレイ履歴はありません。')).toBeVisible();
  });

  test('壊れた履歴データがあってもエラーにならず、空として扱う', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedHistory(page, '{broken');
    await page.getByRole('button', { name: 'プレイ履歴' }).click();
    await expect(page.getByText('まだプレイ履歴はありません。')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('このゲームについて', () => {
  test('推定の仕組み・プライバシー・出典一覧を表示する', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: '分析を開始' })).toBeEnabled();
    await page.getByRole('button', { name: 'このゲームについて' }).click();
    await expect(page.getByRole('heading', { name: '推定の仕組み' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'プライバシー' })).toBeVisible();
    await expect(page.getByText(/外部のAIサービスは使っていません/)).toBeVisible();

    const sourcesTitle = page.getByRole('heading', { name: /出典一覧/ });
    const count = Number((await sourcesTitle.textContent())!.match(/（(\d+)件）/)![1]);
    expect(count).toBeGreaterThanOrEqual(60);
    await page.getByText('質問データの根拠にした資料を表示').click();
    const links = page.locator('.sources a');
    await expect(links).toHaveCount(count);
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('href', /^https?:\/\//);
      await expect(a).toHaveAttribute('rel', /noopener/);
    }
  });

  test('「演出を短縮する」を保存し、スキャン演出を省略する', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('./');
    await page.getByRole('button', { name: 'このゲームについて' }).click();
    const toggle = page.getByLabel(/演出を短縮する/);
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    const saved = JSON.parse((await storageDump(page))[SETTINGS_KEY]!);
    expect(saved.motion).toBe('reduce');

    await page.reload();
    await page.getByRole('button', { name: 'このゲームについて' }).click();
    await expect(page.getByLabel(/演出を短縮する/)).toBeChecked();

    await page.getByRole('button', { name: '← タイトルへ戻る' }).click();
    await page.getByRole('button', { name: '分析を開始' }).click();
    await page.locator('.option').first().click();
    await expect(page.getByText('SCANNING')).toHaveCount(0);
    await expect.poll(() => questionNumber(page), { timeout: 1000 }).toBe(2);
  });
});
