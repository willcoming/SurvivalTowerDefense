import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetUrl } from '../../src/assets';
import { FORMS, formMotion, formPortrait } from '../../src/data/forms';
import { MAIN_IDS, SIDE_IDS, stageArt } from '../../src/data/campaign';
import { cardInfo } from '../../src/ui/format';

afterEach(() => vi.unstubAllEnvs());
describe('deployment artwork paths', () => {
  for (const base of ['/', '/SurvivalTowerDefense/']) it(`keeps all forms, chapters and weapon icons under ${base}`, () => {
    vi.stubEnv('BASE_URL', base);
    expect(assetUrl('weapons/C01.webp')).toBe(`${base}assets/weapons/C01.webp`);
    for (const form of FORMS) {
      expect(formPortrait(form.id)).toMatch(new RegExp(`^${base}assets/`));
      expect(formMotion(form.id)).toMatch(new RegExp(`^${base}assets/`));
    }
    for (const stage of [...MAIN_IDS, ...SIDE_IDS]) expect(stageArt(stage)).toMatch(new RegExp(`^${base}assets/(stages|campaign)/`));
    for (const owner of ['C01', 'C07', 'C08']) expect(cardInfo(`${owner}-A/0`).icon).toMatch(new RegExp(`^${base}assets/`));
    expect(formPortrait('C07-summer')).toBe(`${base}assets/forms/C07-summer-pose-v4.webp`);
    expect(formPortrait('C08-summer')).toBe(`${base}assets/forms/C08-summer-pose-v4.webp`);
  });
});
