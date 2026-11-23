<!-- 最終判定の演出（約2.6秒。タップでスキップ） -->
<script lang="ts">
  import SkipLayer from './SkipLayer.svelte';

  let { duration, answered, ondone }: { duration: number; answered: number; ondone: () => void } =
    $props();
  const steps = ['回答データを照合中', '年代分布を解析中', '推定生年を確定中'];
</script>

<SkipLayer {duration} {ondone} fixed label="最終判定の演出をスキップ">
  <span class="rings" aria-hidden="true">
    <span class="ring r1"></span>
    <span class="ring r2"></span>
    <span class="ring r3"></span>
    <span class="sweep" style:--d="{Math.max(duration, 600)}ms"></span>
    <span class="core"></span>
  </span>
  <span class="eyebrow">FINAL ANALYSIS</span>
  <span class="title" role="status">{answered}件の回答から最終判定しています</span>
  <span class="steps">
    {#each steps as step, i (step)}
      <span class="step" style:animation-delay="{(i * duration) / 3}ms">
        <span class="mark" aria-hidden="true">▶</span>{step}
      </span>
    {/each}
  </span>
  <span class="bar" aria-hidden="true"><span class="fill" style:--d="{duration}ms"></span></span>
  <span class="hint">タップでスキップ</span>
</SkipLayer>

<style>
  .rings {
    position: relative;
    width: 168px;
    height: 168px;
    margin-bottom: var(--space-6);
  }
  .ring {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid var(--blue-400);
    opacity: 0.6;
  }
  .r1 {
    inset: 0;
  }
  .r2 {
    inset: 28px;
    border-color: var(--purple-400);
  }
  .r3 {
    inset: 56px;
    border-color: var(--cyan-400);
    box-shadow: var(--glow-accent);
  }
  .sweep {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, rgb(34 211 238 / 45%), transparent 70deg);
    animation: spin calc(var(--d) / 2) linear infinite;
  }
  .core {
    position: absolute;
    inset: 78px;
    border-radius: 50%;
    background: var(--cyan-300);
    box-shadow: 0 0 24px var(--cyan-400);
    animation: beat 0.8s ease-in-out infinite;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.24em;
    color: var(--color-accent);
  }
  .title {
    margin: var(--space-2) 0 var(--space-4);
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-text);
  }
  .steps {
    display: grid;
    gap: var(--space-1);
    text-align: left;
  }
  .step {
    opacity: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    animation: appear 0.3s ease forwards;
  }
  .mark {
    margin-right: var(--space-2);
    font-size: 0.625rem;
    color: var(--color-accent);
  }
  .bar {
    width: min(280px, 70vw);
    height: 4px;
    margin-top: var(--space-5);
    border-radius: 999px;
    background: var(--navy-700);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, var(--blue-500), var(--cyan-400));
    animation: grow var(--d) linear forwards;
  }
  .hint {
    margin-top: var(--space-5);
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes beat {
    50% {
      transform: scale(0.8);
      opacity: 0.7;
    }
  }
  @keyframes appear {
    to {
      opacity: 1;
    }
  }
  @keyframes grow {
    to {
      width: 100%;
    }
  }
</style>
