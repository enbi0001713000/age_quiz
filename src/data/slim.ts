/**
 * 同梱データの軽量化（本番ビルドのみ。vite.config.ts の slim-data プラグインから使う）。
 *
 * 出典の引用文（quote）・導出規則（rule）・推定の根拠（rationale）・注記（notes）は、
 * データの確認とレビューのための説明で、推理や画面表示には使わない。本番の配信ファイルから除き、
 * 読み込み量とオフライン用キャッシュの容量を減らす。
 * 推理に影響しないことは tests/unit/slim.test.ts で確認する（除いたデータでも推理モデルが完全に一致）。
 */
export const RUNTIME_UNUSED_KEYS = ['quote', 'rule', 'rationale', 'notes'] as const;

export function slimData<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if ((RUNTIME_UNUSED_KEYS as readonly string[]).includes(k)) continue;
      out[k] = strip(v);
    }
    return out;
  }
  return value;
}
