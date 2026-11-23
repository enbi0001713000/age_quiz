/**
 * 推理エンジンのパラメータ（設計書 5.14）。
 *
 * 数値はすべてここに集約する。初期値は Phase 0 の試算と Phase 3 のシミュレーションに基づく。
 * λ・τ・σ などの校正パラメータは、限定公開テストの実測で再調整する前提。
 */
export interface EngineConfig {
  /** 生年候補：基準年の何年前から何年前まで（設計書 5.2） */
  birthYears: { oldestAge: number; youngestAge: number };
  /** 事前確率（Q5：一様。推理対象の外側の年齢だけ緩やかに下げる） */
  prior: { fullFromAge: number; fullToAge: number; edgeWeight: number };
  /** ランダム回答の混合率 λ（誤タップ・勘違い・例外的な経験） */
  lapse: number;
  /** 全回答の影響を一律に弱める温度 τ（質問どうしの隠れた相関による過信を抑える） */
  temperature: number;
  /** 信頼性ごとの証拠の重み */
  reliabilityWeight: Record<'A' | 'B' | 'C', number>;
  /** 同じ関連グループの2問目以降に掛ける割引率 γ */
  relatedDiscount: number;
  /** 「意外な回答」とみなす予測確率の上限 */
  surpriseThreshold: number;
  /** 校正：文化的生年と実際の生年のずれ（標準偏差、年） */
  calibrationSigma: number;
  /** 推定区間の確率（80%区間） */
  intervalMass: number;
  /** 確信度の境界（80%区間の幅、年） */
  confidence: { highMaxWidth: number; mediumMaxWidth: number };
  /** 基本質問（Q6：共通プールから毎回 count 問） */
  basic: { count: number };
  /** 質問選択 */
  selection: {
    /** 最高スコアのこの割合以上の候補からランダムに選ぶ */
    randomBand: number;
    /** HARD を解禁する80%区間の幅（年） */
    hardUnlockWidth: number;
    difficultyBeforeUnlock: Record<'easy' | 'normal' | 'hard', number>;
    difficultyAfterUnlock: Record<'easy' | 'normal' | 'hard', number>;
    sameGenreAsPrevious: number;
    genreUsedTwice: number;
    relatedAsked: number;
  };
  /** 終了判定（設計書 5.9） */
  termination: {
    minQuestions: number;
    minQuestionsWithSurprises: number;
    maxQuestions: number;
    maxQuestionsWithSurprises: number;
    /** 意外な回答がこの数以上で「矛盾あり」とみなす */
    surprisesForCaution: number;
    stopWidth: number;
    minExpectedGainBits: number;
    lowGainStreak: number;
    maxDurationMs: number;
  };
  /** 多峰性（候補が複数の年代に分かれている）の判定 */
  multimodal: { minSeparationYears: number; minModeMass: number };
}

export const DEFAULT_CONFIG: EngineConfig = {
  birthYears: { oldestAge: 95, youngestAge: 8 },
  prior: { fullFromAge: 10, fullToAge: 85, edgeWeight: 0.4 },
  lapse: 0.08,
  temperature: 0.8,
  reliabilityWeight: { A: 1, B: 0.85, C: 0.6 },
  relatedDiscount: 0.7,
  surpriseThreshold: 0.05,
  calibrationSigma: 1.5,
  intervalMass: 0.8,
  confidence: { highMaxWidth: 5, mediumMaxWidth: 10 },
  basic: { count: 5 },
  selection: {
    randomBand: 0.85,
    hardUnlockWidth: 12,
    difficultyBeforeUnlock: { easy: 1, normal: 1, hard: 0.6 },
    difficultyAfterUnlock: { easy: 0.8, normal: 1, hard: 1.1 },
    sameGenreAsPrevious: 0.5,
    genreUsedTwice: 0.75,
    relatedAsked: 0.3,
  },
  termination: {
    minQuestions: 10,
    minQuestionsWithSurprises: 14,
    maxQuestions: 25,
    maxQuestionsWithSurprises: 30,
    surprisesForCaution: 2,
    stopWidth: 5,
    minExpectedGainBits: 0.03,
    lowGainStreak: 2,
    maxDurationMs: 6 * 60 * 1000,
  },
  multimodal: { minSeparationYears: 8, minModeMass: 0.15 },
};
