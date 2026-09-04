const fs = require('node:fs');
const crypto = require('node:crypto');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const dir = 'artifacts/validation/enemy-motion';
const sourceDir = 'artifacts/enemy-motion-sources';
const poses = ['idle-a', 'idle-b', 'move-1', 'move-2', 'move-3', 'move-4', 'move-5', 'move-6', 'anticipate', 'strike', 'charge-a', 'charge-b'];
const input = JSON.parse(fs.readFileSync(`${sourceDir}/generated.json`)).assets;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function gap(counts, nominal, span) {
  let best = Math.round(nominal), score = Infinity;
  for (let i = Math.floor(nominal - span); i <= Math.ceil(nominal + span); i++) {
    const value = counts[i] * 1000 + Math.abs(i - nominal);
    if (value < score) { best = i; score = value; }
  }
  if (counts[best] === 0) {
    let left = best, right = best;
    while (left > 0 && counts[left - 1] === 0) left--;
    while (right < counts.length - 1 && counts[right + 1] === 0) right++;
    return Math.round((left + right) / 2);
  }
  return best;
}
(async () => {
  fs.mkdirSync('public/assets/enemy-animations', { recursive: true });
  fs.mkdirSync(`${dir}/frames`, { recursive: true });
  const report = [];
  for (const asset of input) {
    const source = `${sourceDir}/${asset.id}-generated.png`;
    fs.copyFileSync(asset.source, source);
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rows = new Uint32Array(info.height), cols = new Uint32Array(info.width);
    let keyed = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i] > 170 && data[i + 2] > 170 && data[i + 1] < 125) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; keyed++; }
      if (data[i + 3] > 32) { rows[y]++; cols[x]++; }
    }
    const ys = [0, ...[1, 2].map(i => gap(rows, info.height * i / 3, info.height / 3 * .19)), info.height];
    const xs = [0, 1, 2].map(row => {
      const local = new Uint32Array(info.width);
      for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 32) local[x]++;
      return [0, ...[1, 2, 3].map(i => gap(local, info.width * i / 4, info.width / 4 * .19)), info.width];
    });
    const bounds = [];
    for (let n = 0; n < 12; n++) {
      const col = n % 4, row = Math.floor(n / 4), x0 = xs[row][col], x1 = xs[row][col + 1], y0 = ys[row], y1 = ys[row + 1];
      let left = x1, right = x0, top = y1, bottom = y0, pixels = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (data[(y * info.width + x) * 4 + 3] > 32) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); pixels++; }
      if (pixels < 1000) throw new Error(`${asset.id} frame ${n}: missing creature (${pixels} pixels)`);
      if (left <= x0 || right >= x1 - 1 || top <= y0 || bottom >= y1 - 1) throw new Error(`${asset.id} frame ${n}: creature touches a crop boundary ${JSON.stringify({left,right,top,bottom,x0,x1,y0,y1,xs,ys})}; inspect/revise source instead of clipping`);
      bounds.push({ left, right, top, bottom, pixels });
    }
    const size = asset.id.startsWith('B') ? 224 : 160;
    const scale = Math.min(...bounds.flatMap(b => [(size - 16) / (b.right - b.left + 1), (size - 16) / (b.bottom - b.top + 1)]));
    const layers = [], frames = [];
    for (let n = 0; n < 12; n++) {
      const b = bounds[n], width = b.right - b.left + 1, height = b.bottom - b.top + 1;
      const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
      const sprite = await sharp(data, { raw: info }).extract({ left: b.left, top: b.top, width, height }).resize(w, h).png().toBuffer();
      const frame = await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } }).composite([{ input: sprite, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }]).png().toBuffer();
      fs.writeFileSync(`${dir}/frames/${asset.id}-${poses[n]}.png`, frame);
      layers.push({ input: frame, left: n % 4 * size, top: Math.floor(n / 4) * size });
      frames.push({ index: n, pose: poses[n], sha256: hash(frame), sourceBounds: b, outputSize: { width: w, height: h } });
    }
    if (new Set(frames.map(f => f.sha256)).size !== 12) throw new Error(`${asset.id}: duplicate pose images`);
    const output = `public/assets/enemy-animations/${asset.id}-motion.webp`;
    await sharp({ create: { width: size * 4, height: size * 3, channels: 4, background: '#00000000' } }).composite(layers).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(output);
    const bytes = fs.readFileSync(output), meta = await sharp(bytes).metadata();
    if (!meta.hasAlpha || meta.width !== size * 4 || meta.height !== size * 3) throw new Error(`${asset.id}: invalid output atlas`);
    report.push({ assetId: `enemy-${asset.id}-motion`, enemyId: asset.id, path: output.replace('public', ''), width: size * 4, height: size * 3, frameWidth: size, frameHeight: size, frameCount: 12, origin: { x: .5, y: .5 }, hasAlpha: true, bytes: bytes.length, sha256: hash(bytes), source, sourceSha256: hash(fs.readFileSync(source)), backgroundMode: keyed ? 'alpha-keyed-from-magenta' : 'generated-alpha', tool: 'imagegen built-in', prompt: asset.prompt, loadGroup: 'enemy-motion', gridCuts: { xs, ys }, scale, frames });
    console.log(`${asset.id}: 12 unique poses, alpha, ${bytes.length} bytes`);
  }
  const old = JSON.parse(fs.readFileSync('public/assets/manifest.json')).filter(a => !report.some(r => r.assetId === a.assetId));
  fs.writeFileSync('public/assets/manifest.json', JSON.stringify([...old, ...report], null, 2));
  fs.writeFileSync(`${dir}/assets.json`, JSON.stringify(report, null, 2));
})();
