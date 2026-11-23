<!-- 年代別の推定確率（要件 7-3）。モデルが算出した相対的な値であることを明記する -->
<script lang="ts">
  let { decades }: { decades: { decade: number; probability: number }[] } = $props();
  const max = $derived(Math.max(...decades.map((d) => d.probability)));
  const pct = (p: number) => (p >= 0.005 ? `${Math.round(p * 100)}%` : '1%未満');
</script>

<section class="panel" aria-labelledby="chart-title">
  <h2 class="panel-title" id="chart-title">生まれた年代の推定確率 <small>PROBABILITY</small></h2>
  <ul class="chart">
    {#each decades as d (d.decade)}
      <li class:top={d.probability === max}>
        <span class="label">{d.decade}年代</span>
        <span class="track" aria-hidden="true">
          <span class="bar" style:width="{Math.max(1, (d.probability / max) * 100)}%"></span>
        </span>
        <span class="value">{pct(d.probability)}</span>
      </li>
    {/each}
  </ul>
  <p class="footnote">
    AIモデルが回答から算出した相対的な推定確率です。実際の的中率や、統計的に保証された確率ではありません。
  </p>
</section>

<style>
  .chart {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: 5.5em 1fr 4em;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .track {
    height: 12px;
    border-radius: 999px;
    background: var(--navy-700);
    overflow: hidden;
  }
  .bar {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--navy-600), var(--blue-400));
  }
  .top .bar {
    background: linear-gradient(90deg, var(--blue-500), var(--cyan-300));
    box-shadow: var(--glow-accent);
  }
  .top {
    color: var(--color-text);
    font-weight: 700;
  }
  .value {
    font-family: var(--font-mono);
    text-align: right;
  }
</style>
