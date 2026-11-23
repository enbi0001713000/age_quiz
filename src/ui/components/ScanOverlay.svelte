<!-- 回答後の短いスキャン演出（約0.5秒） -->
<script lang="ts">
  import SkipLayer from './SkipLayer.svelte';

  let { duration, ondone }: { duration: number; ondone: () => void } = $props();
</script>

<SkipLayer {duration} {ondone}>
  <span class="scan" style:--d="{duration}ms" aria-hidden="true"></span>
  <span class="text">SCANNING</span>
</SkipLayer>

<style>
  .scan {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--cyan-300), transparent);
    box-shadow:
      0 0 16px var(--cyan-400),
      0 0 40px rgb(34 211 238 / 40%);
    animation: sweep var(--d) ease-in-out forwards;
  }
  .text {
    padding: 4px 12px;
    border: 1px solid var(--color-border-glow);
    border-radius: 999px;
    background: rgb(6 11 31 / 70%);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.3em;
    color: var(--color-accent);
  }
  @keyframes sweep {
    from {
      top: 0;
    }
    to {
      top: calc(100% - 3px);
    }
  }
</style>
