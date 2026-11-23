# 開発記録

各Phaseの終了時に、実装内容・変更ファイル・テスト結果・問題と解決・未解決事項・次の予定を記録する（マスタープロンプト 5-4）。

---

## Phase 0：要件理解・技術設計（2026-11-23）

**ステータス**：**承認済み**（2026-11-23：PR #1 マージ、確認事項 Q1〜Q4 を推奨案どおり承認）

### 実施内容
- 要件定義書 v1.0・マスタープロンプトをリポジトリに保存（`docs/requirements/`）
- 機能分解、実現可能性の確認、技術スタック比較、推理アルゴリズム設計、質問データ設計、画面設計、LocalStorage・オフライン・共有の設計、テスト計画、リスク分析を `docs/phase0/design.md` にまとめた
- 推理アルゴリズムの妥当性を、架空の合成データによるシミュレーションで検証した（`docs/phase0/feasibility_sim.py`）

### 変更ファイル
- `docs/requirements/requirements_v1.0.md`（新規）
- `docs/requirements/master_prompt.md`（新規）
- `docs/phase0/design.md`（新規）
- `docs/phase0/feasibility_sim.py`（新規・設計検証用。製品コードではない）
- `docs/dev-log.md`（新規）
- `README.md`（更新）

### テスト結果（設計検証シミュレーション）

| テスト項目 | 方法 | 期待結果 | 実際の結果 | 合否 |
|---|---|---|---|---|
| 頑健化なしのベイズ推定の過信 | 合成質問250問・仮想回答者243人、現実とのずれ（大） | 80%区間に正解が約80%入る | 41%（過信） | 不合格 → 設計で対策 |
| 頑健化＋文化的ずれ校正 | 同上 | 約80% | 76%（ずれ小では89%） | 概ね合格（パラメータは実地テストで再調整） |
| 質問数 | 同上（最低10・最大25） | 3〜5分に収まる質問数 | 平均15〜17問 | 合格 |

※合成データは実在の年代情報を使っておらず、誤差の値は実データでの精度予測ではない。

### 発生した問題と解決
- 素朴なベイズ推定は過信する（上表）→ ランダム回答混合・温度・文化的生年のずれの畳み込みによる校正を設計に組み込んだ（design.md 5.7, 5.10）

### 未解決事項
- design.md 16章の確認事項 Q1〜Q11（特に Q1〜Q4 は Phase 1〜3 の前提）

### 次の予定
- PO承認後、Phase 1（プロジェクト基盤構築）に着手

---

## Phase 1：プロジェクト基盤構築（2026-11-23）

**ステータス**：完了・**PO承認待ち**

### 達成条件と結果
| 達成条件 | 結果 |
|---|---|
| ローカル環境で正常に起動する | ✅ 開発サーバー・本番ビルドの両方でタイトル画面を表示、エラーなし |
| ディレクトリ構成が整理されている | ✅ 設計書 11章に沿って構築。各ディレクトリの責務を README に記載 |
| GitHub Pagesで公開可能な構成 | ✅ 公開パス `/age_quiz/` でビルドし、その状態でE2Eテスト合格。デプロイ用ワークフローを用意（手動実行） |

### 実装内容
- Vite 8 + Svelte 5 + TypeScript 6.0 のプロジェクトを初期化
- 開発ツール：Vitest（単体テスト）、Playwright 1.63.0（E2E）、ESLint、Prettier、svelte-check（型検査）
- **推理エンジンの独立性を ESLint で強制**：`src/engine/` から Svelte・UI・保存・共有の層、およびブラウザ API（window, document, localStorage 等）を参照するとエラー
- デザイントークン（設計書 7.5 のブランドカラー）と全体スタイル（端末標準の日本語フォント、動きを減らす設定への対応）
- 起動確認用の仮タイトル画面（本実装は Phase 4）
- GitHub Actions：CI（整形・Lint・型検査・単体テスト・ビルド・E2E）、GitHub Pages デプロイ（手動実行のみ）
- `index.html` に `noindex`（一般公開まで検索エンジンに載せない）

### 変更ファイル
- 新規：`package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `eslint.config.js`, `tsconfig.json`, `svelte.config.js`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `public/favicon.svg`
- 新規：`src/main.ts`, `src/App.svelte`, `src/vite-env.d.ts`, `src/app/appInfo.ts`, `src/ui/screens/TitleScreen.svelte`, `src/styles/tokens.css`, `src/styles/global.css`
- 新規：`tests/unit/appInfo.test.ts`, `tests/e2e/boot.spec.ts`
- 新規：`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- 新規：`data/README.md`, `src/README.md`, `scripts/README.md`
- 更新：`README.md`, `docs/dev-log.md`, `docs/phase0/design.md`（承認状況を記録）

### テスト結果
| テスト項目 | 方法 | 期待結果 | 実際の結果 | 合否 |
|---|---|---|---|---|
| コード整形 | `npm run format:check` | 差分なし | 差分なし | 合格 |
| Lint | `npm run lint` | エラー0 | エラー0 | 合格 |
| エンジン独立ルール | 違反コード（Svelte import・UI import・window・localStorage）を一時作成して Lint | 4件すべて検出 | 4件検出（確認後に削除） | 合格 |
| 型検査 | `npm run check` | エラー・警告0 | 0 / 0 | 合格 |
| 単体テスト | `npm test`（Vitest） | 全件合格 | 3/3 合格 | 合格 |
| 本番ビルド | `npm run build` | 成功、参照パスが `/age_quiz/` 配下 | 成功。JS 37.4KB（gzip 15.0KB）、CSS 2.4KB | 合格 |
| 起動（公開パス） | Playwright：ビルド成果物を `/age_quiz/` で配信し表示 | タイトル表示、コンソールエラー・読込失敗なし | スマホ小（360×740）・Pixel 7・PC の3環境で合格 | 合格 |
| 外部通信なし | Playwright：全リクエストの送信先を記録 | 同一オリジンのみ | 外部通信0件（3環境） | 合格 |
| 横スクロールなし | Playwright：ページ幅を計測 | はみ出し0 | 0（3環境） | 合格 |
| 検索エンジン除外 | Playwright：robots meta | noindex あり | あり（3環境） | 合格 |
| 開発サーバー | `vite` 起動後にブラウザ表示 | エラーなく表示 | 表示OK、エラーなし | 合格 |
| CI（GitHub Actions） | PR 上で実行 | 全ジョブ合格 | PR 作成後に確認 | — |

### 判断事項（軽微・初期値として採用）
- **TypeScript は 6.0 系**：最新の 7.0 は svelte-check・typescript-eslint が未対応のため
- **デプロイは手動実行のみ**：公開タイミングは PO が決めるため。初回は Settings → Pages → Source を「GitHub Actions」に設定する必要がある
- **robots.txt は置かない**：プロジェクトページ（`/age_quiz/`）の robots.txt はドメイン直下ではないため効果がない。代わりに `noindex` メタタグを使用
- **未使用の依存は入れない**：vite-plugin-pwa（Phase 7）、Zod（Phase 2）は必要になる Phase で追加
- 空のディレクトリ（`src/engine/` 等）は Git で管理されないため、役割は `src/README.md` に記載し、中身を作る Phase で作成

### 発生した問題と解決
- `npm install` で `@playwright/test` が範囲指定（^1.63.0）で登録された → 環境のブラウザと一致させるため 1.63.0 に完全固定

### 未解決事項
- GitHub Pages の有効化（PO によるリポジトリ設定）
- 設計書 16章 Q5〜Q11（Phase 2 以降で必要に応じて確認）

### 次の予定
- PO 承認後、Phase 2（質問データベースの試作：48問）。冒頭で作業環境から出典サイトへのWebアクセスを確認する
