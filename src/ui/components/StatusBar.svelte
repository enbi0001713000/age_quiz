<!-- 分析ステータス：状態ランプ・問番号・解析進捗 -->
<script lang="ts">
  let {
    number,
    progress,
    phase,
  }: { number: number; progress: number; phase: 'basic' | 'adaptive' } = $props();
  const percent = $derived(Math.round(progress * 100));
</script>

<div class="status-bar">
  <div class="row">
    <span class="chip">
      <span class="lamp" aria-hidden="true"></span>
      {phase === 'basic' ? 'BASIC SCAN' : 'DEEP ANALYSIS'}
    </span>
    <span class="number">Q.{String(number).padStart(2, '0')}</span>
  </div>
  <div
    class="progress"
    role="progressbar"
    aria-label="解析進捗"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={percent}
  >
    <div class="fill" style:width="{percent}%"></div>
  </div>
  <div class="caption">解析 {percent}%</div>
</div>

<style>
  .status-bar {
    display: grid;
    gap: var(--space-1);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 2px 10px;
    border: 1px solid var(--color-border-glow);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.14em;
    color: var(--color-accent);
  }
  .lamp {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: var(--glow-accent);
    animation: blink 1.4s ease-in-out infinite;
  }
  .number {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }
  .progress {
    height: 6px;
    border-radius: 999px;
    background: var(--navy-700);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--blue-500), var(--cyan-400));
    box-shadow: var(--glow-accent);
    transition: width 0.5s ease;
  }
  .caption {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--color-text-faint);
    text-align: right;
  }
  @media (max-height: 860px) {
    .caption {
      display: none;
    }
  }
  @keyframes blink {
    50% {
      opacity: 0.3;
    }
  }
</style>
