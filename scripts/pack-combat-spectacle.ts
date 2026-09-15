import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ALLY_BODY_HEIGHT, ALLY_MOTION } from '../src/data/character-motion';
import { ENEMY_POSES, enemyFrameSize } from '../src/game/enemy-motion';
import { removeMagentaMatte } from '../src/game/chroma';
import type { CharacterId } from '../src/sim/types';

interface Source { id: string; kind: 'ally' | 'enemy' | 'fx'; source: string; prompt: string; reference?: string; bodyTop?: number; bodyBottom?: number; cuts?: { xs?: number[][]; ys?: number[] } }
interface Box { left: number; top: number; right: number; bottom: number; center: number }
const input = JSON.parse(readFileSync('artifacts/combat-spectacle/generated.json', 'utf8')) as { assets: Source[] };
const selected = new Set(process.argv.slice(2));
const assets = input.assets.filter(a => !selected.size || selected.has(a.id));
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const digest = (bytes: Buffer | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const reports: unknown[] = [];
mkdirSync('artifacts/combat-spectacle/frames', { recursive: true });

function cut(counts: Uint32Array, nominal: number, span: number) {
  let best = Math.round(nominal), score = Infinity;
  for (let i = Math.floor(nominal - span); i <= Math.ceil(nominal + span); i++) {
    const value = counts[i] * 1000 + Math.abs(i - nominal);
    if (value < score) { score = value; best = i; }
  }
  if (counts[best] === 0) {
    let l = best, r = best;
    while (l > 0 && !counts[l - 1]) l--;
    while (r + 1 < counts.length && !counts[r + 1]) r++;
    best = Math.round((l + r) / 2);
  }
  return best;
}

for (const asset of assets) {
  const bytes = readFileSync(asset.source);
  const { data: raw, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(raw);
  const keyed = removeMagentaMatte(pixels, info.width, info.height);
  const data = Buffer.from(pixels);
  const columns = 4, rows = asset.kind === 'ally' ? 3 : 4;
  const size = asset.kind === 'ally' ? ALLY_MOTION.frameWidth : asset.kind === 'enemy' ? enemyFrameSize(asset.id) : asset.id === 'combat-ammo' ? 128 : 256;
  const rowCounts = new Uint32Array(info.height);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 48) rowCounts[y]++;
  const ys = asset.cuts?.ys ?? [0, ...Array.from({ length: rows - 1 }, (_, i) => asset.kind === 'fx' ? Math.round((i + 1) * info.height / rows) : cut(rowCounts, (i + 1) * info.height / rows, info.height / rows * .12)), info.height];
  const xs = asset.cuts?.xs ?? Array.from({ length: rows }, (_, row) => {
    const counts = new Uint32Array(info.width);
    for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 48) counts[x]++;
    return [0, ...[1, 2, 3].map(i => asset.kind === 'fx' ? Math.round(i * info.width / 4) : cut(counts, i * info.width / 4, info.width / 4 * .14)), info.width];
  });
  const boxes: Box[] = [];
  for (let n = 0; n < columns * rows; n++) {
    const row = Math.floor(n / columns), col = n % columns;
    const x0 = xs[row][col], x1 = xs[row][col + 1], y0 = ys[row], y1 = ys[row + 1];
    let left = x1, top = y1, right = x0, bottom = y0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (data[(y * info.width + x) * 4 + 3] > 48) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    if (left >= right || top >= bottom) throw new Error(`${asset.id} frame ${n}: empty`);
    if ((asset.kind !== 'fx' || asset.id !== 'combat-props') && (left <= x0 || right >= x1 - 1 || top <= y0 || bottom >= y1 - 1)) throw new Error(`${asset.id} frame ${n}: occupied gutter ${JSON.stringify({ left, top, right, bottom, x0, x1, y0, y1 })}`);
    let footL = right, footR = left;
    for (let y = Math.max(top, bottom - 20); y <= bottom; y++) for (let x = left; x <= right; x++) if (data[(y * info.width + x) * 4 + 3] > 48) { footL = Math.min(footL, x); footR = Math.max(footR, x); }
    boxes.push({ left, top, right, bottom, center: (footL + footR) / 2 });
  }
  const bodyTop = asset.bodyTop ?? boxes[0].top, bodyBottom = asset.bodyBottom ?? boxes[0].bottom;
  const targetHeight = asset.kind === 'ally' ? ALLY_BODY_HEIGHT[asset.id.slice(0, 3) as CharacterId] : 0;
  // No minimum-to-fit calculation for allies: equipment can never silently shrink a body.
  const scale = asset.kind === 'ally' ? targetHeight / (bodyBottom - bodyTop + 1) : Math.min(...boxes.flatMap(b => [(size - 20) / (b.right - b.left + 1), size * .80 / (b.bottom - b.top + 1)]));
  const layers = [], frames = [];
  for (let n = 0; n < boxes.length; n++) {
    const b = boxes[n], width = b.right - b.left + 1, height = b.bottom - b.top + 1;
    const materialGroup = (asset.id === 'combat-props' || asset.id === 'combat-ammo') && n < 8 ? [b] : boxes.slice(Math.floor(n / 4) * 4, Math.floor(n / 4) * 4 + 4);
    const frameScale = asset.kind === 'fx' ? (size - 24) / Math.max(...materialGroup.flatMap(box => [box.right - box.left + 1, box.bottom - box.top + 1])) : scale;
    const w = Math.max(1, Math.round(width * frameScale)), h = Math.max(1, Math.round(height * frameScale));
    const left = asset.kind === 'ally' ? Math.round(size / 2 - (b.center - b.left) * frameScale) : Math.round((size - w) / 2);
    const top = asset.kind === 'ally' ? Math.round(ALLY_MOTION.originY * size - h) : asset.kind === 'enemy' ? Math.round(size * .88 - h) : Math.round((size - h) / 2);
    if (left < 3 || top < 3 || left + w > size - 3 || top + h > size - 3) throw new Error(`${asset.id} frame ${n}: body-normalized art overflows canvas; revise source, never shrink body (${left},${top},${w},${h})`);
    const sprite = await sharp(data, { raw: info }).extract({ left: b.left, top: b.top, width, height }).resize(w, h).png().toBuffer();
    const frame = await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } }).composite([{ input: sprite, left, top }]).png().toBuffer();
    const name = asset.kind === 'ally' ? ALLY_MOTION.poses[n] : asset.kind === 'enemy' ? ENEMY_POSES[n] : `material-${n}`;
    writeFileSync(`artifacts/combat-spectacle/frames/${asset.id}-${name}.png`, frame);
    layers.push({ input: frame, left: n % columns * size, top: Math.floor(n / columns) * size });
    frames.push({ index: n, name, sha256: digest(frame), sourceBounds: b, outputBounds: { left, top, width: w, height: h } });
  }
  if (new Set(frames.map(f => f.sha256)).size !== frames.length) throw new Error(`${asset.id}: duplicate pose`);
  const folder = asset.kind === 'ally' ? 'animations' : asset.kind === 'enemy' ? 'enemy-animations' : 'vfx';
  const path = `/assets/${folder}/${asset.id}${asset.kind === 'fx' ? '' : '-motion'}-v2.webp`;
  mkdirSync(`public/assets/${folder}`, { recursive: true });
  await sharp({ create: { width: columns * size, height: rows * size, channels: 4, background: '#00000000' } }).composite(layers).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(`public${path}`);
  const packed = readFileSync(`public${path}`);
  const record = { assetId: `spectacle-${asset.id}`, path, width: columns * size, height: rows * size, frameWidth: size, frameHeight: size, frameCount: frames.length, origin: asset.kind === 'ally' ? { x: .5, y: ALLY_MOTION.originY } : { x: .5, y: .5 }, hasAlpha: true, bytes: packed.length, sha256: digest(packed), source: asset.source, sourceSha256: digest(bytes), prompt: asset.prompt, reference: asset.reference, tool: 'imagegen built-in', backgroundMode: keyed ? 'alpha-keyed-magenta' : 'generated-alpha', body: asset.kind === 'ally' ? { sourceTop: bodyTop, sourceBottom: bodyBottom, normalizedHeight: targetHeight } : undefined, scale, gridCuts: { xs, ys }, frames, loadGroup: asset.kind === 'ally' ? 'battle-motion' : asset.kind === 'enemy' ? 'enemy-motion' : 'battle-vfx' };
  const previous = manifest.findIndex((a: { assetId: string }) => a.assetId === record.assetId);
  if (previous >= 0) manifest[previous] = record; else manifest.push(record);
  writeFileSync('public/assets/manifest.json', JSON.stringify(manifest, null, 2));
  reports.push(record);
  console.log(`${asset.id}: ${frames.length} poses; ${Math.round(packed.length / 1024)} KiB${targetHeight ? `; body ${targetHeight}px` : ''}`);
}
writeFileSync('public/assets/manifest.json', JSON.stringify(manifest, null, 2));
writeFileSync('artifacts/combat-spectacle/packing.json', JSON.stringify(reports, null, 2));
