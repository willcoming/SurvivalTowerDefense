import { describe, expect, it } from 'vitest';
import { buildTime } from '../../src/build-version';

describe('visible release time', () => {
  it('uses Taiwan time with seconds, including the date rollover', () => {
    expect(buildTime('2026-09-24T17:02:03.000Z')).toBe('2026-09-25 01:02:03');
    expect(buildTime('')).toBe('本地開發版本');
    expect(buildTime('invalid')).toBe('本地開發版本');
  });
});
