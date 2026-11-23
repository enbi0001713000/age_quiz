# data/ — 質問データ（推理ロジックと分離）

作成ルールは [docs/data-guidelines.md](../docs/data-guidelines.md)、形式の定義は `src/data/schema.ts`。

| パス | 内容 |
|---|---|
| `questions/` | ジャンル別の質問（12ファイル） |
| `subjects/` | 作品・商品・出来事の「事実」（出典付き）と、経験確率を計算するためのモデル値（推定であることを明記） |
| `sources.json` | 出典の一覧（名称・発行者・URL・確認日・信頼性） |
| `statistics/` | 公的統計の転記（内閣府「消費動向調査」の世帯普及率、日本レコード協会の音楽ソフト生産実績） |
| `generated/` | 自動生成物（`npm run report:coverage`）。質問ごとの年代別経験確率。**手で編集しない** |

**ルール**：出典で確認できない事実は登録しない。検査は `npm run validate:data`。
