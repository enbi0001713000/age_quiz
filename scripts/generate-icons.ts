/**
 * ホーム画面用アイコン（PNG）を public/favicon.svg から生成する：npx tsx scripts/generate-icons.ts
 * 生成物は public/icons/ にコミットする（ビルドのたびには生成しない）。
 * maskable：端末が丸や角丸に切り抜いても欠けないよう、ロゴを中央の安全領域（80%）に収めて背景を全面に塗る。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'apple-touch-icon-180.png', size: 180, padding: 0.06 },
  { file: 'maskable-512.png', size: 512, padding: 0.14 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.padding * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:#060b1f;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
    </body></html>`,
  );
  writeFileSync(join(outDir, t.file), await page.screenshot({ type: 'png' }));
  console.log('generated', t.file);
}
await browser.close();
