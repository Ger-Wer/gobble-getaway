// A small seeded random (mulberry32): the same seed plays the same run, which
// is what makes the screenshot scenes repeatable and the world testable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer hash in [-1, 1] for deterministic decoration (leaves, speckles). */
export function hashNoise(n) {
  let x = (n | 0) * 374761393;
  x = (x ^ (x >>> 13)) * 1274126177;
  x = x ^ (x >>> 16);
  return (x & 0x7fffffff) / 1073741824 - 1;
}
