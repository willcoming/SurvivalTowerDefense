import { CONTENT_VERSION, WORLD } from '../data/content';
import type { CharacterId, Enemy, RunState } from './types';

// Squad order remains cosmetic: every weapon measures coverage from the shared defense origin.
export const FIRING_ORIGIN = { x: WORLD.originX, y: WORLD.originY };
export const WEAPON_RANGE: Record<CharacterId, number> = { C01: 410, C02: 335, C03: 560, C04: 335, C05: 530, C06: 410 };
export const RANGE_LABEL: Record<CharacterId, string> = { C01: '中程', C02: '近程', C03: '遠程', C04: '近程', C05: '遠程', C06: '中程' };
export const usesRangeRules = (run: RunState) => run.contentVersion === CONTENT_VERSION;
export const weaponRange = (run: RunState, id: CharacterId) => usesRangeRules(run) ? WEAPON_RANGE[id] : Infinity;
export const inWeaponRange = (run: RunState, id: CharacterId, enemy: Enemy) => enemy.hp > 0 && Math.hypot(enemy.x - FIRING_ORIGIN.x, enemy.y - FIRING_ORIGIN.y) <= weaponRange(run, id) + enemy.radius;
