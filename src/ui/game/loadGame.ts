/**
 * ゲームの準備（質問データの読み込みと推理モデルの作成）。
 * 画面の表示を待たせないよう、タイトル画面の表示後に動的 import で読み込む。
 */
import { loadBundledDataset } from '../../data/bundle';
import type { Dataset } from '../../data/schema';
import { dataVersion } from '../../data/version';
import { compileModel, type EngineModel } from '../../engine';
import { buildResultBundle, type ResultBundle } from '../result/bundle';
import { GameFlow } from './flow';

export interface GameFactory {
  dataset: Dataset;
  dataVersion: string;
  model: EngineModel;
  newGame(): GameFlow;
  /** 終了したゲームから結果画面の情報をまとめる（推理エンジンを含むためこのモジュールに置く） */
  buildResult(flow: GameFlow): ResultBundle;
}

export function prepareGame(now = new Date()): GameFactory {
  const dataset = loadBundledDataset();
  const model = compileModel(dataset, { referenceYear: now.getFullYear() });
  return {
    dataset,
    dataVersion: dataVersion(dataset),
    model,
    newGame: () =>
      new GameFlow(model, {
        seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
        startedAt: Date.now(),
      }),
    buildResult: (flow) => {
      if (!dataset.generations) throw new Error('世代分類のデータがありません');
      return buildResultBundle(flow, dataset.generations);
    },
  };
}
