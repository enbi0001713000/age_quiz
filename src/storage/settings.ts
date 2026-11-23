/**
 * アプリの設定（設計書 8章）。現在は「演出を短縮」のみ。
 */
import type { KeyValueStore } from './storage';

export const SETTINGS_KEY = 'agequiz.settings.v1';

/** system＝端末の「視差効果を減らす」設定に従う / reduce＝短縮する / normal＝通常 */
export type MotionPreference = 'system' | 'reduce' | 'normal';

export interface Settings {
  motion: MotionPreference;
}

export const DEFAULT_SETTINGS: Settings = { motion: 'system' };

export function loadSettings(store: KeyValueStore): Settings {
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as { schemaVersion?: number; motion?: unknown };
    const motion = ['system', 'reduce', 'normal'].includes(s.motion as string)
      ? (s.motion as MotionPreference)
      : DEFAULT_SETTINGS.motion;
    return { motion };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(store: KeyValueStore, settings: Settings): boolean {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, ...settings }));
    return true;
  } catch {
    return false;
  }
}
