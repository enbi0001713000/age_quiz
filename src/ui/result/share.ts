/**
 * 共有用の文章とURL（要件 10章）。回答内容・実年齢などの個人情報は含めない。
 */
import { APP_INFO } from '../../app/appInfo';
import type { Estimate } from '../../engine';
import { ageText, birthText } from '../format';

export const HASHTAG = '年齢推理ゲーム';

export function shareText(estimate: Estimate, generationName: string): string {
  const b = birthText(estimate);
  return `AIの分析結果：「${b.headline}」（推定年齢${ageText(estimate)}・${generationName}）と推定されました。${APP_INFO.concept}`;
}

/** X（旧Twitter）の投稿画面のURL */
export function xIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({ text, url, hashtags: HASHTAG });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** コピー用：文章＋ハッシュタグ＋URL */
export function copyText(text: string, url: string): string {
  return `${text} #${HASHTAG}\n${url}`;
}

/** このページの共有用URL（クエリやハッシュを除く） */
export function appUrl(location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}`;
}
