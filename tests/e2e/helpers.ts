import { expect, type Page } from '@playwright/test';

/** E2E テストで共通に使う操作 */

/** 質問画面の問番号（Q.07 → 7） */
export async function questionNumber(page: Page): Promise<number> {
  const text = await page.locator('.number').textContent();
  return Number(text?.replace(/\D/g, ''));
}

export async function startGame(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: '分析を開始' }).click();
  await expect(page.locator('#question-text')).toBeVisible();
}

/**
 * 最初の選択肢を答え続けて結果画面まで進む。演出は表示されたらタップしてスキップする。
 * 返り値：回答数、解析進捗の推移、移行演出を見た回答番号
 */
export async function playToEnd(page: Page) {
  const progress: number[] = [];
  let transitionAt = -1;
  for (let answered = 0; answered < 31;) {
    if (await page.getByText('ANALYSIS COMPLETE').isVisible()) {
      return { answered, progress, transitionAt };
    }
    const skip = page.getByRole('button', { name: /スキップ/ });
    if (await skip.isVisible()) {
      if (await page.getByText('基本分析が完了しました').isVisible()) transitionAt = answered;
      await skip.click();
      continue;
    }
    const option = page.locator('.option:not([disabled])').first();
    if (await option.isVisible()) {
      const n = await questionNumber(page);
      await option.click();
      answered++;
      await expect
        .poll(
          async () =>
            (await page.getByText('ANALYSIS COMPLETE').isVisible()) ||
            (await page.getByRole('button', { name: /スキップ/ }).isVisible()) ||
            ((await page.locator('#question-text').isVisible()) &&
              (await questionNumber(page)) > n),
        )
        .toBe(true);
      const bar = page.getByRole('progressbar', { name: '解析進捗' });
      if (await bar.isVisible()) progress.push(Number(await bar.getAttribute('aria-valuenow')));
      continue;
    }
    await page.waitForTimeout(50);
  }
  throw new Error('結果画面に到達しませんでした');
}
