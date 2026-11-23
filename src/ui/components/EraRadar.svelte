<!-- 推定年代レーダー：生まれた年代ごとの推定確率（数問ごとに更新） -->
<script lang="ts">
  import type { RadarView } from '../game/flow';

  let { radar }: { radar: RadarView | null } = $props();
  const max = $derived(radar ? Math.max(...radar.bars.map((b) => b.probability)) : 0);
  const PLACEHOLDER = [0.3, 0.45, 0.6, 0.5, 0.65, 0.55, 0.4, 0.5, 0.35];
</script>

<section class="radar" aria-label="推定年代レーダー">
  <div class="head">
    <span class="title">推定年代レーダー</span>
    <span class="note">{radar ? `${radar.afterAnswers}問目までの分析` : 'データ収集中'}</span>
  </div>
  <div class="bars" class:idle={!radar} aria-hidden="true">
    {#if radar}
      {#each radar.bars as bar (bar.decade)}
        <div class="bar-wrap">
          <div
            class="bar"
            class:top={bar.probability === max}
            style:height="{Math.max(4, (bar.probability / max) * 100)}%"
          ></div>
          <span class="tick">{String(bar.decade).slice(2)}</span>
        </div>
      {/each}
    {:else}
      {#each PLACEHOLDER as h, i (i)}
        <div class="bar-wrap">
          <div class="bar" style:height="{h * 100}%" style:animation-delay="{i * 0.12}s"></div>
          <span class="tick">··</span>
        </div>
      {/each}
    {/if}
  </div>
  <p class="label" aria-live="polite">
    {#if radar?.label}
      推定：<strong>{radar.label}</strong>生まれ？
    {:else if radar}
      候補はまだ広い範囲にあります
    {:else}
      回答を分析して、生まれた年代を推定します
    {/if}
  </p>
</section>

<style>
  .radar {
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
  }
  .head {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  .title {
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .note {
    font-family: var(--font-mono);
    color: var(--color-text-faint);
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    gap: 6px;
    align-items: end;
    height: 64px;
    margin: var(--space-2) 0 var(--space-1);
  }
  .bar-wrap {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
  }
  .bar {
    width: 100%;
    border-radius: 3px 3px 0 0;
    background: linear-gradient(180deg, var(--blue-400), var(--navy-600));
    transition: height 0.6s ease;
  }
  .bar.top {
    background: linear-gradient(180deg, var(--cyan-300), var(--blue-500));
    box-shadow: var(--glow-accent);
  }
  .idle .bar {
    opacity: 0.35;
    animation: pulse 1.6s ease-in-out infinite;
  }
  .tick {
    margin-top: 2px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    color: var(--color-text-faint);
  }
  .label {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .label strong {
    color: var(--color-accent);
  }
  /* 画面の高さが低い端末では、選択肢を画面内に収めるためにレーダーを小さくする */
  @media (max-height: 860px) {
    .radar {
      padding: var(--space-2) var(--space-3);
    }
    .bars {
      height: 34px;
      margin: var(--space-1) 0 0;
    }
    .label {
      font-size: 0.75rem;
    }
  }
  @media (max-height: 700px) {
    .head {
      display: none;
    }
    .bars {
      height: 26px;
    }
  }
  @keyframes pulse {
    50% {
      opacity: 0.12;
    }
  }
</style>
