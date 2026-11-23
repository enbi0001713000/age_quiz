/**
 * 共有用の結果画像（1200×630、SNSのリンクカードと同じ比率）を Canvas で描く（要件 10章）。
 * 画面を写真に撮る方式ではなく、専用に描くことで端末による崩れを防ぐ。
 * 画像に入れるのは推定結果だけで、回答内容・実年齢などの個人情報は含めない。
 */
export interface CardData {
  appName: string;
  headline: string;
  detail: string | null;
  ageText: string;
  generationName: string;
  confidenceLabel: string;
  decades: { decade: number; probability: number }[];
  url: string;
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
const FONT =
  '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic UI",Meiryo,sans-serif';
const MONO = 'ui-monospace,"SFMono-Regular",Menlo,Consolas,"Liberation Mono",monospace';

/** 指定幅に収まるまで文字サイズを小さくする */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  size: number,
  weight = 700,
) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > max && s > 24) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

export function drawCard(canvas: HTMLCanvasElement, d: CardData): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas を使用できません');
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;

  // 背景：ネイビーのグラデーション＋光のにじみ＋グリッド
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a1230');
  bg.addColorStop(1, '#060b1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.3, -80, 40, W * 0.3, -80, 700);
  glow.addColorStop(0, 'rgba(47,107,255,0.35)');
  glow.addColorStop(1, 'rgba(47,107,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(34,211,238,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(34,211,238,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // ロゴ（レーダー）とタイトル
  const lx = 92;
  const ly = 96;
  for (const [r, c] of [
    [36, '#2f6bff'],
    [24, '#5b8cff'],
    [12, '#8b5cf6'],
  ] as const) {
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(lx + 15, ly - 15, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#67e8f9';
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#22d3ee';
  ctx.font = `600 18px ${MONO}`;
  ctx.fillText('AGE INFERENCE SYSTEM', 148, 86);
  ctx.fillStyle = '#e6eeff';
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(d.appName, 148, 122);

  // 推定結果
  const left = 72;
  const textMax = 640;
  ctx.fillStyle = '#a9b8dc';
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('AIが推定したあなたの生年は', left, 214);
  const size = fitFont(ctx, d.headline, textMax, 76);
  const grad = ctx.createLinearGradient(left, 0, left + textMax, 0);
  grad.addColorStop(0, '#67e8f9');
  grad.addColorStop(1, '#a78bfa');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(34,211,238,0.45)';
  ctx.shadowBlur = 24;
  ctx.fillText(d.headline, left, 214 + size + 16);
  ctx.shadowBlur = 0;
  let y = 214 + size + 16;
  if (d.detail) {
    y += 44;
    ctx.fillStyle = '#a9b8dc';
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText(d.detail, left, y);
  }
  y += 64;
  const facts = [`推定年齢 ${d.ageText}`, d.generationName, `確信度 ${d.confidenceLabel}`];
  // 右側のグラフ（x=800〜）に重ならないよう、収まらないチップは次の行に回す
  const chipRight = 770;
  let x = left;
  for (const f of facts) {
    ctx.font = `700 26px ${FONT}`;
    const w = ctx.measureText(f).width + 36;
    if (x > left && x + w > chipRight) {
      x = left;
      y += 66;
    }
    ctx.fillStyle = 'rgba(14,24,56,0.9)';
    ctx.strokeStyle = 'rgba(34,211,238,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y - 36, w, 52, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e6eeff';
    ctx.fillText(f, x + 18, y);
    x += w + 14;
  }

  // 年代別の推定確率（右側）
  const cx = 800;
  const cw = 340;
  const top = 200;
  const ch = 230;
  ctx.fillStyle = '#a9b8dc';
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText('生まれた年代の推定確率', cx, top - 16);
  const max = Math.max(...d.decades.map((x) => x.probability), 1e-9);
  const n = d.decades.length;
  const gap = 8;
  const bw = (cw - gap * (n - 1)) / n;
  d.decades.forEach((dec, i) => {
    const h = Math.max(4, (dec.probability / max) * ch);
    const bx = cx + i * (bw + gap);
    const by = top + ch - h;
    const g = ctx.createLinearGradient(0, by, 0, by + h);
    const isTop = dec.probability === max;
    g.addColorStop(0, isTop ? '#67e8f9' : '#5b8cff');
    g.addColorStop(1, isTop ? '#2f6bff' : '#22305f');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, h);
    ctx.fillStyle = '#8a9bc7';
    ctx.font = `500 16px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(dec.decade).slice(2), bx + bw / 2, top + ch + 24);
    ctx.textAlign = 'left';
  });

  // フッター
  ctx.fillStyle = '#8a9bc7';
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText('※AIモデルによる推定です（的中を保証するものではありません）', left, H - 64);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#22d3ee';
  ctx.font = `500 20px ${MONO}`;
  ctx.fillText(d.url.replace(/^https?:\/\//, ''), W - 64, H - 64);
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('画像を作成できませんでした'))),
      'image/png',
    ),
  );
}
