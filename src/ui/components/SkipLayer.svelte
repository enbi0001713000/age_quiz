<!--
  演出の共通部品：一定時間で終了し、タップ・クリック・キー入力でスキップできる。
  中身は子要素として渡す。
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    duration,
    ondone,
    label = '演出をスキップ',
    fixed = false,
    children,
  }: {
    duration: number;
    ondone: () => void;
    label?: string;
    /** 画面全体を覆うか（false なら親要素の上に重ねる） */
    fixed?: boolean;
    children: Snippet;
  } = $props();

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    ondone();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // スペースキーでページがスクロールしないようにする
    e.preventDefault();
    finish();
  }

  $effect(() => {
    const timer = setTimeout(finish, duration);
    return () => clearTimeout(timer);
  });
</script>

<svelte:window {onkeydown} />

<button type="button" class="layer" class:fixed onclick={finish} aria-label={label}>
  {@render children()}
</button>

<style>
  .layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: center;
  }
  .layer.fixed {
    position: fixed;
    z-index: 100;
  }
  .layer:focus-visible {
    outline: none;
  }
</style>
