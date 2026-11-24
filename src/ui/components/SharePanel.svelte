<!-- 結果の共有（要件 10章）：画像保存・X・Web Share API・コピー。画像と文章に個人情報や回答内容は含めない -->
<script lang="ts">
  import { APP_INFO } from '../../app/appInfo';
  import type { Estimate } from '../../engine';
  import { canvasToBlob, drawCard } from '../../share/card';
  import { copyToClipboard, downloadBlob, shareNative } from '../../share/share';
  import { ageText, birthText, CONFIDENCE_LABELS } from '../format';
  import { copyText, shareText, xIntentUrl } from '../result/share';

  let {
    estimate,
    generationName,
    url,
  }: { estimate: Estimate; generationName: string; url: string } = $props();

  let message = $state('');
  // オフライン中は X の投稿画面を開けないため、ボタンを無効にする（画像保存・コピーはオフラインでも使える）
  let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
  $effect(() => {
    const update = () => (online = navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  });
  const text = $derived(shareText(estimate, generationName));
  const FILE_NAME = 'age-quiz-result.png';

  async function cardBlob(): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const b = birthText(estimate);
    drawCard(canvas, {
      appName: APP_INFO.name,
      headline: b.headline,
      detail: b.detail,
      ageText: ageText(estimate),
      generationName,
      confidenceLabel: CONFIDENCE_LABELS[estimate.confidence],
      decades: estimate.decadeProbabilities,
      url,
    });
    return canvasToBlob(canvas);
  }

  async function savePng() {
    try {
      downloadBlob(await cardBlob(), FILE_NAME);
      message = '結果画像を保存しました。';
    } catch {
      message = '画像を作成できませんでした。';
    }
  }

  async function copy() {
    message = (await copyToClipboard(copyText(text, url)))
      ? '結果の文章をコピーしました。'
      : 'コピーできませんでした。下の文章を選択してコピーしてください。';
  }

  async function share() {
    let file: File | undefined;
    try {
      file = new File([await cardBlob()], FILE_NAME, { type: 'image/png' });
    } catch {
      file = undefined;
    }
    const outcome = await shareNative({ title: APP_INFO.name, text, url, file });
    if (outcome === 'unsupported') {
      // 共有機能がない環境では、コピーで代替する
      const ok = await copyToClipboard(copyText(text, url));
      message = ok
        ? 'この端末では共有機能が使えないため、結果の文章をコピーしました。'
        : 'この端末では共有機能が使えません。画像保存かコピーをご利用ください。';
    } else if (outcome === 'shared') {
      message = '共有しました。';
    }
  }
</script>

<section class="panel" aria-labelledby="share-title">
  <h2 class="panel-title" id="share-title">結果をシェア <small>SHARE</small></h2>
  <div class="buttons">
    <button type="button" class="btn-secondary" onclick={savePng}>画像を保存</button>
    {#if online}
      <a
        class="btn-secondary"
        href={xIntentUrl(text, url)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Xで共有
      </a>
    {:else}
      <button type="button" class="btn-secondary" disabled title="オフラインのため使えません">
        Xで共有（オフライン）
      </button>
    {/if}
    <button type="button" class="btn-secondary" onclick={share}>共有する</button>
    <button type="button" class="btn-secondary" onclick={copy}>文章をコピー</button>
  </div>
  <p class="status" role="status" aria-live="polite">{message}</p>
  <p class="preview">{text}</p>
  <p class="footnote">
    画像・文章には推定結果だけが入り、回答内容や入力した年齢は含まれません。Xで共有するときは、保存した画像を投稿に添付できます。
  </p>
</section>

<style>
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .buttons > * {
    font-size: 0.9375rem;
  }
  .status {
    min-height: 1.4em;
    margin: var(--space-2) 0 0;
    font-size: 0.8125rem;
    color: var(--cyan-300);
  }
  .preview {
    margin: var(--space-1) 0 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--navy-900);
    font-size: 0.75rem;
    line-height: 1.7;
    color: var(--color-text-muted);
    user-select: all;
  }
</style>
