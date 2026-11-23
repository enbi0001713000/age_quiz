/**
 * ゲームの準備（質問データの読み込みと推理モデルの作成）。
 * 画面の表示を待たせないよう、タイトル画面の表示後に動的 import で読み込む。
 */
import { loadBundledDataset } from '../../data/bundle';
import { compileModel, type EngineModel } from '../../engine';
import { GameFlow } from './flow';

export interface GameFactory {
  model: EngineModel;
  newGame(): GameFlow;
}

export function prepareGame(now = new Date()): GameFactory {
  const model = compileModel(loadBundledDataset(), { referenceYear: now.getFullYear() });
  return {
    model,
    newGame: () =>
      new GameFlow(model, {
        seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
        startedAt: Date.now(),
      }),
  };
}
