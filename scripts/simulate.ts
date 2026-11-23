/**
 * 推理エンジンのシミュレーション評価：npm run simulate（約1分）
 * パラメータ探索も行う場合：npm run simulate:tune（さらに約3分）
 *
 * 出力：docs/phase3/simulation-report.md（--tune のときは docs/phase3/tuning.md も）
 *
 * 評価用とパラメータ調整用で乱数シードを分け、特定のテストデータへの過剰適合を避ける。
 * 仮想回答者による結果であり、実際の人に対する精度ではない。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileModel, DEFAULT_CONFIG, type EngineConfig } from '../src/engine';
import { DATA_DIR, loadDataset } from './lib/loadDataset';
import { metrics, metricsByDecade, SCENARIOS, simulate, type Metrics } from './lib/simulation';

const REFERENCE_YEAR = 2026;
const EVAL_SEED = 301;
const EVAL_PER_YEAR = 3;
const TUNE_SEEDS = { grid: 201, candidates: 202 };
const SECONDS_PER_QUESTION = 10.75; // 回答約10秒＋演出約0.75秒（設計書 5.9 の見込み）
const tune = process.argv.includes('--tune');

const { dataset, formatErrors } = loadDataset();
if (formatErrors.length) throw new Error(formatErrors.join('\n'));
const outDir = join(DATA_DIR, '..', 'docs', 'phase3');
mkdirSync(outDir, { recursive: true });

const f2 = (x: number) => x.toFixed(2);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const mark = (ok: boolean) => (ok ? '✅' : '⚠️');

// ---------------------------------------------------------------- 評価
const started = Date.now();
const model = compileModel(dataset, { referenceYear: REFERENCE_YEAR, config: DEFAULT_CONFIG });
const runs = SCENARIOS.map((scenario) => {
  const results = simulate({
    dataset,
    config: DEFAULT_CONFIG,
    model,
    scenario,
    referenceYear: REFERENCE_YEAR,
    perYear: EVAL_PER_YEAR,
    seed: EVAL_SEED,
  });
  return { scenario, results, m: metrics(results), byDecade: metricsByDecade(results) };
});

const L: string[] = [];
L.push('# 推理エンジン シミュレーション評価（Phase 3）');
L.push('');
L.push('> `npm run simulate` で自動生成。手で編集しない。');
L.push(
  '> **仮想回答者による結果であり、実際の人に対する精度ではない。** 実際の精度は限定公開テスト（Phase 9）で測定する。',
);
L.push('');
L.push('## 1. 条件');
L.push('');
L.push(
  `- 質問データ：${dataset.questions.length}問（Phase 2 試作）／基準年 ${REFERENCE_YEAR}／回答者：10〜90歳の各生年 ${EVAL_PER_YEAR}人（${runs[0]!.m.n}人／シナリオ）`,
);
const c = DEFAULT_CONFIG;
L.push(
  `- エンジン設定：ランダム回答の混合 λ=${c.lapse}、温度 τ=${c.temperature}、文化的ずれ σ=${c.calibrationSigma}年、関連質問の割引 γ=${c.relatedDiscount}、最低/最大 ${c.termination.minQuestions}/${c.termination.maxQuestions}問`,
);
L.push(
  `- 乱数シード：評価用 ${EVAL_SEED}（パラメータ調整には別のシード ${TUNE_SEEDS.grid}・${TUNE_SEEDS.candidates} を使用）`,
);
L.push('');
L.push('回答者は「モデルとずれた現実」から回答する：');
L.push('');
L.push(
  '| シナリオ | 個人の文化的ずれ | ジャンル関心の差 | データの年代誤差 | 年齢窓の誤差 | 経験率上限の誤差 | ランダム回答 | 覚えていない |',
);
L.push('|---|---|---|---|---|---|---|---|');
for (const { scenario: s } of runs) {
  L.push(
    `| ${s.label} | ±${s.personOffsetSd}年 | ${s.genreInterestSd} | ±${s.itemShiftSd}年 | ±${s.ageWindowSd}年 | ×${s.ceilingRange[0]}〜${s.ceilingRange[1]} | ${pct(s.randomAnswerRate)} | ${pct(s.dontRememberRate)} |`,
  );
}
L.push('');
L.push('## 2. 全体の結果と評価基準（設計書 12.2）');
L.push('');
L.push('評価基準は「ずれ：小」「ずれ：大」のシナリオに適用する（理想シナリオは参考）。');
L.push('');
const realistic = runs.filter((r) => r.scenario.name !== 'ideal');
const crit: {
  label: string;
  target: string;
  get: (m: Metrics) => string;
  ok: (m: Metrics) => boolean;
}[] = [
  {
    label: '生年の誤差（中央値）',
    target: '≤ 3年',
    get: (m) => `${m.medianError}年`,
    ok: (m) => m.medianError <= 3,
  },
  { label: '平均誤差', target: '（参考）', get: (m) => `${f2(m.mae)}年`, ok: () => true },
  { label: '±2年以内', target: '（参考）', get: (m) => pct(m.within2), ok: () => true },
  { label: '±5年以内', target: '≥ 85%', get: (m) => pct(m.within5), ok: (m) => m.within5 >= 0.85 },
  {
    label: '80%区間に正解が入る割合（校正）',
    target: '70〜90%',
    get: (m) => pct(m.coverage),
    ok: (m) => m.coverage >= 0.7 && m.coverage <= 0.9,
  },
  {
    label: '80%区間の平均幅',
    target: '（参考）',
    get: (m) => `${m.meanWidth.toFixed(1)}年`,
    ok: () => true,
  },
  {
    label: '確信度「高」なのに誤差3年超',
    target: '≤ 10%',
    get: (m) => (m.highWrongRate === null ? '（高なし）' : pct(m.highWrongRate)),
    ok: (m) => (m.highWrongRate ?? 0) <= 0.1,
  },
  {
    label: '平均質問数',
    target: '12〜20問',
    get: (m) => m.meanQuestions.toFixed(1),
    ok: (m) => m.meanQuestions >= 12 && m.meanQuestions <= 20,
  },
  {
    label: '最大質問数',
    target: '≤ 30問',
    get: (m) => String(m.maxQuestions),
    ok: (m) => m.maxQuestions <= 30,
  },
  {
    label: '推定プレイ時間（平均）',
    target: '3〜5分',
    get: (m) => `${((m.meanQuestions * SECONDS_PER_QUESTION) / 60).toFixed(1)}分`,
    ok: (m) => {
      const t = (m.meanQuestions * SECONDS_PER_QUESTION) / 60;
      return t >= 2.5 && t <= 5;
    },
  },
  {
    label: '1問を除いたときの推定生年の変化（95%点）',
    target: '（参考）',
    get: (m) => `${m.leaveOneOutP95}年`,
    ok: () => true,
  },
];
L.push(`| 指標 | 目標 | ${runs.map((r) => r.scenario.label).join(' | ')} |`);
L.push(`|---|---|${runs.map(() => '---').join('|')}|`);
for (const k of crit) {
  const cells = runs.map((r) => {
    const judged = r.scenario.name !== 'ideal' && k.target !== '（参考）';
    return `${k.get(r.m)}${judged ? ` ${mark(k.ok(r.m))}` : ''}`;
  });
  L.push(`| ${k.label} | ${k.target} | ${cells.join(' | ')} |`);
}
L.push('');
L.push('## 3. 生まれた年代ごとの結果');
L.push('');
L.push('各年代で「80%区間に正解が入る割合 ≥ 65%」を目標とする。');
L.push('');
for (const r of realistic) {
  L.push(`### ${r.scenario.label}`);
  L.push('');
  L.push(
    '| 生年 | 人数 | 平均誤差 | ±5年以内 | 80%区間に正解 | 平均の偏り（推定−正解） | 平均質問数 |',
  );
  L.push('|---|---|---|---|---|---|---|');
  for (const { decade, m } of r.byDecade) {
    const group = r.results.filter((x) => Math.floor(x.trueBirthYear / 10) * 10 === decade);
    const bias = group.reduce((s, x) => s + x.estimate - x.trueBirthYear, 0) / group.length;
    L.push(
      `| ${decade}年代 | ${m.n} | ${f2(m.mae)}年 | ${pct(m.within5)} | ${pct(m.coverage)} ${mark(m.coverage >= 0.65)} | ${bias >= 0 ? '+' : ''}${bias.toFixed(1)}年 | ${m.meanQuestions.toFixed(1)} |`,
    );
  }
  L.push('');
}
L.push('## 4. 確信度の妥当性');
L.push('');
L.push(
  '確信度はモデル上の値であり、的中率ではない。ここでは確信度ごとの実際の当たり方を確認する。',
);
L.push('');
L.push('| シナリオ | 確信度 | 割合 | ±2年以内 | 80%区間に正解 |');
L.push('|---|---|---|---|---|');
for (const r of runs) {
  for (const level of ['high', 'medium', 'low'] as const) {
    const g = r.results.filter((x) => x.confidence === level);
    if (!g.length) {
      L.push(`| ${r.scenario.label} | ${level} | 0% | — | — |`);
      continue;
    }
    const m = metrics(g);
    L.push(
      `| ${r.scenario.label} | ${level} | ${pct(g.length / r.results.length)} | ${pct(m.within2)} | ${pct(m.coverage)} |`,
    );
  }
}
L.push('');
L.push('## 5. 終了理由');
L.push('');
L.push('| シナリオ | 確信度に到達 | 改善見込みなし | 質問数の上限 | 質問切れ |');
L.push('|---|---|---|---|---|');
for (const r of runs) {
  const g = (k: string) => pct(r.m.reasons[k] ?? 0);
  L.push(
    `| ${r.scenario.label} | ${g('confident')} | ${g('no_gain')} | ${g('max_questions')} | ${g('exhausted')} |`,
  );
}
L.push('');
L.push('## 6. 特定の回答への依存');
L.push('');
L.push('最後の推定から回答を1つずつ取り除いて推定し直したときの、推定生年の最大変化。');
L.push('');
L.push('| シナリオ | 中央値 | 95%点 | 最大 |');
L.push('|---|---|---|---|');
for (const r of runs) {
  const xs = r.results.map((x) => x.leaveOneOutChange).sort((a, b) => a - b);
  L.push(
    `| ${r.scenario.label} | ${xs[Math.floor(xs.length / 2)]}年 | ${r.m.leaveOneOutP95}年 | ${r.m.leaveOneOutMax}年 |`,
  );
}
L.push('');
// ---------------------------------------------------------------- 感度分析
L.push('## 7. 感度分析：推定値（モデル値）の誤差の影響');
L.push('');
L.push(
  '質問データの「何歳ごろに経験したか（年齢窓）」「経験率の上限」は多くが推定値（Phase 2 の限界）。' +
    'その誤差だけを大きくしたとき、精度がどれだけ下がるかを確認する（他の条件は「ずれ：小」と同じ、各生年2人、シード 303）。',
);
L.push('');
L.push(
  '| 年齢窓の誤差 | 経験率上限の誤差 | 平均誤差 | ±5年以内 | 80%区間に正解 | 「高」で誤差3年超 |',
);
L.push('|---|---|---|---|---|---|');
const mildScenario = SCENARIOS.find((s) => s.name === 'mild')!;
for (const [ageWindowSd, ceilingRange] of [
  [0, [1, 1]],
  [1, [0.75, 1.25]],
  [2, [0.6, 1.4]],
  [4, [0.4, 1.6]],
] as const) {
  const m = metrics(
    simulate({
      dataset,
      config: DEFAULT_CONFIG,
      model,
      scenario: { ...mildScenario, ageWindowSd, ceilingRange: [...ceilingRange] },
      referenceYear: REFERENCE_YEAR,
      perYear: 2,
      seed: 303,
    }),
  );
  L.push(
    `| ±${ageWindowSd}年 | ×${ceilingRange[0]}〜${ceilingRange[1]} | ${f2(m.mae)}年 | ${pct(m.within5)} | ${pct(m.coverage)} | ${m.highWrongRate === null ? '（高なし）' : pct(m.highWrongRate)} |`,
  );
}
L.push('');
L.push(`（計算時間 ${((Date.now() - started) / 1000).toFixed(0)}秒）`);
L.push('');
writeFileSync(join(outDir, 'simulation-report.md'), L.join('\n'));
for (const r of runs) {
  console.log(
    `${r.scenario.name.padEnd(6)} MAE ${f2(r.m.mae)} median ${r.m.medianError} ±5 ${pct(r.m.within5)} coverage ${pct(r.m.coverage)} high ${pct(r.m.confidenceShare.high)} highWrong ${r.m.highWrongRate === null ? '-' : pct(r.m.highWrongRate)} Q ${r.m.meanQuestions.toFixed(1)}/${r.m.maxQuestions} LOO95 ${r.m.leaveOneOutP95}`,
  );
}

// ---------------------------------------------------------------- パラメータ探索（--tune）
if (tune) {
  const T: string[] = [];
  T.push('# パラメータ探索（Phase 3）');
  T.push('');
  T.push('> `npm run simulate:tune` で自動生成。評価用とは別の乱数シードで行う。');
  T.push('');
  T.push(`## 1. 全組み合わせ（シード ${TUNE_SEEDS.grid}、各生年1人×「ずれ：小」「ずれ：大」）`);
  T.push('');
  T.push(
    '| λ | τ | σ | 平均誤差 | 80%区間に正解（小/大） | 確信度「高」の割合 | 「高」で誤差3年超 | 平均質問数 |',
  );
  T.push('|---|---|---|---|---|---|---|---|');
  const evalCfg = (cfg: EngineConfig, seed: number, perYear: number) =>
    SCENARIOS.filter((s) => s.name !== 'ideal').map((scenario) =>
      metrics(
        simulate({ dataset, config: cfg, scenario, referenceYear: REFERENCE_YEAR, perYear, seed }),
      ),
    );
  const avg = (ms: Metrics[], fn: (m: Metrics) => number) =>
    ms.reduce((s, m) => s + fn(m), 0) / ms.length;
  for (const lapse of [0.05, 0.08, 0.12]) {
    for (const temperature of [0.7, 0.8, 1.0]) {
      for (const calibrationSigma of [1.0, 1.5, 2.0]) {
        const ms = evalCfg(
          { ...DEFAULT_CONFIG, lapse, temperature, calibrationSigma },
          TUNE_SEEDS.grid,
          1,
        );
        T.push(
          `| ${lapse} | ${temperature} | ${calibrationSigma} | ${f2(avg(ms, (m) => m.mae))}年 | ${ms.map((m) => pct(m.coverage)).join(' / ')} | ${pct(avg(ms, (m) => m.confidenceShare.high))} | ${pct(avg(ms, (m) => m.highWrongRate ?? 0))} | ${avg(ms, (m) => m.meanQuestions).toFixed(1)} |`,
        );
        console.log('tune', lapse, temperature, calibrationSigma);
      }
    }
  }
  T.push('');
  T.push(`## 2. 有力候補の再評価（シード ${TUNE_SEEDS.candidates}、各生年3人）`);
  T.push('');
  T.push(
    '| λ | τ | σ | 平均誤差 | 80%区間に正解（小/大） | 確信度「高」の割合 | 「高」で誤差3年超（小/大） | 平均質問数 |',
  );
  T.push('|---|---|---|---|---|---|---|---|');
  for (const [lapse, temperature, calibrationSigma] of [
    [0.08, 0.8, 1.5],
    [0.08, 0.7, 1.0],
    [0.12, 1.0, 1.5],
    [0.12, 0.7, 1.5],
    [0.08, 1.0, 1.5],
  ] as const) {
    const ms = evalCfg(
      { ...DEFAULT_CONFIG, lapse, temperature, calibrationSigma },
      TUNE_SEEDS.candidates,
      3,
    );
    T.push(
      `| ${lapse} | ${temperature} | ${calibrationSigma} | ${f2(avg(ms, (m) => m.mae))}年 | ${ms.map((m) => pct(m.coverage)).join(' / ')} | ${pct(avg(ms, (m) => m.confidenceShare.high))} | ${ms.map((m) => (m.highWrongRate === null ? '—' : pct(m.highWrongRate))).join(' / ')} | ${avg(ms, (m) => m.meanQuestions).toFixed(1)} |`,
    );
  }
  T.push('');
  T.push('## 3. 選定');
  T.push('');
  T.push(
    '選定基準：①確信度「高」で誤差3年超が10%以下 ②80%区間に正解が入る割合が80%に近い ③平均誤差が小さい。',
  );
  T.push('σ=1.0 は「高」が増えるが誤差3年超が10%を超えるため不採用。');
  T.push(
    `採用：λ=${c.lapse}、τ=${c.temperature}、σ=${c.calibrationSigma}（Phase 0 の初期値と同じ）。`,
  );
  T.push('');
  writeFileSync(join(outDir, 'tuning.md'), T.join('\n'));
}
