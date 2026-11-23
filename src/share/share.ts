/**
 * 共有の実行（PNG保存・Web Share API・コピー）。使えない環境では代替手段に切り替える（要件 10章）。
 */

/** 画像をダウンロードさせる */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

/** Web Share API で共有（画像を添付できる端末では画像も添付） */
export async function shareNative(data: {
  title: string;
  text: string;
  url: string;
  file?: File;
}): Promise<ShareOutcome> {
  if (typeof navigator.share !== 'function') return 'unsupported';
  const payload: ShareData = { title: data.title, text: data.text, url: data.url };
  if (data.file && navigator.canShare?.({ files: [data.file] })) payload.files = [data.file];
  try {
    await navigator.share(payload);
    return 'shared';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

/** クリップボードにコピー（Clipboard API が使えない場合は従来の方法） */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 下の方法を試す
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
