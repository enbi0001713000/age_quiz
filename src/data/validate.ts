/**
 * データ一式の整合性検査（形式は schema.ts の Zod で検査済みである前提）。
 *
 * - 参照切れ（出典・対象・統計・関連質問）
 * - 事実の矛盾（開始より前に終了など）
 * - 出典ルール（信頼性Cだけを根拠にした事実は不可）
 * - 質問ルール（主要選択肢4〜6、「覚えていない」を必ず用意、型ごとの必須項目）
 */
import { SPECIAL_OPTION_KINDS } from './constants';
import type { Dataset, DatedFact, PeriodFact, Question, Reliability, Subject } from './schema';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const RELIABILITY_ORDER: Reliability[] = ['A', 'B', 'C'];

/**
 * 日付の前後比較（a が b より後なら正）。精度が異なる場合は粗い方にそろえる
 * （例：'1996-11' と '1996-11-23' は同じ月なので「同じ」とみなす）。
 */
function compareDates(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  return Number(a.slice(0, len).replace(/-/g, '')) - Number(b.slice(0, len).replace(/-/g, ''));
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

/** 対象の事実に付いている出典IDをすべて列挙 */
export function subjectSourceIds(subject: Subject): string[] {
  const f = subject.facts;
  const facts: (DatedFact | PeriodFact | { sources: string[] } | undefined)[] = [
    f.start,
    f.end,
    f.diffusion,
    f.peak,
    f.audience,
  ];
  return facts.flatMap((x) => x?.sources ?? []);
}

/** 質問が参照する対象の一覧 */
export function questionSubjectIds(q: Question): string[] {
  const ids = q.options.map((o) => o.subject).filter((s): s is string => !!s);
  return q.subject ? [q.subject, ...ids] : ids;
}

/**
 * 質問の信頼性：参照する各事実について「最も信頼できる出典」を取り、その中で最も低いもの。
 * （1つの事実を複数の出典で裏付けた場合は、強い方の出典で評価する）
 */
export function questionReliability(q: Question, data: Dataset): Reliability {
  const sourceRel = new Map(data.sources.map((s) => [s.id, s.reliability]));
  const subjects = new Map(data.subjects.map((s) => [s.id, s]));
  const stats = new Map(data.statistics.map((s) => [s.id, s]));
  let worst = 0;
  for (const sid of questionSubjectIds(q)) {
    const subject = subjects.get(sid);
    if (!subject) continue;
    const f = subject.facts;
    const factSourceLists = [f.start, f.end, f.diffusion, f.peak, f.audience]
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => x.sources);
    if (f.series) {
      const stat = stats.get(f.series.statId);
      if (stat) factSourceLists.push([stat.sourceId]);
    }
    for (const list of factSourceLists) {
      const best = Math.min(
        ...list.map((id) => RELIABILITY_ORDER.indexOf(sourceRel.get(id) ?? 'C')),
      );
      worst = Math.max(worst, best);
    }
  }
  return RELIABILITY_ORDER[worst]!;
}

export function validateDataset(data: Dataset): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sources = new Map(data.sources.map((s) => [s.id, s]));
  const subjects = new Map(data.subjects.map((s) => [s.id, s]));
  const questions = new Map(data.questions.map((q) => [q.id, q]));
  const stats = new Map(data.statistics.map((s) => [s.id, s]));

  for (const [kind, ids] of [
    ['出典', data.sources.map((s) => s.id)],
    ['対象', data.subjects.map((s) => s.id)],
    ['質問', data.questions.map((q) => q.id)],
    ['統計', data.statistics.map((s) => s.id)],
  ] as const) {
    for (const d of duplicates([...ids])) errors.push(`${kind}IDが重複: ${d}`);
  }

  // ---- 統計
  for (const st of data.statistics) {
    if (!sources.has(st.sourceId)) errors.push(`統計 ${st.id}: 出典 ${st.sourceId} が未登録`);
  }

  // ---- 対象（事実）
  const usedSources = new Set<string>(data.statistics.map((s) => s.sourceId));
  for (const s of data.subjects) {
    const where = `対象 ${s.id}`;
    const f = s.facts;
    const facts = {
      start: f.start,
      end: f.end,
      diffusion: f.diffusion,
      peak: f.peak,
      audience: f.audience,
    };
    for (const [name, fact] of Object.entries(facts)) {
      if (!fact) continue;
      for (const id of fact.sources) {
        usedSources.add(id);
        if (!sources.has(id)) errors.push(`${where}.${name}: 出典 ${id} が未登録`);
      }
      const rels = fact.sources.map((id) => sources.get(id)?.reliability);
      if (rels.length > 0 && rels.every((r) => r === 'C')) {
        errors.push(
          `${where}.${name}: 信頼性Cの出典だけを根拠にしています（補助出典は単独根拠不可）`,
        );
      }
      if (fact.status === 'derived' && !fact.rule) {
        errors.push(`${where}.${name}: derived の事実には導出規則（rule）が必要`);
      }
    }
    if (f.start && f.end && compareDates(f.start.date, f.end.date) > 0) {
      errors.push(`${where}: 開始（${f.start.date}）が終了（${f.end.date}）より後`);
    }
    for (const [name, p] of [
      ['diffusion', f.diffusion],
      ['peak', f.peak],
    ] as const) {
      if (p && compareDates(p.from, p.to) > 0) errors.push(`${where}.${name}: from が to より後`);
      if (p && f.start && compareDates(p.from, f.start.date) < 0) {
        errors.push(`${where}.${name}: 普及・流行の開始が登場（start）より前`);
      }
    }
    if (f.series) {
      const st = stats.get(f.series.statId);
      if (!st) errors.push(`${where}: 統計 ${f.series.statId} が未登録`);
      else if (!st.series[f.series.key]) errors.push(`${where}: 統計系列 ${f.series.key} がない`);
    }
    const m = s.model;
    if (m.ageWindow.value[0] > m.ageWindow.value[1])
      errors.push(`${where}: 年齢窓の下限が上限より大きい`);
    if (m.floor > m.ceiling.value) errors.push(`${where}: floor が ceiling より大きい`);
    if (m.awareness.floor > m.awareness.ceiling)
      errors.push(`${where}: 認知の floor が ceiling より大きい`);
    const needsEnd = s.kind !== 'household' && !f.peak && !f.diffusion && !f.end;
    if (needsEnd && !m.activeUntil) {
      errors.push(
        `${where}: 流行の終わり（peak/diffusion/end）がないため model.activeUntil が必要`,
      );
    }
  }

  // ---- 質問
  const usedSubjects = new Set<string>();
  for (const q of data.questions) {
    const where = `質問 ${q.id}`;
    const main = q.options.filter((o) => !SPECIAL_OPTION_KINDS.includes(o.kind));
    if (main.length < 4 || main.length > 6) {
      errors.push(`${where}: 主要選択肢は4〜6個（現在 ${main.length}個）`);
    }
    if (!q.options.some((o) => o.kind === 'dont_remember')) {
      errors.push(`${where}: 「覚えていない」の選択肢が必要`);
    }
    for (const d of duplicates(q.options.map((o) => o.id)))
      errors.push(`${where}: 選択肢ID重複 ${d}`);
    for (const d of duplicates(q.options.map((o) => o.label))) {
      errors.push(`${where}: 選択肢の文言重複「${d}」`);
    }

    if (q.type === 'experience') {
      if (!q.subject) errors.push(`${where}: 経験型には subject が必要`);
      if (q.options.some((o) => o.kind === 'era' || o.kind === 'none_of_these')) {
        errors.push(`${where}: 経験型に時代選択の選択肢は使えない`);
      }
      const kinds = new Set(q.options.map((o) => o.kind));
      if (!kinds.has('heavy')) errors.push(`${where}: 経験型には「経験あり」（heavy）が必要`);
      if (!kinds.has('unaware') && !kinds.has('no_experience')) {
        errors.push(`${where}: 経験型には「知らない」または「経験がない」が必要`);
      }
    } else {
      if (!q.ageWindow) errors.push(`${where}: 時代選択型には ageWindow が必要`);
      if (q.subject) errors.push(`${where}: 時代選択型は subject ではなく各選択肢に対象を指定`);
      const eras = q.options.filter((o) => o.kind === 'era');
      if (eras.length < 2) errors.push(`${where}: 時代の選択肢が2つ以上必要`);
      for (const o of eras)
        if (!o.subject) errors.push(`${where}/${o.id}: 時代の選択肢に subject が必要`);
      if (!q.options.some((o) => o.kind === 'none_of_these')) {
        warnings.push(`${where}: 「この中にはない」の選択肢がありません`);
      }
    }
    for (const sid of questionSubjectIds(q)) {
      usedSubjects.add(sid);
      if (!subjects.has(sid)) errors.push(`${where}: 対象 ${sid} が未登録`);
    }
    for (const rid of q.relatedIds) {
      if (rid === q.id) errors.push(`${where}: 自分自身を関連質問にしている`);
      else if (!questions.has(rid)) errors.push(`${where}: 関連質問 ${rid} が未登録`);
    }
    if (q.status === 'verified' && questionReliability(q, data) === 'C') {
      errors.push(`${where}: 信頼性Cの根拠しかない質問は verified にできない`);
    }
  }

  // ---- 世代分類
  const gens = data.generations;
  if (gens) {
    const bands = [...gens.original].sort((a, b) => (a.from ?? -Infinity) - (b.from ?? -Infinity));
    if (bands[0]!.from !== null)
      errors.push('世代分類：最初の世代は「〜以前」（from: null）にする');
    if (bands.at(-1)!.to !== null)
      errors.push('世代分類：最後の世代は「〜以降」（to: null）にする');
    for (let i = 1; i < bands.length; i++) {
      const prev = bands[i - 1]!;
      if (prev.to === null || bands[i]!.from !== prev.to + 1) {
        errors.push(`世代分類：${prev.name} と ${bands[i]!.name} の生年の範囲が連続していない`);
      }
    }
    for (const g of gens.original) {
      for (const b of g.background) {
        for (const sid of b.subjects) {
          usedSubjects.add(sid);
          if (!subjects.has(sid)) errors.push(`世代 ${g.id}：背景の根拠 ${sid} が未登録の対象`);
        }
      }
    }
    for (const c of gens.common) {
      if (c.from > c.to) errors.push(`一般的な世代名 ${c.id}：from が to より大きい`);
      for (const id of c.sources) {
        usedSources.add(id);
        if (!sources.has(id)) errors.push(`一般的な世代名 ${c.id}：出典 ${id} が未登録`);
      }
    }
  }

  for (const s of data.sources) {
    if (!usedSources.has(s.id)) warnings.push(`出典 ${s.id} はどこからも参照されていません`);
  }
  for (const s of data.subjects) {
    if (!usedSubjects.has(s.id)) warnings.push(`対象 ${s.id} はどの質問からも参照されていません`);
  }

  return { errors, warnings };
}
