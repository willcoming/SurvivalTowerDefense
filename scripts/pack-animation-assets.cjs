const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const args = process.argv.slice(2);
const inputFile = args.find(arg => arg.startsWith('--input='))?.slice(8) || 'artifacts/animation-sources/generated.json';
const selected = new Set(args.filter(arg => !arg.startsWith('--')));
const assets = JSON.parse(fs.readFileSync(inputFile)).assets;
for (const id of selected) if (!assets.some(asset => asset.id === id)) throw Error('Unknown motion asset: ' + id);
const input = assets.filter(asset => !selected.size || selected.has(asset.id));
const poseNames = ['idle', 'ready', 'aim', 'fire', 'recoil', 'recover'];
const report = [];
fs.mkdirSync('public/assets/animations', { recursive: true });
const outputDir = process.env.VALIDATION_OUTPUT_DIR || 'artifacts/validation/animation-update';
fs.mkdirSync(`${outputDir}/frames`, { recursive: true });
fs.mkdirSync('artifacts/animation-sources', { recursive: true });
function gap(counts, nominal) {
  const lo = Math.floor(nominal - 60), hi = Math.ceil(nominal + 60);
  let best = Math.round(nominal), score = Infinity;
  for (let i = lo; i <= hi; i++) {
    if (counts[i]) continue;
    const start = i;
    while (i + 1 <= hi && !counts[i + 1]) i++;
    if (i - start < 4) continue;
    const middle = Math.round((start + i) / 2), distance = Math.abs(middle - nominal);
    if (distance < score) { best = middle; score = distance; }
  }
  return best;
}
(async () => {
for (const asset of input) {
  if (!/^[A-Za-z0-9-]+$/.test(asset.id)) throw Error('Invalid motion asset ID');
  const source = `artifacts/animation-sources/${asset.id}-generated.png`;
  if (path.resolve(asset.source) !== path.resolve(source)) fs.copyFileSync(asset.source, source);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = new Uint32Array(info.height), cols = new Uint32Array(info.width);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (data[i] >= 195 && data[i + 2] >= 195 && data[i + 1] < 85) { data[i + 3] = 0; data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
    if (data[i + 3] > 32) { rows[y]++; cols[x]++; }
  }
  const xs = [0, gap(cols, info.width / 3), gap(cols, info.width * 2 / 3), info.width];
  const ys = [0, gap(rows, info.height / 2), info.height];
  if (cols[xs[1]] || cols[xs[2]] || rows[ys[1]]) throw Error(`${asset.id}: occupied grid gutter; regenerate with clear separation`);
  const bounds = [];
  for (let n = 0; n < 6; n++) {
    const col = n % 3, row = Math.floor(n / 3), x0 = xs[col], x1 = xs[col + 1], y0 = ys[row], y1 = ys[row + 1];
    let left = x1, top = y1, right = x0, bottom = y0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (data[(y * info.width + x) * 4 + 3] > 32) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    if (right <= left || bottom <= top || left <= x0 || right >= x1 - 1 || top <= y0 || bottom >= y1 - 1) throw Error(`${asset.id} frame ${n}: empty or clipped pose`);
    let footL = right, footR = left;
    for (let y = Math.max(top, bottom - 35); y <= bottom; y++) for (let x = left; x <= right; x++) if (data[(y * info.width + x) * 4 + 3] > 32) { footL = Math.min(footL, x); footR = Math.max(footR, x); }
    bounds.push({ left, top, right, bottom, center: (footL + footR) / 2 });
  }
  const scale = Math.min(...bounds.flatMap(b => [220 / (b.bottom - b.top + 1), 116 / (b.center - b.left + 1), 116 / (b.right - b.center + 1)]));
  const layers = [], frames = [];
  for (let n = 0; n < 6; n++) {
    const b = bounds[n], width = b.right - b.left + 1, height = b.bottom - b.top + 1;
    const resizedRaw = await sharp(data, { raw: info }).extract({ left: b.left, top: b.top, width, height }).resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))).raw().toBuffer({ resolveWithObject: true });
    // Resampling may blend saturated key pixels back into partially transparent edges.
    for (let i = 0; i < resizedRaw.data.length; i += 4) if (resizedRaw.data[i] >= 195 && resizedRaw.data[i + 2] >= 195 && resizedRaw.data[i + 1] < 85) resizedRaw.data.fill(0, i, i + 4);
    const resized = await sharp(resizedRaw.data, { raw: { width: resizedRaw.info.width, height: resizedRaw.info.height, channels: 4 } }).png().toBuffer();
    const left = Math.round(128 - (b.center - b.left) * scale), top = Math.round(240 - height * scale);
    const frame = await sharp({ create: { width: 256, height: 256, channels: 4, background: '#00000000' } }).composite([{ input: resized, left, top }]).png().toBuffer();
    layers.push({ input: frame, left: n % 3 * 256, top: Math.floor(n / 3) * 256 });
    const framePath = `${outputDir}/frames/${asset.id}-${poseNames[n]}.png`;
    fs.writeFileSync(framePath, frame);
    frames.push({ index: n, name: poseNames[n], sha256: crypto.createHash('sha256').update(frame).digest('hex'), sourceBounds: b });
  }
  const filename = asset.filename || `${asset.id}-motion.webp`;
  if (!/^[A-Za-z0-9-]+\.webp$/.test(filename)) throw Error('Invalid motion filename');
  const output = `public/assets/animations/${filename}`;
  await sharp({ create: { width: 768, height: 512, channels: 4, background: '#00000000' } }).composite(layers).webp({ lossless: true }).toFile(output);
  const bytes = fs.readFileSync(output), meta = await sharp(bytes).metadata();
  report.push({ assetId: `${asset.id}-motion`, path: output.replace('public', ''), width: 768, height: 512, frameWidth: 256, frameHeight: 256, frameCount: 6, origin: { x: .5, y: 240 / 256 }, hasAlpha: meta.hasAlpha, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), source, backgroundMode: 'alpha-keyed-from-magenta', tool: 'imagegen built-in', prompt: asset.prompt, editPrompt: asset.editPrompt, editReference: asset.editReference, reference: asset.reference, loadGroup: 'battle-motion', gridCuts: { xs, ys }, scale, frames });
}
const packedIds = new Set(report.map(asset => asset.assetId));
const old = JSON.parse(fs.readFileSync('public/assets/manifest.json')).filter(a => !packedIds.has(a.assetId));
fs.writeFileSync('public/assets/manifest.json', JSON.stringify([...old, ...report], null, 2));
fs.writeFileSync(`${outputDir}/assets.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(a => ({ id: a.assetId, bytes: a.bytes, frames: a.frameCount, alpha: a.hasAlpha, gridCuts: a.gridCuts })), null, 2));
})();
