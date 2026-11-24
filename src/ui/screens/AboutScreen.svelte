<!-- このゲームについて：推定の仕組み・確信度の意味・プライバシー・設定・出典一覧 -->
<script lang="ts">
  import { APP_INFO } from '../../app/appInfo';
  import type { Source } from '../../data/schema';
  import type { Settings } from '../../storage/settings';

  let {
    sources,
    settings,
    dataVersion,
    offlineReady,
    onsettings,
    onback,
  }: {
    sources: Source[];
    settings: Settings;
    dataVersion: string | null;
    offlineReady: boolean;
    onsettings: (s: Settings) => void;
    onback: () => void;
  } = $props();

  const reduce = $derived(settings.motion === 'reduce');
  const TYPE_LABEL: Record<Source['type'], string> = {
    official: '公式・官公庁',
    statistics: '統計',
    press: '報道・専門メディア',
    book: '書籍・図書館',
    encyclopedia: '百科事典',
  };
</script>

<main class="about">
  <button type="button" class="link-back" onclick={onback}>← タイトルへ戻る</button>
  <h1 class="title">このゲームについて</h1>

  <section class="panel">
    <h2 class="panel-title">推定の仕組み <small>METHOD</small></h2>
    <p>
      子どもの頃に流行したゲーム・アニメ・家電・学校の制度などの発売時期や普及時期（公式資料・統計・報道で確認した情報）をもとに、「その年に生まれた人が、その回答をする確率」を計算し、回答のたびに生まれた年の確率を更新しています。
    </p>
    <p>
      本作の「AI分析」は、この端末のブラウザ内で動く確率モデルです。外部のAIサービスは使っていません。
    </p>
  </section>

  <section class="panel">
    <h2 class="panel-title">確信度と確率について <small>CONFIDENCE</small></h2>
    <p>
      確信度・分析集中度・年代別の推定確率は、AIモデルが回答から算出した相対的な値です。実際の的中率や、統計的に保証された確率ではありません。文化的な経験には個人差（兄姉の影響・地域差・好みなど）があるため、推定が外れることもあります。
    </p>
    <p>誕生日は聞いていないため、年齢は「〜歳」の範囲で表示します。</p>
  </section>

  <section class="panel">
    <h2 class="panel-title">プライバシー <small>PRIVACY</small></h2>
    <ul>
      <li>名前・年齢・性別などの個人情報の入力は不要です。</li>
      <li>回答の処理はすべてこの端末の中で行い、外部に送信しません。</li>
      <li>
        プレイ履歴は推定結果だけをこの端末のブラウザ内（LocalStorage）に保存します。回答内容や答え合わせで入力した年齢は保存しません。ブラウザの閲覧データを削除すると履歴も消えます。
      </li>
      <li>
        このページは GitHub Pages
        で配信しています。配信元（GitHub社）がアクセスの記録（IPアドレス等）を取得する場合があります。
      </li>
      <li>
        オフラインで遊べるよう、ゲームのファイル（画面・質問データ）をこの端末のブラウザ内に保存します。保存するのはゲームのファイルだけで、回答や個人の情報は含みません。
      </li>
    </ul>
  </section>

  <section class="panel" aria-labelledby="offline-title">
    <h2 class="panel-title" id="offline-title">オフラインとバージョン <small>OFFLINE</small></h2>
    <p>
      初めて開いたときにゲームのファイルをこの端末に保存し、2回目以降は通信がなくても遊べます（初回だけ通信が必要です）。新しいバージョンが公開されると、タイトル画面にお知らせが出ます。プレイ中に切り替わることはありません。
    </p>
    <p class="status-line">
      状態：{offlineReady
        ? 'オフラインで遊べます（この端末に保存済み）'
        : 'オフライン用の保存はまだ完了していません'}
    </p>
    <p class="footnote">
      アプリ v{APP_INFO.version}{dataVersion ? `・質問データ ${dataVersion}` : ''}
    </p>
  </section>

  <section class="panel">
    <h2 class="panel-title">設定 <small>SETTINGS</small></h2>
    <label class="toggle">
      <input
        type="checkbox"
        checked={reduce}
        onchange={(e) => onsettings({ motion: e.currentTarget.checked ? 'reduce' : 'system' })}
      />
      <span>演出を短縮する（スキャンなどのアニメーションを省きます）</span>
    </label>
    <p class="footnote">オフのときは、端末の「視差効果を減らす」設定に従います。</p>
  </section>

  <section class="panel">
    <h2 class="panel-title">
      出典一覧{sources.length ? `（${sources.length}件）` : ''} <small>SOURCES</small>
    </h2>
    {#if sources.length === 0}
      <p class="footnote">出典データを読み込んでいます…</p>
    {:else}
      <details>
        <summary>質問データの根拠にした資料を表示</summary>
        <ul class="sources">
          {#each sources as s (s.id)}
            <li>
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
              <span class="pub">{s.publisher}（{TYPE_LABEL[s.type]}・確認日 {s.accessed}）</span>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </section>
</main>

<style>
  .about {
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
  p,
  li {
    font-size: 0.875rem;
    line-height: 1.75;
    color: var(--color-text-muted);
  }
  p {
    margin: 0 0 var(--space-2);
  }
  ul {
    margin: 0;
    padding-left: 1.2em;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap-secondary);
    font-size: 0.875rem;
    cursor: pointer;
  }
  .toggle input {
    width: 22px;
    height: 22px;
    accent-color: var(--cyan-400);
  }
  summary {
    min-height: var(--tap-secondary);
    font-size: 0.875rem;
    color: var(--color-accent);
    cursor: pointer;
  }
  .status-line {
    color: var(--cyan-300);
  }
  .sources {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .sources a {
    color: var(--cyan-300);
  }
  .pub {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }
</style>
