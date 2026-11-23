<!--
  結果画面（設計書 7.4、要件 7章）：
  推定生年・年齢・世代・確信度 → 年代別グラフ → 推理レポート → 世代の背景 → 答え合わせ → 共有
-->
<script lang="ts">
  import AnswerCheck from '../components/AnswerCheck.svelte';
  import DecadeChart from '../components/DecadeChart.svelte';
  import ReasoningReport from '../components/ReasoningReport.svelte';
  import SharePanel from '../components/SharePanel.svelte';
  import { ageText, birthText, CONFIDENCE_LABELS, confidenceMeter } from '../format';
  import type { ResultBundle } from '../result/bundle';

  let {
    result,
    url,
    historySaved,
    onretry,
    onhistory,
  }: {
    result: ResultBundle;
    url: string;
    historySaved: boolean;
    onretry: () => void;
    onhistory: () => void;
  } = $props();

  const e = $derived(result.estimate);
  const text = $derived(birthText(e));
  const gen = $derived(result.generation);
  const meter = $derived(confidenceMeter(e.confidence));
  const pct = (p: number) => `${Math.round(p * 100)}%`;
</script>

<main class="result">
  <section class="hero">
    <p class="eyebrow">ANALYSIS COMPLETE</p>
    <p class="caption">{result.answered}件の回答から推定したあなたの生年は</p>
    <h1 class="headline">{text.headline}</h1>
    {#if text.detail}<p class="detail">{text.detail}</p>{/if}

    <dl class="facts">
      <div>
        <dt>推定年齢</dt>
        <dd>{ageText(e)}</dd>
      </div>
      <div>
        <dt>確信度</dt>
        <dd>
          <span class="level">{CONFIDENCE_LABELS[e.confidence]}</span>
          <span class="meter" aria-hidden="true">
            {#each [1, 2, 3, 4, 5] as i (i)}<span class:on={i <= meter}></span>{/each}
          </span>
          <span class="concentration">分析集中度 {pct(e.concentration)}</span>
        </dd>
      </div>
    </dl>
    <p class="footnote">
      確信度・分析集中度はAIモデルが算出した相対的な値で、的中率を示すものではありません。誕生日を聞いていないため、年齢は範囲で表示しています。
    </p>
  </section>

  <section class="panel generation" aria-labelledby="gen-title">
    <h2 class="panel-title" id="gen-title">あなたの世代 <small>GENERATION</small></h2>
    <p class="gen-name">{gen.primary.name}</p>
    <p class="gen-tagline">{gen.primary.tagline}（推定確率 {pct(gen.probability)}）</p>
    {#if gen.common.length}
      <p class="common">
        一般的な呼び方（諸説あり）：
        {#each gen.common as c, i (c.id)}{i > 0 ? '、' : ''}<strong>
            {c.name}
          </strong>（{c.label}）{/each}
      </p>
    {/if}
    <h3 class="sub">この世代の文化的背景</h3>
    <ul class="background">
      {#each gen.primary.background as b (b.text)}<li>{b.text}</li>{/each}
    </ul>
    <p class="footnote">
      世代名はこのゲーム独自の呼び名です。背景の説明は、質問データの出典付きの情報にもとづいています。
    </p>
  </section>

  <DecadeChart decades={e.decadeProbabilities} />
  <ReasoningReport report={result.report} traits={result.traits} />
  <AnswerCheck estimate={e} />
  <SharePanel estimate={e} generationName={gen.primary.name} {url} />

  <p class="saved" role="status">
    {historySaved
      ? '結果をこの端末のプレイ履歴に保存しました（回答内容は保存していません）。'
      : 'この環境では履歴を保存できませんでした（プライベートブラウズ等）。'}
  </p>

  <div class="actions">
    <button type="button" class="btn-primary" onclick={onretry}>もう一度分析する</button>
    <button type="button" class="btn-secondary" onclick={onhistory}>プレイ履歴を見る</button>
  </div>
</main>

<style>
  .result {
    display: grid;
    gap: var(--space-4);
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
  }
  .hero {
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
    margin: var(--space-3) 0 var(--space-1);
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
    margin: var(--space-5) 0 0;
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
  .concentration {
    display: block;
    margin-top: 2px;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 400;
    color: var(--color-text-faint);
  }
  .gen-name {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--cyan-300);
  }
  .gen-tagline {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
  .common {
    margin: var(--space-2) 0 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .sub {
    margin: var(--space-4) 0 var(--space-2);
    font-size: 0.8125rem;
    color: var(--color-accent);
  }
  .background {
    margin: 0;
    padding-left: 1.2em;
    font-size: 0.875rem;
    line-height: 1.75;
    color: var(--color-text-muted);
  }
  .saved {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-faint);
    text-align: center;
  }
  .actions {
    display: grid;
    gap: var(--space-2);
  }
</style>
