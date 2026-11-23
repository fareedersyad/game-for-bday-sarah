/**
 * Small deterministic PRNG (mulberry32). The world layout uses it so that
 * procedural trees/flowers are identical on every device and every reload —
 * collision, navigation and rendering always agree.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof mulberry32>;

export const range = (rng: Rng, min: number, max: number) => min + (max - min) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
