<!--
  質問画面（設計書 7.3）：分析ステータス・解析進捗・推定年代レーダー・質問・選択肢。
  回答 → スキャン演出 →（基本質問の終了時は精密分析への移行演出）→ 次の質問。
-->
<script lang="ts">
  import { tick } from 'svelte';
  import EraRadar from '../components/EraRadar.svelte';
  import PhaseTransition from '../components/PhaseTransition.svelte';
  import ScanOverlay from '../components/ScanOverlay.svelte';
  import StatusBar from '../components/StatusBar.svelte';
  import type { GameFlow } from '../game/flow';
  import { durations } from '../motion';

  let { flow, onfinished }: { flow: GameFlow; onfinished: () => void } = $props();

  // flow はこの画面の表示中は変わらないため、最初の値で初期化してよい
  // svelte-ignore state_referenced_locally
  let view = $state(flow.view());
  let busy = $state(false);
  let selected = $state<string | null>(null);
  let overlay = $state<'scan' | 'transition' | null>(null);
  let candidate = $state<string | null>(null);
  let heading = $state<HTMLElement>();
  let resolveOverlay: (() => void) | null = null;
  const d = durations();
  const DIFFICULTY = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' } as const;

  function play(kind: 'scan' | 'transition'): Promise<void> {
    if (kind === 'scan' && d.scan === 0) return Promise.resolve();
    return new Promise((resolve) => {
      resolveOverlay = resolve;
      overlay = kind;
    });
  }

  function overlayDone() {
    overlay = null;
    const resolve = resolveOverlay;
    resolveOverlay = null;
    resolve?.();
  }

  async function choose(optionId: string) {
    if (busy || !view.question) return;
    busy = true;
    selected = optionId;
    const events = flow.answer(optionId, Date.now());
    await play('scan');
    if (events.includes('finished')) {
      onfinished();
      return;
    }
    const next = flow.view();
    if (events.includes('phase_change')) {
      candidate = next.radar?.label ?? null;
      await play('transition');
    }
    view = next;
    selected = null;
    busy = false;
    await tick();
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function onkeydown(e: KeyboardEvent) {
    if (busy || e.metaKey || e.ctrlKey || e.altKey || !view.question) return;
    const key = e.key.toUpperCase();
    const index = /^[1-6]$/.test(key) ? Number(key) - 1 : 'ABCDEF'.indexOf(key);
    const option = index >= 0 ? view.question.options[index] : undefined;
    if (option) {
      e.preventDefault();
      void choose(option.id);
    }
  }
</script>

<svelte:window {onkeydown} />

{#if view.question}
  {@const q = view.question}
  <main class="question-screen">
    <header class="top">
      <StatusBar number={q.number} progress={view.progress} phase={q.phase} />
      <EraRadar radar={view.radar} />
      <p class="status" aria-live="polite">
        <span class="dot" aria-hidden="true"></span>{view.status}
      </p>
    </header>

    <section class="card" aria-labelledby="question-text">
      <div class="tags">
        <span class="tag">{q.genreLabel}</span>
        <span class="tag level">{DIFFICULTY[q.difficulty]}</span>
      </div>
      <h1 id="question-text" class="question" tabindex="-1" bind:this={heading}>{q.text}</h1>
      {#if overlay === 'scan'}
        <ScanOverlay duration={d.scan} ondone={overlayDone} />
      {/if}
    </section>

    <div class="answers">
      <div class="options" role="group" aria-label="選択肢">
        {#each q.options as option (option.id)}
          <button
            type="button"
            class="option"
            class:selected={selected === option.id}
            disabled={busy}
            onclick={() => choose(option.id)}
          >
            <span class="key" aria-hidden="true">{option.key}</span>
            <span class="label">{option.label}</span>
          </button>
        {/each}
      </div>
      <div class="special" role="group" aria-label="その他の回答">
        {#each q.specialOptions as option (option.id)}
          <button
            type="button"
            class="secondary"
            class:selected={selected === option.id}
            disabled={busy}
            onclick={() => choose(option.id)}
          >
            {option.label}
          </button>
        {/each}
      </div>
      <p class="keyboard-hint">
        キーボードの 1〜{q.options.length} または A〜{q.options.at(-1)?.key} でも回答できます
      </p>
    </div>
  </main>
{/if}

{#if overlay === 'transition'}
  <PhaseTransition duration={d.transition} {candidate} ondone={overlayDone} />
{/if}

<style>
  .question-screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 100dvh;
    max-width: var(--content-max);
    margin: 0 auto;
    padding: var(--space-3) var(--space-4) var(--space-4);
    padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));
  }
  .top {
    display: grid;
    gap: var(--space-3);
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent-2);
    box-shadow: 0 0 10px var(--purple-400);
  }
  .card {
    position: relative;
    overflow: hidden;
    padding: var(--space-4);
    border: 1px solid var(--color-border-glow);
    border-radius: var(--radius-lg);
    background: var(--color-surface-glass);
    box-shadow: inset 0 0 24px rgb(34 211 238 / 6%);
  }
  .tags {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .tag {
    padding: 1px 8px;
    border-radius: var(--radius-sm);
    background: var(--navy-700);
    font-size: 0.6875rem;
    color: var(--color-text-muted);
  }
  .tag.level {
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--purple-400);
  }
  .question {
    margin: 0;
    font-size: clamp(1.125rem, 4.8vw, 1.375rem);
    line-height: 1.6;
    font-weight: 700;
  }
  .question:focus {
    outline: none;
  }
  .answers {
    display: grid;
    gap: var(--space-3);
    margin-top: auto; /* 選択肢は親指の届く画面下側に置く */
  }
  .options {
    display: grid;
    gap: var(--space-2);
  }
  .option {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--tap-min);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s,
      transform 0.1s;
  }
  .option:hover:not(:disabled) {
    border-color: var(--color-border-glow);
    box-shadow: var(--glow-accent);
  }
  .option:active:not(:disabled) {
    transform: scale(0.985);
  }
  .option.selected {
    border-color: var(--color-accent);
    box-shadow: var(--glow-accent);
    background: rgb(34 211 238 / 12%);
  }
  .option:disabled {
    cursor: default;
  }
  .key {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border-glow);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-accent);
  }
  .label {
    font-size: 1rem;
    line-height: 1.45;
  }
  .special {
    display: flex;
    gap: var(--space-2);
  }
  .secondary {
    flex: 1;
    min-height: var(--tap-secondary);
    padding: var(--space-1) var(--space-3);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .secondary:hover:not(:disabled) {
    border-color: var(--color-text-faint);
    color: var(--color-text);
  }
  .secondary.selected {
    border-style: solid;
    border-color: var(--color-accent);
    color: var(--color-text);
  }
  .keyboard-hint {
    display: none;
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-faint);
    text-align: center;
  }
  @media (hover: hover) and (pointer: fine) {
    .keyboard-hint {
      display: block;
    }
  }
  @media (max-height: 860px) {
    .question-screen {
      gap: var(--space-2);
      padding-top: var(--space-2);
    }
    .top {
      gap: var(--space-2);
    }
    .card {
      padding: var(--space-3);
    }
    .options {
      gap: 6px;
    }
  }
  /* さらに低い端末（iPhone SE など）：ステータスは上部の表示で確認できるため1行を省く */
  @media (max-height: 700px) {
    .status {
      display: none;
    }
    .question {
      font-size: 1.0625rem;
    }
    .options {
      gap: 4px;
    }
    .question-screen {
      padding-bottom: var(--space-2);
    }
  }
  @media (min-width: 900px) {
    .question-screen {
      padding-top: var(--space-6);
    }
  }
</style>
