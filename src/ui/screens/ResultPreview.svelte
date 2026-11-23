<!--
  暫定の結果画面（Phase 4）。
  推理レポート・グラフ・答え合わせ・履歴・共有を含む本来の結果画面は Phase 5 で実装する。
-->
<script lang="ts">
  import type { Estimate } from '../../engine';
  import { ageText, birthText, CONFIDENCE_LABELS, confidenceMeter } from '../format';

  let {
    estimate,
    answered,
    onretry,
  }: { estimate: Estimate; answered: number; onretry: () => void } = $props();
  const text = $derived(birthText(estimate));
  const meter = $derived(confidenceMeter(estimate.confidence));
</script>

<main class="result">
  <p class="eyebrow">ANALYSIS COMPLETE</p>
  <p class="caption">{answered}件の回答から推定したあなたの生年は</p>
  <h1 class="headline">{text.headline}</h1>
  {#if text.detail}<p class="detail">{text.detail}</p>{/if}

  <dl class="facts">
    <div>
      <dt>推定年齢</dt>
      <dd>{ageText(estimate)}</dd>
    </div>
    <div>
      <dt>確信度</dt>
      <dd>
        <span class="level">{CONFIDENCE_LABELS[estimate.confidence]}</span>
        <span class="meter" aria-hidden="true">
          {#each [1, 2, 3, 4, 5] as i (i)}<span class:on={i <= meter}></span>{/each}
        </span>
      </dd>
    </div>
  </dl>
  <p class="note">
    確信度・推定確率はAIモデルが算出した相対的な値で、的中率を示すものではありません。年齢は誕生日を聞いていないため範囲で表示しています。
  </p>

  <p class="provisional">
    推理レポート・年代別グラフ・答え合わせ・共有は次の開発段階（Phase 5）で追加します。
  </p>

  <button type="button" class="retry" onclick={onretry}>もう一度分析する</button>
</main>

<style>
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: var(--content-max);
    min-height: 100dvh;
    margin: 0 auto;
    padding: var(--space-8) var(--space-4);
    text-align: center;
  }
  .eyebrow {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.24em;
    color: var(--color-accent);
  }
  .caption {
    margin: var(--space-4) 0 var(--space-1);
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
  .headline {
    margin: 0;
    font-size: clamp(1.75rem, 8vw, 2.5rem);
    line-height: 1.3;
    background: linear-gradient(90deg, var(--cyan-300), var(--purple-400));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 18px rgb(34 211 238 / 30%));
  }
  .detail {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
  }
  .facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    width: 100%;
    margin: var(--space-6) 0 var(--space-3);
  }
  .facts div {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
  }
  dt {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  dd {
    margin: var(--space-1) 0 0;
    font-size: 1.25rem;
    font-weight: 700;
  }
  .meter {
    display: inline-flex;
    gap: 3px;
    margin-left: var(--space-2);
    vertical-align: middle;
  }
  .meter span {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--navy-600);
  }
  .meter span.on {
    background: var(--cyan-400);
    box-shadow: var(--glow-accent);
  }
  .note,
  .provisional {
    margin: 0 0 var(--space-3);
    font-size: 0.75rem;
    line-height: 1.7;
    color: var(--color-text-faint);
  }
  .provisional {
    padding: var(--space-2) var(--space-3);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
  }
  .retry {
    width: 100%;
    max-width: 320px;
    min-height: var(--tap-min);
    margin-top: auto;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--button-gradient);
    box-shadow: var(--glow-primary);
    font-weight: 700;
    color: #fff;
    cursor: pointer;
  }
</style>
