/**
 * 質問データの形式定義（設計書 6章）。
 *
 * データは「事実」と「モデル」を分けて持つ。
 * - 事実（facts）：発売・放送・普及・流行の時期や対象年齢。必ず出典ID（sources）を付ける。
 * - モデル（model）：事実から経験確率を計算するための設計値。推定値であることと根拠（rationale）を明記する。
 *
 * 形式はこのファイルの Zod スキーマで検査し、参照の整合性などは validate.ts で検査する。
 */
import { z } from 'zod';
import { GENRES, OPTION_KINDS } from './constants';

export {
  GENRE_LABELS,
  GENRES,
  OPTION_KINDS,
  SPECIAL_OPTION_KINDS,
  type Genre,
  type OptionKind,
} from './constants';

// ---------------------------------------------------------------- 基本型

export const GenreSchema = z.enum(GENRES);

export const ReliabilitySchema = z.enum(['A', 'B', 'C']);
export type Reliability = z.infer<typeof ReliabilitySchema>;

/** 'YYYY' / 'YYYY-MM' / 'YYYY-MM-DD' */
const DateString = z
  .string()
  .regex(
    /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/,
    '日付は YYYY / YYYY-MM / YYYY-MM-DD',
  );

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ID は小文字英数字とハイフン');

// ---------------------------------------------------------------- 出典

export const SourceSchema = z.strictObject({
  id: z.string().regex(/^src-[a-z0-9-]+$/, '出典IDは src- で始める'),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  /** official=公式・官公庁 / statistics=統計 / press=報道・専門メディア / book=書籍 / encyclopedia=百科事典 */
  type: z.enum(['official', 'statistics', 'press', 'book', 'encyclopedia']),
  accessed: DateString,
  reliability: ReliabilitySchema,
});
export type Source = z.infer<typeof SourceSchema>;

// ---------------------------------------------------------------- 事実

/**
 * verified：出典の本文で直接確認した値。
 * derived ：出典付きの事実・統計から、rule に書いた規則で導いた値。
 * 発売年などに「推定」は使えない（推定はモデルパラメータのみ）。
 */
const FactStatus = z.enum(['verified', 'derived']);

const FactBase = {
  status: FactStatus,
  sources: z.array(z.string()).min(1, '事実には出典が必要'),
  /** 出典本文の該当箇所（確認用の抜粋） */
  quote: z.string().optional(),
  /** derived の場合の導出規則 */
  rule: z.string().optional(),
};

export const DatedFactSchema = z.strictObject({ date: DateString, ...FactBase });
export type DatedFact = z.infer<typeof DatedFactSchema>;

export const PeriodFactSchema = z.strictObject({
  from: DateString,
  to: DateString,
  ...FactBase,
});
export type PeriodFact = z.infer<typeof PeriodFactSchema>;

export const AudienceFactSchema = z.strictObject({
  ages: z.tuple([z.number().int().min(0), z.number().int().max(120)]),
  gender: z.enum(['all', 'male_lean', 'female_lean']).default('all'),
  ...FactBase,
});

/** 統計系列の参照（例：家電の世帯普及率） */
export const SeriesRefSchema = z.strictObject({
  statId: z.string(),
  key: z.string(),
  /** household_penetration＝世帯普及率（%）。経験確率の計算に直接使う */
  kind: z.literal('household_penetration'),
  /**
   * 統計の最終年より後の扱い（推定）。
   * hold＝最後の値を維持 / linear_to_zero＝untilYear に向けて直線的に0へ（置き換わった製品など）
   */
  after: z
    .discriminatedUnion('mode', [
      z.strictObject({ mode: z.literal('hold'), rationale: z.string().min(1) }),
      z.strictObject({
        mode: z.literal('linear_to_zero'),
        untilYear: z.number().int(),
        rationale: z.string().min(1),
      }),
    ])
    .optional(),
});

// ---------------------------------------------------------------- モデル（設計値）

const ModelStatus = z.enum(['estimated', 'derived', 'statistic']);

export const SubjectModelSchema = z.strictObject({
  /** 経験しやすい年齢帯（主な利用者層の事実があればそれに基づく） */
  ageWindow: z.strictObject({
    value: z.tuple([z.number().int().min(0), z.number().int().max(120)]),
    status: ModelStatus,
    rationale: z.string().min(1),
  }),
  /** 終了・衰退の事実がない場合に、主な流行期間の終わりとみなす年（推定） */
  activeUntil: z
    .strictObject({
      value: z.number().int().min(1900).max(2100),
      status: ModelStatus,
      rationale: z.string().min(1),
    })
    .optional(),
  /** 中心世代での経験率の上限 c（0〜1） */
  ceiling: z.strictObject({
    value: z.number().min(0).max(1),
    status: ModelStatus,
    rationale: z.string().min(1),
  }),
  /** 中心世代以外での経験率 f（0〜1） */
  floor: z.number().min(0).max(1).default(0.03),
  /** 認知（知っている）確率の下限・上限 */
  awareness: z.strictObject({
    floor: z.number().min(0).max(1),
    ceiling: z.number().min(0).max(1),
    rationale: z.string().min(1),
  }),
});
export type SubjectModel = z.infer<typeof SubjectModelSchema>;

// ---------------------------------------------------------------- 対象（作品・商品・出来事）

export const SubjectSchema = z
  .strictObject({
    id: Id,
    name: z.string().min(1),
    genre: GenreSchema,
    /** trend＝流行・作品・商品 / household＝世帯の保有（統計系列で計算） / event＝出来事（記憶） */
    kind: z.enum(['trend', 'household', 'event']),
    facts: z.strictObject({
      /** 登場・発売・放送開始 */
      start: DatedFactSchema.optional(),
      /** 販売終了・放送終了 */
      end: DatedFactSchema.optional(),
      /** 国内での普及時期 */
      diffusion: PeriodFactSchema.optional(),
      /** 国内での流行時期 */
      peak: PeriodFactSchema.optional(),
      /** 主な利用者層（出典がある場合） */
      audience: AudienceFactSchema.optional(),
      /** 統計系列（household の場合は必須） */
      series: SeriesRefSchema.optional(),
    }),
    model: SubjectModelSchema,
    notes: z.string().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.kind === 'household' && !s.facts.series) {
      ctx.addIssue({ code: 'custom', message: 'household 型には統計系列（facts.series）が必要' });
    }
    const f = s.facts;
    if (s.kind !== 'household' && !f.start && !f.peak && !f.diffusion && !f.end) {
      ctx.addIssue({
        code: 'custom',
        message: '登場（start）・流行・普及・終了のいずれかの時期が必要',
      });
    }
  });
export type Subject = z.infer<typeof SubjectSchema>;

// ---------------------------------------------------------------- 質問

export const OptionKindSchema = z.enum(OPTION_KINDS);

export const OptionSchema = z.strictObject({
  id: z.string().regex(/^[a-z]$/, '選択肢IDは英小文字1字'),
  label: z.string().min(1),
  kind: OptionKindSchema,
  /** era の場合に参照する対象 */
  subject: Id.optional(),
  /** 推理レポート用：この回答が示す年代的特徴（事実に基づいて書く） */
  insight: z.string().optional(),
});
export type Option = z.infer<typeof OptionSchema>;

export const QuestionSchema = z.strictObject({
  id: z.string().regex(/^[A-Z]{2,3}-\d{3}$/, '質問IDは GAM-001 の形式'),
  status: z.enum(['draft', 'verified', 'retired']),
  genre: GenreSchema,
  difficulty: z.enum(['easy', 'normal', 'hard']),
  /** experience＝経験・記憶を問う / era_choice＝特定の年齢の頃に何だったかを選ぶ */
  type: z.enum(['experience', 'era_choice']),
  text: z.string().min(1),
  /** experience の場合の対象 */
  subject: Id.optional(),
  /** era_choice の場合に質問が問う年齢帯（例：小学生＝6〜12歳） */
  ageWindow: z.tuple([z.number().int().min(0), z.number().int().max(120)]).optional(),
  options: z.array(OptionSchema).min(4),
  /** 推理への重要度（証拠の重み）。0.3〜1.0。性別に偏る題材などは下げる */
  importance: z.number().min(0.3).max(1),
  /** 出題の優先度（編集判断）。0.5〜1.5 */
  priority: z.number().min(0.5).max(1.5),
  /** 関連グループ（同じ情報を持つ質問の二重カウント防止に使う） */
  group: z.string().optional(),
  relatedIds: z.array(z.string()).default([]),
  /** 基本質問プールに含めるか（設計書 5.8） */
  basicPool: z.boolean().default(false),
  notes: z.string().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

// ---------------------------------------------------------------- 統計系列

export const StatisticSchema = z.strictObject({
  id: z.string(),
  sourceId: z.string(),
  title: z.string(),
  unit: z.string(),
  note: z.string(),
  labels: z.record(z.string(), z.string()).optional(),
  /** 系列名 → { 'YYYY' または 'YYYY-MM' → 値 } */
  series: z.record(z.string(), z.record(z.string(), z.number())),
});
export type Statistic = z.infer<typeof StatisticSchema>;

// ---------------------------------------------------------------- ファイル単位

export const SourcesFileSchema = z.strictObject({ sources: z.array(SourceSchema) });
export const SubjectsFileSchema = z.strictObject({ subjects: z.array(SubjectSchema) });
export const QuestionsFileSchema = z.strictObject({ questions: z.array(QuestionSchema) });

// ---------------------------------------------------------------- 世代分類（Q7）

/** このゲーム独自の世代名（生まれた年代で区切った呼び名。背景は出典付きの事実に基づく） */
export const OriginalGenerationSchema = z.strictObject({
  id: Id,
  name: z.string().min(1),
  /** 生年の範囲（null は「〜以前」「〜以降」） */
  from: z.number().int().nullable(),
  to: z.number().int().nullable(),
  tagline: z.string().min(1),
  background: z
    .array(z.strictObject({ text: z.string().min(1), subjects: z.array(Id).min(1) }))
    .min(1),
});
export type OriginalGeneration = z.infer<typeof OriginalGenerationSchema>;

/** 一般的な世代名（出典で確認できた定義のみ。呼び方・範囲には諸説ある） */
export const CommonGenerationSchema = z.strictObject({
  id: Id,
  name: z.string().min(1),
  from: z.number().int(),
  to: z.number().int(),
  label: z.string().min(1),
  sources: z.array(z.string()).min(1),
  quote: z.string().min(1),
  note: z.string().optional(),
});
export type CommonGeneration = z.infer<typeof CommonGenerationSchema>;

export const GenerationsFileSchema = z.strictObject({
  note: z.string(),
  original: z.array(OriginalGenerationSchema).min(1),
  common: z.array(CommonGenerationSchema),
});
export type Generations = z.infer<typeof GenerationsFileSchema>;

/** 検証済みのデータ一式 */
export interface Dataset {
  sources: Source[];
  subjects: Subject[];
  questions: Question[];
  statistics: Statistic[];
  /** 世代分類（data/generations.json） */
  generations?: Generations;
}
