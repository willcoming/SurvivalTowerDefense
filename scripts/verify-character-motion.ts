import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { FORMS, formMotion, formPortrait } from '../src/data/forms';
import { ALLY_MOTION, ALLY_ATTACKS, ALLY_BODY_HEIGHT } from '../src/data/character-motion';
import { ENEMIES } from '../src/data/content';
import { ENEMY_POSES, enemyFrameSize } from '../src/game/enemy-motion';

const sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE || 'sharp') as typeof import('sharp').default;
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const errors: string[] = [], forms = [], contact = [], lineup = [];
const size = ALLY_MOTION.frameWidth, columns = ALLY_MOTION.columns;
const output = process.env.VALIDATION_OUTPUT_DIR || 'artifacts/validation/form-motion';
mkdirSync(output, { recursive: true });
for (const [index, form] of FORMS.entries()) {
  const url = formMotion(form.id), path = `public${url}`, entry = manifest.find((a: {path: string}) => a.path === url);
  const fail = (message: string) => errors.push(`${form.id}: ${message}`);
  if (url === formPortrait(form.id) || !url.startsWith('/assets/animations/')) fail('portrait used as combat motion');
  if (!existsSync(path)) { fail('missing sheet'); continue; }
  const bytes = readFileSync(path), meta = await sharp(bytes).metadata();
  if (meta.width !== size * columns || meta.height !== size * ALLY_MOTION.frameCount / columns || !meta.hasAlpha) fail('sheet dimensions/alpha do not match motion contract');
  if (!entry || entry.sha256 !== createHash('sha256').update(bytes).digest('hex') || entry.bytes !== bytes.length) fail('manifest hash/size mismatch');
  if (entry?.frameCount !== ALLY_MOTION.frameCount || entry?.frameWidth !== size || entry?.frameHeight !== size || entry?.origin?.x !== .5 || entry?.origin?.y !== ALLY_MOTION.originY) fail('frame/origin contract mismatch');
  if (entry?.body?.normalizedHeight !== ALLY_BODY_HEIGHT[form.ownerId]) fail('missing body-scale calibration');
  const hashes = [], bounds = [];
  for (let i = 0; i < ALLY_MOTION.frameCount; i++) {
    const frame = sharp(bytes).extract({ left: i % columns * size, top: Math.floor(i / columns) * size, width: size, height: size });
    const { data } = await frame.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let pixels = 0, edge = 0, magenta = 0, bottom = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4;
      if (data[at + 3] < 32) continue;
      pixels++; bottom = Math.max(bottom, y);
      if (x < 3 || x > size - 4 || y < 3 || y > size - 4) edge++;
      if (data[at] > 195 && data[at + 2] > 195 && data[at + 1] < 85) magenta++;
    }
    // Small antialiased edge fringes are distinct from an opaque key background.
    if (pixels < 1500 || pixels > 58000 || edge || magenta / pixels > .005) fail(`frame ${i}: empty, clipped or incomplete key`);
    if (bottom < size * ALLY_MOTION.originY - 3 || bottom > size * ALLY_MOTION.originY + 2) fail(`frame ${i}: feet baseline ${bottom}`);
    hashes.push(createHash('sha256').update(data).digest('hex'));
    bounds.push({ pixels, bottom, edge, magenta });
    contact.push({ input: await frame.clone().resize(128, 128).png().toBuffer(), left: i * 128, top: index * 144 + 16 });
    if (i === 0) lineup.push({ input: await frame.clone().resize(160, 160).png().toBuffer(), left: Math.floor(index / 2) * 160, top: index % 2 * 176 + 16 });
  }
  if (new Set(hashes).size !== ALLY_MOTION.frameCount || new Set(entry?.frames?.map((f: {sha256:string}) => f.sha256)).size !== ALLY_MOTION.frameCount) fail('all normal and tactical poses must be distinct');
  forms.push({ id: form.id, path, bytes: bytes.length, action: ALLY_ATTACKS[form.ownerId].action, bounds });
}
const enemyContact = [], otherAtlases = [];
for (const [index, id] of [...ENEMIES.map(e => e.id), 'combat-fx', 'combat-props', 'combat-ammo'].entries()) {
  const enemy = index < ENEMIES.length, frameSize = enemy ? enemyFrameSize(id) : id === 'combat-ammo' ? 128 : 256;
  const path = `/assets/${enemy ? `enemy-animations/${id}-motion` : `vfx/${id}`}-v2.webp`;
  const fail = (message: string) => errors.push(`${id}: ${message}`);
  if (!existsSync(`public${path}`)) { fail('missing atlas'); continue; }
  const bytes = readFileSync(`public${path}`), meta = await sharp(bytes).metadata(), entry = manifest.find((a: {path: string}) => a.path === path);
  if (meta.width !== frameSize * 4 || meta.height !== frameSize * 4 || !meta.hasAlpha || entry?.frameCount !== 16) { fail('16-frame dimensions/alpha mismatch'); continue; }
  if (entry?.sha256 !== createHash('sha256').update(bytes).digest('hex')) fail('manifest hash mismatch');
  const hashes = [];
  for (let i = 0; i < 16; i++) {
    const frame = sharp(bytes).extract({ left: i % 4 * frameSize, top: Math.floor(i / 4) * frameSize, width: frameSize, height: frameSize });
    const { data } = await frame.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let visible = 0, edge = 0;
    for (let y = 0; y < frameSize; y++) for (let x = 0; x < frameSize; x++) if (data[(y * frameSize + x) * 4 + 3] > 48) {
      visible++; if (x < 2 || x >= frameSize - 2 || y < 2 || y >= frameSize - 2) edge++;
    }
    if (visible < 20 || edge) fail(`frame ${i}: empty or clipped`);
    hashes.push(createHash('sha256').update(data).digest('hex'));
    if (enemy) enemyContact.push({ input: await frame.clone().resize(100, 100).png().toBuffer(), left: i * 100, top: index * 112 });
  }
  if (new Set(hashes).size !== 16) fail('duplicate frame');
  otherAtlases.push({ id, path, frames: hashes.length, poseOrder: enemy ? ENEMY_POSES : undefined });
}
if (enemyContact.length) await sharp({ create: { width: 1600, height: ENEMIES.length * 112, channels: 4, background: '#142c38' } }).composite(enemyContact).png().toFile(`${output}/all-enemy-poses.png`);
if (contact.length) await sharp({ create: { width: 128 * ALLY_MOTION.frameCount, height: FORMS.length * 144 + 16, channels: 4, background: '#142c38' } }).composite(contact).png().toFile(`${output}/all-forms-poses.png`);
if (lineup.length) await sharp({ create: { width: 8 * 160, height: 368, channels: 4, background: '#142c38' } }).composite(lineup).png().toFile(`${output}/scale-lineup.png`);
writeFileSync(`${output}/motion-assets.json`, JSON.stringify({ passed: !errors.length, forms, otherAtlases, errors, contactSheetOrder: FORMS.map(f => f.id), poseOrder: ALLY_MOTION.poses }, null, 2));
console.log(JSON.stringify({ forms: forms.length, expected: FORMS.length, otherAtlases: otherAtlases.length, errors, passed: !errors.length }, null, 2));
if (errors.length) process.exitCode = 1;
