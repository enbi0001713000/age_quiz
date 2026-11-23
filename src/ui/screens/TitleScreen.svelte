<!--
  タイトル画面（Phase 1：起動確認用の仮実装）。
  演出・ロゴ・履歴導線などの本実装は Phase 4 で行う。
-->
<script lang="ts">
  import { APP_INFO } from '../../app/appInfo';
</script>

<main class="title-screen">
  <p class="boot-status" role="status">SYSTEM BOOT — 開発中（Phase 1）</p>

  <h1 class="title">{APP_INFO.name}</h1>
  <p class="concept">{APP_INFO.concept}</p>

  <button class="start" type="button" disabled aria-describedby="start-note">分析を開始</button>
  <p id="start-note" class="note">ゲーム本編は今後の開発 Phase で実装します。</p>

  <footer class="version">v{APP_INFO.version}</footer>
</main>

<style>
  .title-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    min-height: 100dvh;
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
    text-align: center;
    background: radial-gradient(
      circle at 50% 35%,
      color-mix(in srgb, var(--color-primary) 22%, transparent),
      transparent 60%
    );
  }

  .boot-status {
    margin: 0;
    color: var(--color-accent);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
  }

  .title {
    margin: 0;
    font-size: clamp(1.75rem, 7vw, 2.5rem);
    line-height: 1.3;
    background: linear-gradient(90deg, var(--color-accent), var(--color-accent-2));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }

  .concept {
    margin: 0;
    color: var(--color-text-muted);
  }

  .start {
    width: 100%;
    max-width: 320px;
    min-height: var(--tap-min);
    margin-top: var(--space-6);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  .note {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }

  .version {
    margin-top: var(--space-8);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
