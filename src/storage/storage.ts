/**
 * ブラウザの保存領域（LocalStorage）の安全な取得。
 * プライベートブラウズ等で使えない場合は、ページを閉じると消える一時的な保存領域で代用する。
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoreHandle {
  store: KeyValueStore;
  /** LocalStorage に保存できるか（false なら一時的な保存のみ） */
  persistent: boolean;
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

export function openStore(): StoreHandle {
  try {
    const ls = globalThis.localStorage;
    const probe = '__agequiz_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { store: ls, persistent: true };
  } catch {
    return { store: memoryStore(), persistent: false };
  }
}
