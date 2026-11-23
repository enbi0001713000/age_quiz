/**
 * 演出の時間（設計書 6-4・7.1）。
 * 基本の演出は0.5〜1秒、最終判定だけ長め。すべて画面タップ（またはキー入力）でスキップできる。
 * OSの「視差効果を減らす」設定が有効なら、動きをなくし表示時間も短くする。
 */
export interface Durations {
  /** 回答後のスキャン演出 */
  scan: number;
  /** 追加質問への移行演出 */
  transition: number;
  /** 最終判定演出 */
  final: number;
}

const NORMAL: Durations = { scan: 550, transition: 1000, final: 2600 };
const REDUCED: Durations = { scan: 0, transition: 700, final: 900 };

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 演出の時間。設定（演出を短縮）が「端末の設定に従う」なら OS の設定で決める */
export function durations(preference: 'system' | 'reduce' | 'normal' = 'system'): Durations {
  if (preference === 'reduce') return REDUCED;
  if (preference === 'normal') return NORMAL;
  return prefersReducedMotion() ? REDUCED : NORMAL;
}
