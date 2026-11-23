# age_quiz — 年齢推理ゲーム（仮称）

質問への回答から、子どもの頃に触れた文化的経験（ゲーム・アニメ・テレビ・携帯電話・学校生活など）を手掛かりに、回答者の**生年**を確率的に推理するブラウザゲーム。

- 公開先：GitHub Pages（静的サイト・サーバー不要）
- スマートフォン優先／PC対応／オフライン対応予定
- 個人情報は外部に送信しない。外部AI APIは使用しない

## 現在の状況

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 要件理解・技術設計 | 承認済み（Q1〜Q4） |
| 1 | プロジェクト基盤構築 | 承認済み |
| 2 | 質問データベースの試作（48問） | 承認済み |
| 3 | 推理エンジン | **完了・承認待ち** |
| 4〜9 | 画面 → 結果・共有 → データ拡張 → オフライン → 総合テスト → 公開 | 未着手 |

## 開発の始め方

必要なもの：Node.js 22（`.nvmrc`）

```bash
npm ci            # 依存関係のインストール
npm run dev       # 開発サーバー起動 → http://localhost:5173/age_quiz/
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（`dist/`） |
| `npm run preview` | 本番ビルドをローカルで確認 |
| `npm test` | 単体テスト・精度の回帰テスト（Vitest） |
| `npm run test:e2e` | E2Eテスト（Playwright：スマホ2サイズ＋PC） |
| `npm run lint` / `npm run check` | Lint / 型検査 |
| `npm run validate:data` | 質問データの形式・出典・整合性の検査 |
| `npm run report:coverage` | 年代別経験確率と質問データ分析レポートの再生成 |
| `npm run simulate` | 仮想回答者による推理精度の評価（`docs/phase3/simulation-report.md`、約30秒） |
| `npm run simulate:tune` | 上記＋パラメータ探索（`docs/phase3/tuning.md`、約3分） |
| `npm run format` | コード整形 |
| `npm run verify` | 整形確認・Lint・型検査・データ検証・単体テスト・ビルドを一括実行 |

## 技術構成

TypeScript 6.0 / Vite 8 / Svelte 5 / Vitest / Playwright / ESLint / Prettier。選定理由は [設計書 4章](docs/phase0/design.md#4-技術スタックの比較と推奨)。

## ディレクトリ構成

| パス | 内容 |
|---|---|
| `data/` | 質問データ・事実・出典（推理ロジックと分離）→ [data/README.md](data/README.md) |
| `src/` | アプリ本体（推理エンジン・UI・保存・共有）→ [src/README.md](src/README.md) |
| `scripts/` | データ検証・シミュレーション等の開発ツール → [scripts/README.md](scripts/README.md) |
| `tests/` | 単体テスト（`unit/`）・E2Eテスト（`e2e/`） |
| `docs/` | 要件・設計・開発記録 |
| `.github/workflows/` | CI（`ci.yml`）・GitHub Pagesデプロイ（`deploy.yml`、手動実行） |

## GitHub Pages への公開

`deploy.yml` は**手動実行のみ**（公開タイミングはプロダクトオーナーが決定）。初回は次の設定が必要：

1. リポジトリの **Settings → Pages → Build and deployment → Source** を「**GitHub Actions**」にする
2. **Actions → Deploy to GitHub Pages → Run workflow** を実行
3. `https://<ユーザー名>.github.io/age_quiz/` で公開される

一般公開（Phase 9）までは `index.html` の `noindex` 指定により検索エンジンに載らない。

## ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/requirements/requirements_v1.0.md](docs/requirements/requirements_v1.0.md) | 要件定義書 v1.0（基本仕様） |
| [docs/requirements/master_prompt.md](docs/requirements/master_prompt.md) | 開発マスタープロンプト（開発の進め方） |
| [docs/phase0/design.md](docs/phase0/design.md) | Phase 0 設計書（技術選定・推理アルゴリズム・データ設計・画面設計・テスト計画・リスク） |
| [docs/phase0/feasibility_sim.py](docs/phase0/feasibility_sim.py) | 推理アルゴリズムの設計検証シミュレーション（合成データ） |
| [docs/data-guidelines.md](docs/data-guidelines.md) | 質問データ作成ガイドライン（出典・事実・モデル値のルール） |
| [docs/phase2/coverage-report.md](docs/phase2/coverage-report.md) | 質問データ分析レポート（自動生成） |
| [docs/phase3/simulation-report.md](docs/phase3/simulation-report.md) | 推理エンジンのシミュレーション評価（自動生成） |
| [docs/phase3/tuning.md](docs/phase3/tuning.md) | 推理パラメータの探索結果（自動生成） |
| [docs/dev-log.md](docs/dev-log.md) | 開発記録 |
