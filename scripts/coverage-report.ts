/**
 * 質問データの分析レポート：npm run report:coverage
 *
 * 出力：
 * - data/generated/question-profiles.json … 質問ごとの「年代別経験確率」（各選択肢が選ばれる確率の年代平均。モデル推定値）
 * - docs/phase2/coverage-report.md        … ジャンル・難易度の配分、生年ごとの識別力、類似質問、各質問の中心となる生年
 *
 * 確率はすべてモデル（src/engine/exposure.ts・optionModel.ts）による推定値であり、統計的な実測値ではない。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENRE_LABELS, GENRES, SPECIAL_OPTION_KINDS, type Question } from '../src/data/schema';
import { questionReliability } from '../src/data/validate';
import { optionProbabilities, type ModelContext } from '../src/engine/optionModel';
import { DATA_DIR, loadDataset } from './lib/loadDataset';

/** 分析の基準年と生年候補（設計書 5.2：基準年の95年前〜8年前） */
const REFERENCE_YEAR = 2026;
const BIRTH_YEARS = Array.from({ length: 88 }, (_, i) => REFERENCE_YEAR - 95 + i);
/** 識別力：何年離れた生年同士を見分けられるか */
const DISCRIMINATION_GAP = 3;
const SIMILARITY_THRESHOLD = 0.97;

const { dataset, formatErrors } = loadDataset();
if (formatErrors.length) {
  console.error(formatErrors.join('\n'));
  process.exit(1);
}
const ctx: ModelContext = {
  subjects: new Map(dataset.subjects.map((s) => [s.id, s])),
  stats: new Map(dataset.statistics.map((s) => [s.id, s])),
};
const questions = dataset.questions.filter((q) => q.status === 'verified');

// ---------------------------------------------------------------- 確率表の計算
/** probs[q.id][生年のindex][選択肢のindex]（特殊回答は null） */
const probs = new Map<string, (number | null)[][]>();
for (const q of questions)
  probs.set(
    q.id,
    BIRTH_YEARS.map((b) => optionProbabilities(q, b, ctx)),
  );

const mainIdx = (q: Question) =>
  q.options.flatMap((o, i) => (SPECIAL_OPTION_KINDS.includes(o.kind) ? [] : [i]));
const decadeOf = (b: number) => `${Math.floor(b / 10) * 10}年代`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * 経験型の代表曲線：経験した確率（heavy+light）。
 * 経験者がごく少ない題材（年代差が10ポイント未満）は、知っている確率（1 − 知らない）を使う。
 * 時代選択型は null。
 */
function experienceCurve(q: Question): number[] | null {
  if (q.type !== 'experience') return null;
  const table = probs.get(q.id)!;
  const sumOf = (kinds: string[]) => {
    const idx = q.options.flatMap((o, i) => (kinds.includes(o.kind) ? [i] : []));
    return table.map((row) => idx.reduce((s, i) => s + (row[i] ?? 0), 0));
  };
  const experienced = sumOf(['heavy', 'light']);
  if (Math.max(...experienced) - Math.min(...experienced) >= 0.1) return experienced;
  return sumOf(['heavy', 'light', 'aware_only', 'no_experience']);
}

/** 値が最大値の半分以上になる生年の範囲 */
function halfMaxRange(curve: number[]): [number, number] | null {
  const max = Math.max(...curve);
  const min = Math.min(...curve);
  if (max - min < 0.1) return null;
  const threshold = min + (max - min) / 2;
  const idx = curve.flatMap((v, i) => (v >= threshold ? [i] : []));
  return [BIRTH_YEARS[idx[0]!]!, BIRTH_YEARS[idx[idx.length - 1]!]!];
}

// ---------------------------------------------------------------- 1. 年代別経験確率（JSON）
const decades = [...new Set(BIRTH_YEARS.map(decadeOf))];
const profiles = questions.map((q) => {
  const table = probs.get(q.id)!;
  const byDecade: Record<string, Record<string, number>> = {};
  for (const d of decades) {
    const rows = table.filter((_, i) => decadeOf(BIRTH_YEARS[i]!) === d);
    byDecade[d] = Object.fromEntries(
      mainIdx(q).map((i) => [
        q.options[i]!.id,
        Math.round((rows.reduce((s, r) => s + (r[i] ?? 0), 0) / rows.length) * 1000) / 1000,
      ]),
    );
  }
  const curve = experienceCurve(q);
  const eraPeaks =
    q.type === 'era_choice'
      ? Object.fromEntries(
          mainIdx(q)
            .filter((i) => q.options[i]!.kind === 'era')
            .map((i) => [q.options[i]!.id, halfMaxRange(table.map((r) => r[i] ?? 0))]),
        )
      : undefined;
  return {
    id: q.id,
    reliability: questionReliability(q, dataset),
    /** 対象となる生年の範囲（経験確率が最大値の半分以上になる生年） */
    birthRange: curve ? halfMaxRange(curve) : null,
    /** 時代選択型：各選択肢が中心となる生年の範囲 */
    eraPeaks,
    /** 年代別の各選択肢の確率（モデル推定値） */
    optionProbabilityByBirthDecade: byDecade,
  };
});

mkdirSync(join(DATA_DIR, 'generated'), { recursive: true });
writeFileSync(
  join(DATA_DIR, 'generated', 'question-profiles.json'),
  JSON.stringify(
    {
      note: 'scripts/coverage-report.ts が自動生成（手で編集しない）。確率はモデルによる推定値で、統計的な実測値ではない。',
      referenceYear: REFERENCE_YEAR,
      profiles,
    },
    null,
    2,
  ) + '\n',
);

// ---------------------------------------------------------------- 2. 識別力
/** Jensen–Shannon ダイバージェンス（bit） */
function jsd(p: number[], q: number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const m = (p[i]! + q[i]!) / 2;
    if (p[i]! > 0) s += 0.5 * p[i]! * Math.log2(p[i]! / m);
    if (q[i]! > 0) s += 0.5 * q[i]! * Math.log2(q[i]! / m);
  }
  return s;
}
const discrimination = BIRTH_YEARS.slice(0, -DISCRIMINATION_GAP).map((b, bi) => {
  let total = 0;
  const contributions: [string, number][] = [];
  for (const q of questions) {
    const t = probs.get(q.id)!;
    const ids = mainIdx(q);
    const d = jsd(
      ids.map((i) => t[bi]![i]!),
      ids.map((i) => t[bi + DISCRIMINATION_GAP]![i]!),
    );
    total += d;
    contributions.push([q.id, d]);
  }
  contributions.sort((a, b) => b[1] - a[1]);
  return { birthYear: b, total, top: contributions.slice(0, 3) };
});

// ---------------------------------------------------------------- 3. 類似質問
function correlation(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}
const curves = questions
  .map((q) => [q, experienceCurve(q)] as const)
  .filter((x): x is readonly [Question, number[]] => x[1] !== null);
const similar: [string, string, number][] = [];
for (let i = 0; i < curves.length; i++) {
  for (let j = i + 1; j < curves.length; j++) {
    const r = correlation(curves[i]![1], curves[j]![1]);
    if (r >= SIMILARITY_THRESHOLD) similar.push([curves[i]![0].id, curves[j]![0].id, r]);
  }
}

// ---------------------------------------------------------------- 4. レポート（Markdown）
const count = <T extends string>(xs: T[]) =>
  xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
const byGenre = count(questions.map((q) => q.genre));
const byDifficulty = count(questions.map((q) => q.difficulty));
const byType = count(questions.map((q) => q.type));
const byReliability = count(profiles.map((p) => p.reliability));
const maxDisc = Math.max(...discrimination.map((d) => d.total));
const bar = (v: number) => '█'.repeat(Math.round((v / maxDisc) * 30));

const decadeDisc = decades
  .map((d) => {
    const rows = discrimination.filter((x) => decadeOf(x.birthYear) === d);
    return rows.length ? [d, rows.reduce((s, r) => s + r.total, 0) / rows.length] : null;
  })
  .filter((x): x is [string, number] => x !== null);

const lines: string[] = [];
lines.push('# 質問データ分析レポート');
lines.push('');
lines.push(
  `> \`npm run report:coverage\` で自動生成（基準年 ${REFERENCE_YEAR}）。手で編集しない。`,
);
lines.push('> 確率・識別力はすべて**モデルによる推定値**であり、アンケート等の実測値ではない。');
lines.push('');
lines.push('## 1. 配分');
lines.push('');
lines.push(
  `質問数：**${questions.length}問**（出典 ${dataset.sources.length}件・対象 ${dataset.subjects.length}件・統計 ${dataset.statistics.length}件）`,
);
lines.push('');
lines.push('| ジャンル | 問題数 |');
lines.push('|---|---|');
for (const g of GENRES) lines.push(`| ${GENRE_LABELS[g]} | ${byGenre[g] ?? 0} |`);
lines.push('');
lines.push(
  `難易度：EASY ${byDifficulty.easy ?? 0} / NORMAL ${byDifficulty.normal ?? 0} / HARD ${byDifficulty.hard ?? 0} ／ ` +
    `形式：経験型 ${byType.experience ?? 0} / 時代選択型 ${byType.era_choice ?? 0} ／ ` +
    `基本質問プール：${questions.filter((q) => q.basicPool).length}問`,
);
lines.push('');
lines.push(
  `信頼性（各事実の最も信頼できる出典で評価し、質問内の最低値）：A ${byReliability.A ?? 0} / B ${byReliability.B ?? 0} / C ${byReliability.C ?? 0}`,
);
lines.push('');
lines.push(`## 2. 生年ごとの識別力（${DISCRIMINATION_GAP}年違いの生年をどれだけ見分けられるか）`);
lines.push('');
lines.push(
  '値が小さい年代は、その年代の人の生年を細かく絞り込むための質問が不足していることを示す。',
);
lines.push('');
lines.push('| 生年の年代 | 識別力（相対） | |');
lines.push('|---|---|---|');
for (const [d, v] of decadeDisc) lines.push(`| ${d}生まれ | ${v.toFixed(2)} | ${bar(v)} |`);
lines.push('');
const weakest = [...decadeDisc]
  .sort((a, b) => a[1] - b[1])
  .slice(0, 2)
  .map((x) => x[0]);
lines.push(
  `識別力が最も弱い年代：**${weakest.join('、')}生まれ**（質問を追加するときに優先的に補強する）`,
);
lines.push('');
lines.push('## 3. 類似質問（経験確率の曲線の相関が ' + SIMILARITY_THRESHOLD + ' 以上）');
lines.push('');
if (similar.length === 0) lines.push('該当なし');
else {
  lines.push('| 質問A | 質問B | 相関 | 関連グループ設定 |');
  lines.push('|---|---|---|---|');
  const qmap = new Map(questions.map((q) => [q.id, q]));
  for (const [a, b, r] of similar) {
    const qa = qmap.get(a)!;
    const linked = qa.relatedIds.includes(b) || (qa.group && qa.group === qmap.get(b)!.group);
    lines.push(`| ${a} | ${b} | ${r.toFixed(3)} | ${linked ? '設定済み' : '**未設定**'} |`);
  }
}
lines.push('');
lines.push('## 4. 各質問の中心となる生年（モデル推定）');
lines.push('');
lines.push(
  '経験型は「経験した」確率が最大値の半分以上になる生年。時代選択型は各選択肢が最大値の半分以上になる生年。',
);
lines.push('');
lines.push('| ID | ジャンル | 難易度 | 信頼性 | 中心となる生年 |');
lines.push('|---|---|---|---|---|');
for (const q of questions) {
  const p = profiles.find((x) => x.id === q.id)!;
  const center = p.birthRange
    ? `${p.birthRange[0]}〜${p.birthRange[1]}年生まれ`
    : p.eraPeaks
      ? Object.entries(p.eraPeaks)
          .map(([oid, r]) => {
            const label = q.options.find((o) => o.id === oid)!.label;
            return `${label}：${r ? `${r[0]}〜${r[1]}` : '—'}`;
          })
          .join('<br>')
      : '（年代差が小さい）';
  lines.push(
    `| ${q.id} | ${GENRE_LABELS[q.genre]} | ${q.difficulty.toUpperCase()} | ${p.reliability} | ${center} |`,
  );
}
lines.push('');
lines.push('## 5. 年代別経験確率（例：経験型の「経験した」確率）');
lines.push('');
lines.push('全質問・全選択肢の値は `data/generated/question-profiles.json` に出力している。');
lines.push('');
lines.push('| ID | ' + decades.join(' | ') + ' |');
lines.push('|---|' + decades.map(() => '---').join('|') + '|');
for (const [q, curve] of curves) {
  const cells = decades.map((d) => {
    const vals = curve.filter((_, i) => decadeOf(BIRTH_YEARS[i]!) === d);
    return pct(vals.reduce((s, v) => s + v, 0) / vals.length);
  });
  lines.push(`| ${q.id} | ${cells.join(' | ')} |`);
}
lines.push('');

const reportDir = join(DATA_DIR, '..', 'docs', 'phase2');
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, 'coverage-report.md'), lines.join('\n'));
console.log(`✔ ${questions.length}問を分析しました`);
console.log(`  年代別識別力: ${decadeDisc.map(([d, v]) => `${d}=${v.toFixed(2)}`).join(' ')}`);
console.log(`  類似質問: ${similar.length}組`);
