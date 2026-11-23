import { expect, test } from '@playwright/test';
import { playToEnd, questionNumber, startGame } from './helpers';

test.describe('1プレイの流れ（Phase 4）', () => {
  test('タイトル → 質問 → 移行演出 → 最終判定 → 結果 → もう一度', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await startGame(page);
    expect(await questionNumber(page)).toBe(1);
    await expect(page.getByText('基本スキャン中（1/5）')).toBeVisible();

    const { answered, progress, transitionAt } = await playToEnd(page);
    expect(answered).toBeGreaterThanOrEqual(10); // 最低質問数
    expect(answered).toBeLessThanOrEqual(30); // 最大質問数
    expect(transitionAt).toBe(5); // 基本質問5問の後に精密分析へ移行
    for (let i = 1; i < progress.length; i++)
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]!);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('生まれ');
    await expect(page.getByText('推定年齢', { exact: true })).toBeVisible();
    await expect(page.getByText(/的中率を示すものではありません/)).toBeVisible();

    await page.getByRole('button', { name: 'もう一度分析する' }).click();
    await expect(page.getByRole('button', { name: '分析を開始' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('外部サイトへの通信がない（プレイ中を含む）', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http') && u.origin !== origin) external.push(r.url());
    });
    await startGame(page);
    await playToEnd(page);
    expect(external).toEqual([]);
  });
});

test.describe('操作性（スマホ優先）', () => {
  test('選択肢は高さ56px以上、その他の回答は44px以上で、横にはみ出さない', async ({ page }) => {
    await startGame(page);
    const vw = page.viewportSize()!.width;
    for (const box of await page
      .locator('.option')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(box.height).toBeGreaterThanOrEqual(56);
      expect(box.right).toBeLessThanOrEqual(vw);
    }
    for (const box of await page
      .locator('.secondary')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('選択肢は画面の下半分（親指の届く範囲）に配置される', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'スマホのみ');
    await startGame(page);
    const vh = page.viewportSize()!.height;
    const last = await page.locator('.option').last().boundingBox();
    expect(last!.y + last!.height).toBeGreaterThan(vh / 2);
  });

  test('スマホでは、すべての選択肢と「覚えていない」がスクロールなしで画面内に収まる', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'スマホのみ');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startGame(page);
    const vh = page.viewportSize()!.height;
    for (let i = 0; i < 30 && (await page.locator('.option').count()) > 0; i++) {
      const bottom = await page
        .locator('.secondary')
        .last()
        .evaluate((e) => e.getBoundingClientRect().bottom);
      expect(bottom, `${i + 1}問目`).toBeLessThanOrEqual(vh + 1);
      const n = await questionNumber(page);
      const count = await page.locator('.option').count();
      await page
        .locator('.option')
        .nth(i % count)
        .click();
      const skip = page.getByRole('button', { name: /スキップ/ });
      await expect
        .poll(
          async () =>
            (await skip.isVisible()) ||
            (await page.locator('.option').count()) === 0 ||
            (await questionNumber(page)) > n,
        )
        .toBe(true);
      if (await skip.isVisible()) await skip.click();
    }
  });

  test('回答後のスキャン演出はタップでスキップでき、次の質問に見出しのフォーカスが移る', async ({
    page,
  }) => {
    await startGame(page);
    await page.locator('.option').first().click();
    const skip = page.getByRole('button', { name: '演出をスキップ' });
    await expect(skip).toBeVisible();
    await skip.click();
    await expect.poll(() => questionNumber(page)).toBe(2);
    await expect(page.locator('#question-text')).toBeFocused();
  });

  test('PCではキーボード（数字キー）で回答できる', async ({ page, isMobile }) => {
    test.skip(isMobile, 'PCのみ');
    await startGame(page);
    await expect(page.getByText(/キーボードの 1〜/)).toBeVisible();
    await page.keyboard.press('1');
    await page.keyboard.press('Space'); // スキャン演出をキー入力でスキップ
    await expect.poll(() => questionNumber(page)).toBe(2);
    // スキップに使ったスペースキーでページがスクロールしていない
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe('動きを減らす設定', () => {
  test.use({ reducedMotion: 'reduce' });

  test('スキャン演出を省略し、すぐ次の質問に進む', async ({ page }) => {
    await startGame(page);
    await page.locator('.option').first().click();
    await expect(page.getByText('SCANNING')).toHaveCount(0);
    await expect.poll(() => questionNumber(page), { timeout: 1000 }).toBe(2);
  });
});

test.describe('表示速度', () => {
  test('開始ボタンが押せるまで3秒以内、開始から最初の質問まで1秒以内', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('./');
    await expect(page.getByRole('button', { name: '分析を開始' })).toBeEnabled();
    expect(Date.now() - t0).toBeLessThan(3000);
    const t1 = Date.now();
    await page.getByRole('button', { name: '分析を開始' }).click();
    await expect(page.locator('#question-text')).toBeVisible();
    expect(Date.now() - t1).toBeLessThan(1000);
  });
});
