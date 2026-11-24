<!--
  画面の切り替え：タイトル → 質問 → 最終判定演出 → 結果 ／ プレイ履歴 ／ このゲームについて
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { APP_INFO } from './app/appInfo';
  import {
    addHistory,
    clearHistory,
    deleteHistory,
    loadHistory,
    newHistoryId,
    type HistoryEntry,
  } from './storage/history';
  import { loadSettings, saveSettings, type Settings } from './storage/settings';
  import { openStore } from './storage/storage';
  import { pwa, startPwa, updateNow } from './app/pwa.svelte';
  import FinalAnalysis from './ui/components/FinalAnalysis.svelte';
  import type { GameFlow } from './ui/game/flow';
  import type { GameFactory } from './ui/game/loadGame';
  import { durations } from './ui/motion';
  import type { ResultBundle } from './ui/result/bundle';
  import { appUrl } from './ui/result/share';
  import AboutScreen from './ui/screens/AboutScreen.svelte';
  import HistoryScreen from './ui/screens/HistoryScreen.svelte';
  import QuestionScreen from './ui/screens/QuestionScreen.svelte';
  import ResultScreen from './ui/screens/ResultScreen.svelte';
  import TitleScreen from './ui/screens/TitleScreen.svelte';

  type Screen = 'title' | 'question' | 'final' | 'result' | 'history' | 'about';
  const storage = openStore();
  let screen = $state<Screen>('title');
  let factory = $state<GameFactory | null>(null);
  let loadError = $state<string | null>(null);
  let flow = $state<GameFlow | null>(null);
  let result = $state<ResultBundle | null>(null);
  let historySaved = $state(false);
  let history = $state<HistoryEntry[]>(loadHistory(storage.store));
  let settings = $state<Settings>(loadSettings(storage.store));

  onMount(() => {
    // オフライン対応（Service Worker）。新しい版はタイトル画面でだけ切り替えを案内する
    void startPwa();
    // 質問データと推理モデルは、タイトル画面を表示してから読み込む
    import('./ui/game/loadGame')
      .then((m) => (factory = m.prepareGame()))
      .catch((e: unknown) => {
        loadError = 'データの読み込みに失敗しました。ページを再読み込みしてください。';
        console.error(e);
      });
  });

  function go(next: Screen) {
    screen = next;
    window.scrollTo({ top: 0 });
  }

  function start() {
    if (!factory) return;
    flow = factory.newGame();
    result = null;
    go('question');
  }

  function finishQuestions() {
    if (!flow || !factory) return;
    const bundle = factory.buildResult(flow);
    const e = bundle.estimate;
    // 履歴には推定結果だけを保存する（回答内容・実年齢は保存しない）
    historySaved =
      addHistory(storage.store, {
        id: newHistoryId(),
        playedAt: new Date().toISOString(),
        estimate: {
          birthYear: e.birthYear,
          birthRange: e.birthRange,
          displayRange: e.displayRange,
          ageRange: e.ageRange,
          generationId: bundle.generation.primary.id,
          confidence: e.confidence,
        },
        engineVersion: APP_INFO.version,
        dataVersion: factory.dataVersion,
      }) && storage.persistent;
    history = loadHistory(storage.store);
    result = bundle;
    go('final');
  }

  function removeEntry(id: string) {
    deleteHistory(storage.store, id);
    history = loadHistory(storage.store);
  }

  function removeAll() {
    clearHistory(storage.store);
    history = loadHistory(storage.store);
  }

  function updateSettings(next: Settings) {
    settings = next;
    saveSettings(storage.store, next);
  }
</script>

{#if screen === 'title'}
  <TitleScreen
    ready={factory !== null}
    error={loadError}
    onstart={start}
    onhistory={() => go('history')}
    onabout={() => go('about')}
    updateAvailable={pwa.needRefresh}
    offlineReady={pwa.offlineReady}
    offlineSupported={pwa.supported}
    onupdate={updateNow}
  />
{:else if screen === 'question' && flow}
  {#key flow}
    <QuestionScreen {flow} motion={settings.motion} onfinished={finishQuestions} />
  {/key}
{:else if screen === 'final' && result}
  <FinalAnalysis
    duration={durations(settings.motion).final}
    answered={result.answered}
    ondone={() => go('result')}
  />
{:else if screen === 'result' && result}
  <ResultScreen
    {result}
    url={appUrl(window.location)}
    {historySaved}
    onretry={() => go('title')}
    onhistory={() => go('history')}
  />
{:else if screen === 'history'}
  <HistoryScreen
    entries={history}
    generations={factory?.dataset.generations}
    currentDataVersion={factory?.dataVersion ?? null}
    persistent={storage.persistent}
    ondelete={removeEntry}
    onclear={removeAll}
    onback={() => go('title')}
    onstart={start}
  />
{:else if screen === 'about'}
  <AboutScreen
    sources={factory?.dataset.sources ?? []}
    {settings}
    dataVersion={factory?.dataVersion ?? null}
    offlineReady={pwa.offlineReady}
    onsettings={updateSettings}
    onback={() => go('title')}
  />
{/if}
