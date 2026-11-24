import { mount } from 'svelte';
/**
 * 全質問のレイアウト確認用のプレビュー（開発サーバーでのみ使う。本番ビルドには含まれない）。
 * ?q=質問ID で、その質問の質問画面を表示する。
 */
import '../../src/styles/global.css';
import { loadBundledDataset } from '../../src/data/bundle';
import { GENRE_LABELS, SPECIAL_OPTION_KINDS } from '../../src/data/constants';
import QuestionScreen from '../../src/ui/screens/QuestionScreen.svelte';
const ds = loadBundledDataset();
const id = new URLSearchParams(location.search).get('q');
(window as unknown as { __ids: string[] }).__ids = ds.questions.map((q) => q.id);
const q = ds.questions.find((x) => x.id === id) ?? ds.questions[0]!;
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
const main = q.options.filter((o) => !SPECIAL_OPTION_KINDS.includes(o.kind));
const view = {
  finished: false,
  answered: 7,
  basicTotal: 5,
  phase: 'adaptive',
  progress: 0.4,
  status: '精密分析中',
  radar: {
    bars: [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010].map((d) => ({
      decade: d,
      probability: 0.11,
    })),
    label: '1980年代',
    afterAnswers: 6,
  },
  question: {
    id: q.id,
    number: 8,
    text: q.text,
    genreLabel: GENRE_LABELS[q.genre],
    difficulty: q.difficulty,
    phase: 'adaptive',
    options: main.map((o, i) => ({ id: o.id, label: o.label, key: KEYS[i]! })),
    specialOptions: q.options
      .filter((o) => SPECIAL_OPTION_KINDS.includes(o.kind))
      .map((o) => ({ id: o.id, label: o.label, kind: o.kind })),
  },
};
const flow = { view: () => view, answer: () => [] };
mount(QuestionScreen, {
  target: document.getElementById('app')!,
  props: { flow: flow as never, motion: 'reduce', onfinished: () => {} },
});
