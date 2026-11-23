# scripts/ — 開発用ツール

| スクリプト | 内容 | 作成Phase |
|---|---|---|
| `validate-data.ts` | 質問データの形式・出典欠落を検査し、不備があれば終了コード1（`npm run validate:data`、CIで実行） | 2（作成済み） |
| `coverage-report.ts` | 年代別経験確率の生成と、ジャンル・難易度・生年ごとの識別力・類似質問のレポート（`npm run report:coverage`） | 2（作成済み） |
| `simulate.ts` | 仮想回答者による年代別の精度・確信度の校正テスト | 3 |
| `lib/loadDataset.ts` | data/ の読み込みと形式検査（スクリプト・テスト共通） | 2（作成済み） |
