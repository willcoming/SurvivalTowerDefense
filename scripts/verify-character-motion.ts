import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { FORMS, formMotion, formPortrait } from '../src/data/forms';
import { ALLY_MOTION, ALLY_ATTACKS } from '../src/data/character-motion';

const sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE || 'sharp') as typeof import('sharp').default;
const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8'));
const errors: string[] = [], forms = [], contact = [];
const output = process.env.VALIDATION_OUTPUT_DIR || 'artifacts/validation/form-motion';
mkdirSync(output, { recursive: true });
for (const [index, form] of FORMS.entries()) {
  const url = formMotion(form.id), path = `public${url}`, entry = manifest.find((a: {path: string}) => a.path === url);
  const fail = (message: string) => errors.push(`${form.id}: ${message}`);
  if (url === formPortrait(form.id) || !url.startsWith('/assets/animations/')) fail('portrait used as combat motion');
  if (!existsSync(path)) { fail('missing sheet'); continue; }
  const bytes = readFileSync(path), meta = await sharp(bytes).metadata();
  if (meta.width !== 768 || meta.height !== 512 || !meta.hasAlpha) fail('sheet must be 768x512 with alpha');
  if (!entry || entry.sha256 !== createHash('sha256').update(bytes).digest('hex') || entry.bytes !== bytes.length) fail('manifest hash/size mismatch');
  if (entry?.frameCount !== ALLY_MOTION.frameCount || entry?.frameWidth !== 256 || entry?.frameHeight !== 256 || entry?.origin?.x !== .5 || entry?.origin?.y !== 240 / 256) fail('frame/origin contract mismatch');
  const hashes = [], bounds = [];
  for (let i = 0; i < 6; i++) {
    const frame = sharp(bytes).extract({ left: i % 3 * 256, top: Math.floor(i / 3) * 256, width: 256, height: 256 });
    const { data } = await frame.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let pixels = 0, edge = 0, magenta = 0, bottom = 0;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const at = (y * 256 + x) * 4;
      if (data[at + 3] < 32) continue;
      pixels++; bottom = Math.max(bottom, y);
      if (x < 3 || x > 252 || y < 3 || y > 252) edge++;
      if (data[at] > 195 && data[at + 2] > 195 && data[at + 1] < 85) magenta++;
    }
    // Small antialiased edge fringes are distinct from an opaque key background.
    if (pixels < 1500 || pixels > 58000 || edge || magenta / pixels > .005) fail(`frame ${i}: empty, clipped or incomplete key`);
    if (bottom < 237 || bottom > 242) fail(`frame ${i}: feet baseline ${bottom}`);
    hashes.push(createHash('sha256').update(data).digest('hex'));
    bounds.push({ pixels, bottom, edge, magenta });
    contact.push({ input: await frame.clone().resize(128, 128).png().toBuffer(), left: i * 128, top: index * 144 + 16 });
  }
  if (new Set(hashes).size !== 6 || new Set(entry?.frames?.map((f: {sha256:string}) => f.sha256)).size !== 6) fail('six distinct poses required');
  forms.push({ id: form.id, path, bytes: bytes.length, action: ALLY_ATTACKS[form.ownerId].action, bounds });
}
if (contact.length) await sharp({ create: { width: 768, height: FORMS.length * 144 + 16, channels: 4, background: '#142c38' } }).composite(contact).png().toFile(`${output}/all-forms-poses.png`);
writeFileSync(`${output}/motion-assets.json`, JSON.stringify({ passed: !errors.length, forms, errors, contactSheetOrder: FORMS.map(f => f.id), poseOrder: ALLY_MOTION.poses }, null, 2));
console.log(JSON.stringify({ forms: forms.length, expected: FORMS.length, errors, passed: !errors.length }, null, 2));
if (errors.length) process.exitCode = 1;
