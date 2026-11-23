<!-- 答え合わせ（要件 8章）：入力は任意。入力した年齢はこの画面の中だけで使い、保存・送信しない -->
<script lang="ts">
  import type { Estimate } from '../../engine';
  import { checkActualAge, isValidAge, MAX_AGE, MIN_AGE } from '../result/answerCheck';

  let { estimate }: { estimate: Estimate } = $props();
  // 数値入力欄の値（空欄は null）
  let value = $state<number | null>(null);
  let submitted = $state<number | null>(null);
  const valid = $derived(typeof value === 'number' && isValidAge(value));
  const result = $derived(submitted === null ? null : checkActualAge(estimate, submitted));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (valid) submitted = value;
  }
</script>

<section class="panel" aria-labelledby="check-title">
  <h2 class="panel-title" id="check-title">答え合わせ（任意）<small>CHECK</small></h2>
  <form class="form" onsubmit={submit}>
    <label for="actual-age">実際の年齢</label>
    <div class="row">
      <input
        id="actual-age"
        type="number"
        inputmode="numeric"
        min={MIN_AGE}
        max={MAX_AGE}
        placeholder="例：35"
        bind:value
        autocomplete="off"
      />
      <span class="unit">歳</span>
      <button type="submit" class="btn-secondary" disabled={!valid}>答え合わせ</button>
    </div>
  </form>
  {#if result}
    <p class="result {result.verdict}" role="status">{result.message}</p>
  {/if}
  <p class="footnote">
    入力した年齢は答え合わせにだけ使い、保存・送信しません（履歴にも残りません）。
  </p>
</section>

<style>
  .form {
    display: grid;
    gap: var(--space-2);
  }
  label {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  input {
    width: 6.5em;
    min-height: var(--tap-secondary);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--navy-900);
    font: inherit;
    font-size: 1.125rem;
    color: var(--color-text);
  }
  .unit {
    color: var(--color-text-muted);
  }
  .row .btn-secondary {
    min-height: var(--tap-secondary);
    margin-left: auto;
  }
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .result {
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--navy-700);
    font-weight: 700;
  }
  .result.match {
    color: var(--cyan-300);
  }
</style>
