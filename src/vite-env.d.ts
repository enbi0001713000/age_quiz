/// <reference types="svelte" />
/// <reference types="vite/client" />

/** ビルド時に package.json の version が埋め込まれる（vite.config.ts の define）。 */
declare const __APP_VERSION__: string;
