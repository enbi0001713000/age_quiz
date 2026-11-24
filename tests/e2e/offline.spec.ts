import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { playToEnd } from './helpers';

/**
 * オフライン対応（Phase 7、設計書 9章）の確認。
 * - 初回の読み込み後は、通信を切っても起動して1プレイできる
 * - 新しい版はタイトル画面でだけ案内し、利用者が「更新」を押したときに切り替わる（プレイ中は切り替わらない）
 */
test.use({ reducedMotion: 'reduce' });

/** Service Worker がこのページを制御するまで待つ（初回は Service Worker の有効化後に再読み込みが必要） */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.describe('オフライン起動', () => {
  test('初回の読み込み後は、通信を切っても起動し、1プレイを最後まで遊べる', async ({
    page,
    context,
  }) => {
    await page.goto('./');
    await waitForServiceWorker(page);
    await expect(page.getByText('オフラインでも遊べます（この端末に保存済み）')).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: '分析を開始' }).click();
    await expect(page.locator('#question-text')).toBeVisible();
    await playToEnd(page);
    await expect(page.getByText('ANALYSIS COMPLETE')).toBeVisible();
    // オフライン中は X の投稿画面を開けないため無効、画像保存は使える
    await expect(page.getByRole('button', { name: 'Xで共有（オフライン）' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '画像を保存' })).toBeEnabled();
    await context.setOffline(false);
  });

  test('配信される質問データには、実行時に使わない説明（出典の引用文など）が含まれない', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: '分析を開始' })).toBeEnabled();
    const url = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .find((n) => /loadGame-.*\.js$/.test(n))!,
    );
    const code = await (await page.request.get(url)).text();
    expect(code).toContain('子どもの頃'); // 質問文は含まれる
    expect(code).not.toContain('"quote"');
    expect(code).not.toContain('rationale');
  });
});

/** dist を配信し、sw.js の末尾だけ差し替えられる小さなサーバー（新しい版の公開を再現する） */
function startServer(dist: string, base: string) {
  let swSuffix = '';
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webmanifest': 'application/manifest+json',
  };
  const server: Server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (!path.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    let rel = normalize(path.slice(base.length) || 'index.html');
    if (rel.endsWith('/')) rel += 'index.html';
    try {
      let body: Buffer | string = await readFile(join(dist, rel));
      if (rel === 'sw.js') body = body.toString() + swSuffix;
      res.writeHead(200, {
        'content-type': types[extname(rel)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return {
    server,
    publishNewVersion: () => (swSuffix = `\n// new version ${Date.now()}\n`),
  };
}

test.describe('更新時の動作', () => {
  test('新しい版はプレイ中には切り替わらず、タイトル画面の「更新する」で切り替わる', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'PCで1回確認すれば十分なため');
    const base = '/age_quiz/';
    const { server, publishNewVersion } = startServer(join(process.cwd(), 'dist'), base);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    const root = `http://localhost:${port}${base}`;
    try {
      await page.goto(root);
      await waitForServiceWorker(page);
      await expect(page.getByText('新しいバージョンがあります')).toHaveCount(0);

      // プレイ中に新しい版が公開されても、画面は切り替わらない
      await page.getByRole('button', { name: '分析を開始' }).click();
      await expect(page.locator('#question-text')).toBeVisible();
      await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
      publishNewVersion();
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
      await expect
        .poll(() =>
          page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
        )
        .toBe(true);
      await expect(page.locator('#question-text')).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(
        1,
      );
      await expect(page.getByText('新しいバージョンがあります')).toHaveCount(0);

      // 次にタイトル画面を開いたときに案内が出て、「更新する」で新しい版に切り替わる
      await page.goto(root);
      await expect(page.getByText('新しいバージョンがあります')).toBeVisible();
      const before = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
      await page.getByRole('button', { name: '更新する' }).click();
      await expect(page.getByText('新しいバージョンがあります')).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(async () => !(await navigator.serviceWorker.getRegistration())?.waiting),
        )
        .toBe(true);
      await expect(page.getByRole('button', { name: '分析を開始' })).toBeEnabled();
      expect(before).toBeTruthy();
    } finally {
      server.close();
    }
  });
});
