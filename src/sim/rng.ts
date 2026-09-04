export function nextRandom(state: { [key: string]: number }, key: string): number {
  let x = state[key] >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state[key] = (x >>> 0) || 0x6d2b79f5;
  return state[key] / 4294967296;
}
export function seedValue(seed: number, salt: number): number {
  let x = (seed ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) || 1;
}
