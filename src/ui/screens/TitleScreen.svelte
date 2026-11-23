<!-- タイトル画面（タイトル・ロゴは仮。正式名は確認事項 Q11 で決定） -->
<script lang="ts">
  import { APP_INFO } from '../../app/appInfo';
  import Logo from '../components/Logo.svelte';

  let {
    ready,
    error,
    onstart,
    onhistory,
    onabout,
  }: {
    ready: boolean;
    error: string | null;
    onstart: () => void;
    onhistory: () => void;
    onabout: () => void;
  } = $props();
</script>

<main class="title-screen">
  <div class="hero">
    <Logo size={96} />
    <p class="eyebrow">AGE INFERENCE SYSTEM</p>
    <h1 class="title">{APP_INFO.name}</h1>
    <p class="concept">{APP_INFO.concept}</p>
  </div>

  <div class="actions">
    <button type="button" class="start" disabled={!ready} onclick={onstart}>
      {ready ? '分析を開始' : error ? '準備に失敗しました' : 'システム準備中…'}
    </button>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="links">
      <button type="button" class="btn-secondary" onclick={onhistory}>プレイ履歴</button>
      <button type="button" class="btn-secondary" onclick={onabout}>このゲームについて</button>
    </div>
    <ul class="notes">
      <li>質問に答えるだけ・約3〜5分</li>
      <li>個人情報は入力不要。回答はこの端末の中だけで処理し、外部に送信しません</li>
    </ul>
  </div>

  <footer class="footer">開発中のテスト版 · v{APP_INFO.version}</footer>
</main>

<style>
  .title-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    min-height: 100dvh;
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-8) var(--space-4) var(--space-4);
    text-align: center;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    margin-top: auto;
  }
  .eyebrow {
    margin: var(--space-3) 0 0;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.3em;
    color: var(--color-accent);
  }
  .title {
    margin: 0;
    font-size: clamp(1.75rem, 7vw, 2.5rem);
    line-height: 1.3;
    background: linear-gradient(90deg, var(--cyan-300), var(--purple-400));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
  .concept {
    margin: 0;
    color: var(--color-text-muted);
  }
  .actions {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    width: 100%;
    margin-bottom: auto;
  }
  .start {
    width: 100%;
    max-width: 320px;
    min-height: var(--tap-min);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--button-gradient);
    box-shadow: var(--glow-primary);
    font-size: 1.0625rem;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    transition: transform 0.1s;
  }
  .start:active:not(:disabled) {
    transform: scale(0.98);
  }
  .start:disabled {
    background: var(--navy-700);
    box-shadow: none;
    color: var(--color-text-muted);
    cursor: progress;
  }
  .links {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
    width: 100%;
    max-width: 320px;
  }
  .links .btn-secondary {
    min-height: var(--tap-secondary);
    font-size: 0.875rem;
    font-weight: 400;
  }
  .error {
    margin: 0;
    font-size: 0.8125rem;
    color: #fca5a5;
  }
  .notes {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .footer {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }
</style>
