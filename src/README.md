# src/ — アプリ本体

| ディレクトリ | 責務 | 作成Phase |
|---|---|---|
| `app/` | アプリ全体の基本情報・起動処理 | 1 |
| `engine/` | **推理エンジン**（生年の確率推定・質問選択・終了判定・確信度）。UI やブラウザ API に依存しない純粋な TypeScript（ESLint で強制）。公開APIは `index.ts`。`exposure.ts`・`optionModel.ts`（経験確率）、`compile.ts`（生年候補・事前確率・尤度表）、`posterior.ts`（年代ポイント加算と確率更新）、`selector.ts`（情報利得による質問選択）、`termination.ts`（終了判定）、`estimate.ts`（校正・確信度・年齢範囲）、`report.ts`（推理の根拠）、`session.ts`（1プレイの進行）、`config.ts`（パラメータ） | 2〜3（作成済み） |
| `data/` | 質問データの形式定義（`schema.ts`）・整合性検査（`validate.ts`）・アプリへの同梱（`bundle.ts`） | 2〜4（作成済み） |
| `storage/` | プレイ履歴・設定（LocalStorage） | 5 |
| `share/` | 共有画像の描画（Canvas）・共有処理 | 5 |
| `ui/screens/` | 画面（タイトル・質問・暫定の結果。結果・履歴・推定の仕組みは Phase 5） | 4（作成済み）〜5 |
| `ui/components/` | 画面部品（ステータス・推定年代レーダー・スキャン演出・移行演出・最終判定演出など） | 4（作成済み）〜5 |
| `ui/game/` | ゲーム進行（画面に依存しないロジック：進捗・ステータス・レーダー更新・演出のきっかけ） | 4（作成済み） |
| `ui/format.ts`・`ui/motion.ts` | 推定結果の表示文言・演出の時間 | 4（作成済み） |
| `styles/` | デザイントークン・全体スタイル | 1, 4 |
