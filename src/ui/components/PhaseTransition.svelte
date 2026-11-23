<!-- 基本質問の終了 → 追加質問（精密分析）への移行演出（約1秒） -->
<script lang="ts">
  import SkipLayer from './SkipLayer.svelte';

  let {
    duration,
    candidate,
    ondone,
  }: { duration: number; candidate: string | null; ondone: () => void } = $props();
</script>

<div class="backdrop" aria-hidden="true"></div>
<SkipLayer {duration} {ondone} fixed>
  <span class="eyebrow">BASIC SCAN COMPLETE</span>
  <span class="title" role="status">基本分析が完了しました</span>
  <span class="narrow" aria-hidden="true">
    {#each [0, 1, 2, 3, 4, 5, 6] as i (i)}
      <span class="tick" style:animation-delay="{i * 60}ms" class:keep={i >= 2 && i <= 4}></span>
    {/each}
  </span>
  <span class="sub">
    {candidate ? `候補：${candidate}生まれ` : '候補を絞り込んでいます'}<br />
    精密分析モードに移行します
  </span>
  <span class="hint">タップでスキップ</span>
</SkipLayer>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
    background: rgb(6 11 31 / 88%);
    backdrop-filter: blur(4px);
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.24em;
    color: var(--color-accent);
  }
  .title {
    margin-top: var(--space-2);
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-text);
  }
  .narrow {
    display: flex;
    gap: 6px;
    margin: var(--space-5) 0;
  }
  .tick {
    width: 10px;
    height: 36px;
    border-radius: 3px;
    background: var(--blue-400);
    animation: fade 0.6s ease forwards;
  }
  .tick.keep {
    animation-name: glow;
  }
  .sub {
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    line-height: 1.8;
  }
  .hint {
    margin-top: var(--space-6);
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }
  @keyframes fade {
    to {
      opacity: 0.12;
      transform: scaleY(0.4);
    }
  }
  @keyframes glow {
    to {
      background: var(--cyan-300);
      box-shadow: var(--glow-accent);
      transform: scaleY(1.2);
    }
  }
</style>
