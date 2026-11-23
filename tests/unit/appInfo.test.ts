import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { APP_INFO } from '../../src/app/appInfo';

describe('APP_INFO', () => {
  it('ビルド時に埋め込まれたバージョンが package.json と一致する', () => {
    expect(APP_INFO.version).toBe(pkg.version);
  });

  it('バージョンはセマンティックバージョニング形式である（履歴の版比較に使うため）', () => {
    expect(APP_INFO.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('コンセプト文は要件定義書 1-3 のとおり', () => {
    expect(APP_INFO.concept).toBe('あなたの記憶から、AIが年齢を推理する。');
  });
});
