import { expect, test } from '@playwright/test';

test.describe('起動確認（Phase 1）', () => {
  test('公開パス配下でタイトル画面が表示され、エラーがない', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const failed: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('./');

    await expect(page).toHaveTitle('年齢推理ゲーム（仮称）');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('年齢推理ゲーム（仮称）');
    await expect(page.getByText('あなたの記憶から、AIが年齢を推理する。')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('SYSTEM BOOT');

    expect(errors, 'コンソールエラー').toEqual([]);
    expect(failed, '読み込みに失敗したファイル').toEqual([]);
  });

  test('外部サイトへの通信が発生しない（要件13：外部送信なし）', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const external: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol.startsWith('http') && url.origin !== origin) external.push(req.url());
    });

    await page.goto('./');
    await page.waitForLoadState('networkidle');

    expect(external).toEqual([]);
  });

  test('横スクロールが発生しない（スマホ幅でのレイアウト）', async ({ page }) => {
    await page.goto('./');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('検索エンジン除外の指定がある（一般公開まで）', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
