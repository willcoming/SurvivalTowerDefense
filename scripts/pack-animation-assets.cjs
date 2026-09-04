const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const input = JSON.parse(fs.readFileSync('artifacts/animation-sources/generated.json')).assets;
const poseNames = ['idle', 'ready', 'aim', 'fire', 'recoil', 'recover'];
const report = [];
fs.mkdirSync('public/assets/animations', { recursive: true });
fs.mkdirSync('artifacts/validation/animation-update/frames', { recursive: true });
function gap(counts, nominal) {
  const lo = Math.floor(nominal - 60), hi = Math.ceil(nominal + 60);
  let best = nominal, score = Infinity;
  for (let i = lo; i <= hi; i++) { const s = counts[i] * 100 + Math.abs(i - nominal); if (s < score) { best = i; score = s; } }
  return best;
}
(async () => {
for (const asset of input) {
  const source = `artifacts/animation-sources/${asset.id}-generated.png`;
  fs.copyFileSync(asset.source, source);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = new Uint32Array(info.height), cols = new Uint32Array(info.width);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (data[i] > 195 && data[i + 2] > 195 && data[i + 1] < 85) { data[i + 3] = 0; data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
    if (data[i + 3] > 32) { rows[y]++; cols[x]++; }
  }
  const xs = [0, gap(cols, info.width / 3), gap(cols, info.width * 2 / 3), info.width];
  const ys = [0, gap(rows, info.height / 2), info.height];
  const bounds = [];
  for (let n = 0; n < 6; n++) {
    const col = n % 3, row = Math.floor(n / 3), x0 = xs[col], x1 = xs[col + 1], y0 = ys[row], y1 = ys[row + 1];
    let left = x1, top = y1, right = x0, bottom = y0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (data[(y * info.width + x) * 4 + 3] > 32) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    let footL = right, footR = left;
    for (let y = Math.max(top, bottom - 35); y <= bottom; y++) for (let x = left; x <= right; x++) if (data[(y * info.width + x) * 4 + 3] > 32) { footL = Math.min(footL, x); footR = Math.max(footR, x); }
    bounds.push({ left, top, right, bottom, center: (footL + footR) / 2 });
  }
  const scale = Math.min(.47, ...bounds.flatMap(b => [220 / (b.bottom - b.top + 1), 116 / (b.center - b.left + 1), 116 / (b.right - b.center + 1)]));
  const layers = [], frames = [];
  for (let n = 0; n < 6; n++) {
    const b = bounds[n], width = b.right - b.left + 1, height = b.bottom - b.top + 1;
    const resized = await sharp(data, { raw: info }).extract({ left: b.left, top: b.top, width, height }).resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))).png().toBuffer();
    const left = Math.round(128 - (b.center - b.left) * scale), top = Math.round(240 - height * scale);
    const frame = await sharp({ create: { width: 256, height: 256, channels: 4, background: '#00000000' } }).composite([{ input: resized, left, top }]).png().toBuffer();
    layers.push({ input: frame, left: n % 3 * 256, top: Math.floor(n / 3) * 256 });
    const framePath = `artifacts/validation/animation-update/frames/${asset.id}-${poseNames[n]}.png`;
    fs.writeFileSync(framePath, frame);
    frames.push({ index: n, name: poseNames[n], sha256: crypto.createHash('sha256').update(frame).digest('hex'), sourceBounds: b });
  }
  const output = `public/assets/animations/${asset.id}-motion.webp`;
  await sharp({ create: { width: 768, height: 512, channels: 4, background: '#00000000' } }).composite(layers).webp({ lossless: true }).toFile(output);
  const bytes = fs.readFileSync(output), meta = await sharp(bytes).metadata();
  report.push({ assetId: `${asset.id}-motion`, path: output.replace('public', ''), width: 768, height: 512, frameWidth: 256, frameHeight: 256, frameCount: 6, origin: { x: .5, y: 240 / 256 }, hasAlpha: meta.hasAlpha, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), source, backgroundMode: 'alpha-keyed-from-magenta', tool: 'imagegen built-in', prompt: asset.prompt, loadGroup: 'battle-motion', gridCuts: { xs, ys }, scale, frames });
}
const old = JSON.parse(fs.readFileSync('public/assets/manifest.json')).filter(a => !a.assetId.endsWith('-motion'));
fs.writeFileSync('public/assets/manifest.json', JSON.stringify([...old, ...report], null, 2));
fs.writeFileSync('artifacts/validation/animation-update/assets.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(a => ({ id: a.assetId, bytes: a.bytes, frames: a.frameCount, alpha: a.hasAlpha, gridCuts: a.gridCuts })), null, 2));
})();
