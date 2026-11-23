<!-- 推理レポート（要件 7-2）：影響した回答・年代的特徴・ジャンル・不確実性・回答の特徴 -->
<script lang="ts">
  import { GENRE_LABELS } from '../../data/constants';
  import type { ReasoningReport } from '../../engine';

  let { report, traits }: { report: ReasoningReport; traits: string[] } = $props();
  const maxGenre = $derived(Math.max(...report.genreInfluence.map((g) => g.influence), 1e-9));
  const u = $derived(report.uncertainty);
</script>

<section class="panel" aria-labelledby="report-title">
  <h2 class="panel-title" id="report-title">推理レポート <small>REASONING</small></h2>

  <h3 class="sub">推理の決め手になった回答</h3>
  <ol class="keys">
    {#each report.keyAnswers as k, i (k.questionId)}
      <li>
        <span class="rank" aria-hidden="true">{i + 1}</span>
        <div>
          <p class="q">{k.questionText}</p>
          <p class="a">あなたの回答：<strong>{k.optionLabel}</strong></p>
          {#if k.insight}<p class="insight">{k.insight}</p>{/if}
          {#if k.supportsBirthYears}
            <p class="supports">
              → {k.supportsBirthYears[0]}〜{k.supportsBirthYears[1]}年生まれの特徴と一致
            </p>
          {/if}
        </div>
      </li>
    {/each}
  </ol>

  <h3 class="sub">推定に影響したジャンル</h3>
  <ul class="genres">
    {#each report.genreInfluence.slice(0, 5) as g (g.genre)}
      <li>
        <span class="label">{GENRE_LABELS[g.genre]}</span>
        <span class="track" aria-hidden="true">
          <span class="bar" style:width="{(g.influence / maxGenre) * 100}%"></span>
        </span>
      </li>
    {/each}
  </ul>

  {#if traits.length}
    <h3 class="sub">回答から読み取れた特徴</h3>
    <ul class="traits">
      {#each traits as t (t)}<li>{t}</li>{/each}
    </ul>
  {/if}

  <h3 class="sub">推理の不確実性</h3>
  <p class="uncertainty">
    80%の確率で入るとモデルが計算した範囲は{u.intervalWidth}年分です。
    {#if u.dontRemember > 0}「覚えていない」{u.dontRemember}問は推理に使っていません。{/if}
    {#if u.notApplicable > 0}「該当しない」{u.notApplicable}問は推理から除外しました。{/if}
    {#if u.surprises > 0}推定と異なる傾向の回答が{u.surprises}問ありました。{/if}
    {#if u.multimodal}候補が2つの年代に分かれています。{/if}
  </p>
  <p class="footnote">
    回答から分かる範囲で推理しており、性格や経歴などを判断するものではありません。
  </p>
</section>

<style>
  .sub {
    margin: var(--space-4) 0 var(--space-2);
    font-size: 0.8125rem;
    color: var(--color-accent);
  }
  .sub:first-of-type {
    margin-top: 0;
  }
  .keys {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .keys li {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: var(--space-3);
  }
  .rank {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border-glow);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    color: var(--color-accent);
  }
  .q,
  .a,
  .insight,
  .supports {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.6;
  }
  .q {
    color: var(--color-text-muted);
  }
  .a strong {
    color: var(--color-text);
  }
  .insight {
    color: var(--color-text-faint);
  }
  .supports {
    color: var(--cyan-300);
  }
  .genres {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .genres li {
    display: grid;
    grid-template-columns: 11em 1fr;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  .track {
    height: 8px;
    border-radius: 999px;
    background: var(--navy-700);
    overflow: hidden;
  }
  .bar {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--purple-500), var(--blue-400));
  }
  .traits {
    margin: 0;
    padding-left: 1.2em;
    font-size: 0.8125rem;
    line-height: 1.7;
    color: var(--color-text-muted);
  }
  .uncertainty {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.7;
    color: var(--color-text-muted);
  }
</style>
