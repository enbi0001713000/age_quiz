<!--
  画面の切り替え：タイトル → 質問 → 最終判定演出 → 結果（Phase 4 は暫定の結果画面）
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Estimate } from './engine';
  import FinalAnalysis from './ui/components/FinalAnalysis.svelte';
  import type { GameFlow } from './ui/game/flow';
  import type { GameFactory } from './ui/game/loadGame';
  import { durations } from './ui/motion';
  import QuestionScreen from './ui/screens/QuestionScreen.svelte';
  import ResultPreview from './ui/screens/ResultPreview.svelte';
  import TitleScreen from './ui/screens/TitleScreen.svelte';

  type Screen = 'title' | 'question' | 'final' | 'result';
  let screen = $state<Screen>('title');
  let factory = $state<GameFactory | null>(null);
  let loadError = $state<string | null>(null);
  let flow = $state<GameFlow | null>(null);
  let estimate = $state<Estimate | null>(null);
  let answered = $state(0);

  onMount(() => {
    // 質問データと推理モデルは、タイトル画面を表示してから読み込む
    import('./ui/game/loadGame')
      .then((m) => (factory = m.prepareGame()))
      .catch((e: unknown) => {
        loadError = 'データの読み込みに失敗しました。ページを再読み込みしてください。';
        console.error(e);
      });
  });

  function start() {
    if (!factory) return;
    flow = factory.newGame();
    screen = 'question';
  }

  function finishQuestions() {
    if (!flow) return;
    estimate = flow.finalEstimate();
    answered = flow.session.answers.length;
    screen = 'final';
  }

  function showResult() {
    screen = 'result';
    window.scrollTo({ top: 0 });
  }

  function retry() {
    estimate = null;
    flow = null;
    screen = 'title';
  }
</script>

{#if screen === 'title'}
  <TitleScreen ready={factory !== null} error={loadError} onstart={start} />
{:else if screen === 'question' && flow}
  {#key flow}
    <QuestionScreen {flow} onfinished={finishQuestions} />
  {/key}
{:else if screen === 'final'}
  <FinalAnalysis duration={durations().final} {answered} ondone={showResult} />
{:else if screen === 'result' && estimate}
  <ResultPreview {estimate} {answered} onretry={retry} />
{/if}
