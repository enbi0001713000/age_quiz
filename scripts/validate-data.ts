/**
 * 質問データの検証：npm run validate:data
 * 形式エラー・整合性エラーがあれば終了コード1（CIとビルドを止める）。
 */
import { validateDataset } from '../src/data/validate';
import { loadDataset } from './lib/loadDataset';

const { dataset, formatErrors, files } = loadDataset();
const { errors, warnings } = formatErrors.length
  ? { errors: [], warnings: [] }
  : validateDataset(dataset);
const allErrors = [...formatErrors, ...errors];

console.log(`読み込み: ${files.length}ファイル`);
console.log(
  `出典 ${dataset.sources.length}件 / 対象 ${dataset.subjects.length}件 / 質問 ${dataset.questions.length}問 / 統計 ${dataset.statistics.length}件`,
);
for (const w of warnings) console.log(`  [警告] ${w}`);
for (const e of allErrors) console.error(`  [エラー] ${e}`);
if (allErrors.length > 0) {
  console.error(`\n✖ エラー ${allErrors.length}件`);
  process.exit(1);
}
console.log(`\n✔ エラーなし（警告 ${warnings.length}件）`);
