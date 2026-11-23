/**
 * シード付き乱数（mulberry32）。
 * テスト・シミュレーションで結果を再現できるようにするため、Math.random は使わない。
 */
export type Random = () => number;

export function createRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 配列から k 個を重複なく選ぶ（順序もランダム） */
export function sample<T>(items: readonly T[], k: number, random: Random): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, k);
}

/** 標準正規分布（Box–Muller） */
export function gaussian(random: Random): number {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}
