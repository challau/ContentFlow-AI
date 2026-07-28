/** Deterministic PRNG so the same brief always yields the same output. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next: () => number;

  constructor(seed: string) {
    this.next = mulberry32(hashString(seed));
  }

  float(): number {
    return this.next();
  }

  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  /** Picks `count` items without repeating until the pool is exhausted. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < count; i++) {
      if (pool.length === 0) pool.push(...items);
      const idx = Math.floor(this.next() * pool.length) % pool.length;
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  bool(trueBias = 0.5): boolean {
    return this.next() < trueBias;
  }
}
