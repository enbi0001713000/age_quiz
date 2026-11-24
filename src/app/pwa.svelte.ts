/**
 * オフライン対応（Service Worker）の状態（設計書 9章）。
 *
 * - offlineReady：初回の読み込み後、ゲームに必要なファイルがすべて端末に保存され、次回からオフラインで遊べる状態
 * - needRefresh ：新しい版を裏で取得済みで、切り替え待ちの状態。切り替えは利用者がタイトル画面で「更新」を押したときだけ
 *   （プレイ中に画面が再読み込みされたり、古い版と新しい版のファイルが混ざったりしないようにするため）
 */
export const pwa = $state({ offlineReady: false, needRefresh: false, supported: false });

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

/** Service Worker を登録する（対応していない環境や開発サーバーでは何もしない） */
export async function startPwa(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  pwa.supported = true;
  const { registerSW } = await import('virtual:pwa-register');
  applyUpdate = registerSW({
    immediate: true,
    onOfflineReady() {
      pwa.offlineReady = true;
    },
    onNeedRefresh() {
      pwa.needRefresh = true;
    },
    onRegisteredSW(_url, registration) {
      // すでに有効な Service Worker がある（2回目以降の訪問）＝オフラインで遊べる状態
      if (registration?.active) pwa.offlineReady = true;
    },
  });
}

/** 新しい版に切り替える（待機中の Service Worker を有効にして再読み込み） */
export async function updateNow(): Promise<void> {
  if (applyUpdate) await applyUpdate(true);
  else location.reload();
}
