/**
 * データの定数（ジャンル・選択肢の種類）。
 * 実行時に使う値はここに置き、検査ライブラリ（Zod）を含む schema.ts をアプリに同梱しないようにする。
 */
export const GENRES = [
  'game',
  'anime_manga',
  'tv_cm',
  'toy',
  'mobile',
  'internet_sns',
  'music',
  'school',
  'food',
  'fashion',
  'news',
  'appliance',
] as const;
export type Genre = (typeof GENRES)[number];

/** ジャンルの表示名（要件定義書 3-4 の12ジャンル） */
export const GENRE_LABELS: Record<Genre, string> = {
  game: 'ゲーム・ゲーム機',
  anime_manga: 'アニメ・漫画',
  tv_cm: 'テレビ番組・CM',
  toy: 'おもちゃ・玩具',
  mobile: '携帯電話・スマートフォン',
  internet_sns: 'インターネット・SNS',
  music: '音楽・アーティスト',
  school: '学校生活・教育',
  food: '食べ物・飲み物・お菓子',
  fashion: 'ファッション・流行',
  news: '社会的な出来事・ニュース',
  appliance: '生活用品・家電',
};

export const OPTION_KINDS = [
  // 経験型
  'heavy', // よく経験した
  'light', // 少し経験した
  'aware_only', // 知っているが経験はない（＝要件の「経験がない」のうち認知あり）
  'no_experience', // 経験がない（認知の有無を問わない）
  'unaware', // 知らない
  // 時代選択型
  'era', // 時代を表す選択肢（subject を参照）
  'none_of_these', // この中にはない
  // 特殊回答
  'dont_remember', // 覚えていない（推理に使わない）
  'not_applicable', // 該当しない（推理から除外）
] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

/** 選択肢数（4〜6）に数えない特殊回答 */
export const SPECIAL_OPTION_KINDS: readonly OptionKind[] = ['dont_remember', 'not_applicable'];
