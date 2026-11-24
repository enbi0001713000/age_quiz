import { expect, test } from '@playwright/test';

/**
 * 全質問を小さいスマホの画面で表示し、すべての選択肢と「覚えていない」などが
 * スクロールなしで画面内に収まり、横にはみ出さないことを確認する（要件：片手操作・スマホ最優先）。
 * 1プレイの E2E では出題される質問が毎回変わるため、全質問をここで確認する。
 */
const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 375, height: 667 },
];

for (const vp of VIEWPORTS) {
  test(`全質問が ${vp.width}×${vp.height} でスクロールなしに収まる`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: vp, isMobile: true, hasTouch: true });
    await page.goto('./tests/layout/index.html');
    await page.waitForFunction(() => (window as unknown as { __ids?: string[] }).__ids);
    const ids = await page.evaluate(() => (window as unknown as { __ids: string[] }).__ids);
    expect(ids.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const id of ids) {
      await page.goto(`./tests/layout/index.html?q=${id}`);
      await page.locator('.secondary').last().waitFor();
      const r = await page.evaluate(() => ({
        bottom: [...document.querySelectorAll('.secondary')].at(-1)!.getBoundingClientRect().bottom,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      if (r.bottom > vp.height + 1 || r.overflowX > 0) {
        problems.push(`${id}: 下端 ${r.bottom.toFixed(1)}px / 横はみ出し ${r.overflowX}px`);
      }
    }
    expect(problems).toEqual([]);
    await page.close();
  });
}
