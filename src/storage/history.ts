/**
 * プレイ履歴（設計書 8章、要件 9章）。
 * 保存するのは推定結果だけ。個々の回答・実年齢は保存しない。
 */
import type { ConfidenceLevel } from '../engine';
import type { KeyValueStore } from './storage';

export const HISTORY_KEY = 'agequiz.history.v1';
export const HISTORY_MAX = 50;

export interface HistoryEntry {
  id: string;
  /** プレイ日時（ISO 8601） */
  playedAt: string;
  estimate: {
    birthYear: number;
    birthRange: [number, number];
    /** 画面に表示した生年の範囲（確信度によって丸め方が異なる。結果画面と同じ見出しを作るために保存） */
    displayRange: [number, number];
    /** プレイ時点の推定年齢 */
    ageRange: [number, number];
    generationId: string;
    confidence: ConfidenceLevel;
  };
  /** 推理ロジック・質問データの版（ロジック更新前後の結果を比べる際の注意表示に使う） */
  engineVersion: string;
  dataVersion: string;
}

interface HistoryFile {
  schemaVersion: 1;
  entries: HistoryEntry[];
}

const isPair = (x: unknown): x is [number, number] =>
  Array.isArray(x) && x.length === 2 && x.every((v) => Number.isInteger(v));

/** 壊れたデータや古い形式のデータを読み飛ばす */
function isEntry(x: unknown): x is HistoryEntry {
  if (!x || typeof x !== 'object') return false;
  const e = x as Partial<HistoryEntry>;
  const est = e.estimate;
  return (
    typeof e.id === 'string' &&
    typeof e.playedAt === 'string' &&
    !!est &&
    Number.isInteger(est.birthYear) &&
    isPair(est.birthRange) &&
    isPair(est.displayRange) &&
    isPair(est.ageRange) &&
    typeof est.generationId === 'string' &&
    ['high', 'medium', 'low'].includes(est.confidence as string)
  );
}

export function loadHistory(store: KeyValueStore): HistoryEntry[] {
  try {
    const raw = store.getItem(HISTORY_KEY);
    if (!raw) return [];
    const file = JSON.parse(raw) as Partial<HistoryFile>;
    if (file.schemaVersion !== 1 || !Array.isArray(file.entries)) return [];
    return file.entries.filter(isEntry);
  } catch {
    return [];
  }
}

function save(store: KeyValueStore, entries: HistoryEntry[]): boolean {
  try {
    const file: HistoryFile = { schemaVersion: 1, entries };
    store.setItem(HISTORY_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

/** 先頭（新しい順）に追加。上限を超えた古い履歴は削除する。保存できたか返す */
export function addHistory(store: KeyValueStore, entry: HistoryEntry): boolean {
  return save(store, [entry, ...loadHistory(store)].slice(0, HISTORY_MAX));
}

export function deleteHistory(store: KeyValueStore, id: string): boolean {
  return save(
    store,
    loadHistory(store).filter((e) => e.id !== id),
  );
}

export function clearHistory(store: KeyValueStore): boolean {
  try {
    store.removeItem(HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}

/** 履歴用のランダムなID */
export function newHistoryId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
