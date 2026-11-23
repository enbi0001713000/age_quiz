<!-- プレイ履歴（要件 9章）：一覧・比較・削除・空の状態・保存についての説明 -->
<script lang="ts">
  import type { Generations } from '../../data/schema';
  import type { HistoryEntry } from '../../storage/history';
  import { birthText, CONFIDENCE_LABELS } from '../format';

  let {
    entries,
    generations,
    persistent,
    ondelete,
    onclear,
    onback,
    onstart,
  }: {
    entries: HistoryEntry[];
    generations: Generations | undefined;
    persistent: boolean;
    ondelete: (id: string) => void;
    onclear: () => void;
    onback: () => void;
    onstart: () => void;
  } = $props();

  let confirmClear = $state(false);
  const SCALE: [number, number] = [1930, 2020];
  const pos = (y: number) =>
    `${Math.min(100, Math.max(0, ((y - SCALE[0]) / (SCALE[1] - SCALE[0])) * 100))}%`;
  const genName = (id: string) => generations?.original.find((g) => g.id === id)?.name ?? '—';
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  // 結果画面と同じ見出し（確信度に応じた表し方）
  const birth = (e: HistoryEntry) => birthText(e.estimate).headline;
</script>

<main class="history">
  <button type="button" class="link-back" onclick={onback}>← タイトルへ戻る</button>
  <h1 class="title">プレイ履歴</h1>

  {#if entries.length === 0}
    <section class="panel empty">
      <p>まだプレイ履歴はありません。</p>
      <button type="button" class="btn-primary" onclick={onstart}>分析を開始する</button>
    </section>
  {:else}
    <p class="lead">
      過去の推定結果（新しい順・最大50件）。帯は推定した生年の範囲、点は推定生年です。
    </p>
    <ol class="list">
      {#each entries as e (e.id)}
        <li class="panel item">
          <div class="head">
            <span class="date">{fmtDate(e.playedAt)}</span>
            <button
              type="button"
              class="delete"
              aria-label="{fmtDate(e.playedAt)}の履歴を削除"
              onclick={() => ondelete(e.id)}
            >
              削除
            </button>
          </div>
          <p class="birth">{birth(e)}</p>
          <p class="meta">
            推定年齢 {e.estimate.ageRange[0]}〜{e.estimate.ageRange[1]}歳（プレイ時点）・{genName(
              e.estimate.generationId,
            )}・確信度 {CONFIDENCE_LABELS[e.estimate.confidence]}
          </p>
          <div class="scale" aria-hidden="true">
            <span
              class="range"
              style:left={pos(e.estimate.birthRange[0])}
              style:right="calc(100% - {pos(e.estimate.birthRange[1] + 1)})"
            ></span>
            <span class="point" style:left={pos(e.estimate.birthYear + 0.5)}></span>
          </div>
        </li>
      {/each}
    </ol>
    <div class="ticks" aria-hidden="true">
      {#each [1930, 1950, 1970, 1990, 2010] as t (t)}<span style:left={pos(t)}>{t}</span>{/each}
    </div>
    <div class="clear">
      {#if confirmClear}
        <p>すべての履歴を削除します。元に戻せません。</p>
        <button
          type="button"
          class="btn-secondary danger"
          onclick={() => {
            onclear();
            confirmClear = false;
          }}
        >
          すべて削除する
        </button>
        <button type="button" class="btn-secondary" onclick={() => (confirmClear = false)}>
          やめる
        </button>
      {:else}
        <button type="button" class="btn-secondary" onclick={() => (confirmClear = true)}>
          履歴をすべて削除
        </button>
      {/if}
    </div>
  {/if}

  <p class="footnote">
    履歴はこの端末のブラウザ内（LocalStorage）にだけ保存され、外部には送信されません。保存しているのは推定結果だけで、回答内容や入力した実年齢は保存していません。ブラウザの閲覧データを削除すると、履歴も消えます。
    {#if !persistent}現在の環境（プライベートブラウズ等）では、ページを閉じると履歴が消えます。{/if}
  </p>
</main>

<style>
  .history {
    display: grid;
    gap: var(--space-3);
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-4) var(--space-4) var(--space-8);
  }
  .title {
    margin: 0;
    font-size: 1.5rem;
  }
  .lead {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    text-align: center;
    color: var(--color-text-muted);
  }
  .list {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    padding: var(--space-3) var(--space-4);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .date {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }
  .delete {
    min-height: var(--tap-secondary);
    padding: 0 var(--space-3);
    border: 0;
    background: transparent;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .birth {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--cyan-300);
  }
  .meta {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  .scale {
    position: relative;
    height: 10px;
    margin-top: var(--space-2);
    border-radius: 999px;
    background: var(--navy-700);
  }
  .range {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--blue-500), var(--purple-500));
  }
  .point {
    position: absolute;
    top: -3px;
    width: 4px;
    height: 16px;
    margin-left: -2px;
    border-radius: 2px;
    background: var(--cyan-300);
    box-shadow: var(--glow-accent);
  }
  .ticks {
    position: relative;
    height: 1.2em;
    margin: 0 var(--space-4);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    color: var(--color-text-faint);
  }
  .ticks span {
    position: absolute;
    transform: translateX(-50%);
  }
  .clear {
    display: grid;
    gap: var(--space-2);
  }
  .clear p {
    margin: 0;
    font-size: 0.8125rem;
    color: #fca5a5;
  }
  .danger {
    border-color: #f87171;
    color: #fca5a5;
  }
</style>
