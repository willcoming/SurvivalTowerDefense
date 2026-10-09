import type { DeepMods, DeepNode } from '../data/deep-trees';
import type { FormId } from '../sim/types';

export type SkillEmblemCategory = 'damage' | 'haste' | 'pierce' | 'crit' | 'radius' | 'shield' | 'split' | 'ultimate';
export interface SkillEmblemKind { category: SkillEmblemCategory; variant: string }
type ModKey = keyof DeepMods;
const has = (mods: DeepMods, keys: readonly ModKey[]) => keys.some(key => mods[key] !== undefined && mods[key] !== 0);
const defense: ModKey[] = ['autoShield', 'shieldCapacity', 'skillShield', 'shieldInterval', 'shieldDuration', 'pulseShield', 'emergencyShield', 'shieldReflect', 'wallHealth', 'wallReduction', 'periodicRepair', 'repairBonus', 'emergencyRepair', 'secondWind', 'killRepair'];
const split: ModKey[] = ['targets', 'secondaryPower', 'salvoEvery', 'salvoShots', 'missiles', 'missileEvery', 'drones', 'dronePower', 'jumps', 'jumpRange', 'jumpPower', 'chainReturn', 'chainBurst', 'blastEcho', 'echoCount', 'fireSpread', 'mineCap'];
const pierce: ModKey[] = ['armor', 'armorBreak', 'burnArmor', 'pierce', 'linePower', 'shield'];
const crit: ModKey[] = ['critEvery', 'critPower', 'exposureEvery', 'exposureValue', 'exposureSeconds', 'exposureDamage', 'teamExposeDamage', 'teamMarkEvery', 'teamMarkValue', 'markSpread', 'executeDamage', 'executeThreshold', 'mainDamage', 'eliteDamage'];
const radius: ModKey[] = ['radius', 'skillRadius', 'fieldRadius', 'fieldDamage', 'fieldDuration', 'fieldExposure', 'pull', 'knockback', 'knockEvery', 'collision', 'lineShock', 'burstRadius', 'burstStun', 'slow', 'stunEvery', 'stunSeconds', 'controlledDamage', 'teamControlDamage', 'duration', 'mineTrigger', 'emergencyRepulse'];
const cooling: ModKey[] = ['cooling', 'heatCost', 'ventHaste', 'ventDuration'];
const haste: ModKey[] = ['haste', 'teamHaste', 'shieldHaste', 'skillCooldown', 'mineArm'];
const conditional: Partial<Record<ModKey, SkillEmblemKind>> = {
  crowdDamage: { category: 'damage', variant: 'crowd' },
  isolatedDamage: { category: 'damage', variant: 'blade' },
  guardDamage: { category: 'pierce', variant: 'pierce' },
  freshDamage: { category: 'damage', variant: 'first-strike' },
  markedHaste: { category: 'haste', variant: 'lightning' },
  pressureHaste: { category: 'haste', variant: 'lightning' },
};

/** Mechanisms outrank secondary range/damage; the named conditional is authored first. */
export function skillEmblemType(node: DeepNode, form?: FormId): SkillEmblemKind {
  const mods = node.mods;
  if (node.kind === 'ultimate') return { category: 'ultimate', variant: form ?? `${node.ownerId}-original` };
  if (has(mods, defense)) return { category: 'shield', variant: 'shield' };
  if (has(mods, split)) return { category: 'split', variant: has(mods, ['missiles', 'missileEvery']) ? 'missiles' : 'split' };
  // `shield` and `armor` are offensive shield damage / armor ignore, not defense.
  if (has(mods, pierce)) return { category: 'pierce', variant: 'pierce' };
  if (has(mods, crit)) return { category: 'crit', variant: 'scope' };
  if (has(mods, radius)) return { category: 'radius', variant: has(mods, ['pull', 'fieldRadius', 'fieldDamage', 'fieldExposure']) ? 'vortex' : 'ring' };
  if (has(mods, cooling)) return { category: 'haste', variant: 'vent' };
  if (has(mods, haste)) return { category: 'haste', variant: 'lightning' };
  for (const key of Object.keys(mods) as ModKey[]) {
    if (mods[key] && conditional[key]) return conditional[key]!;
  }
  if (has(mods, ['damage', 'skillDamage', 'burn', 'fireDamage', 'heatBonus', 'mineCharge', 'mineChargeCap', 'burstDamage'])) return { category: 'damage', variant: 'blade' };
  if (mods.range) return { category: 'crit', variant: 'scope' };
  return { category: 'damage', variant: 'blade' };
}

const ORDINARY: Record<string, string> = {
  blade: '<path d="m8 25 15-19 5-3-2 6-15 18Z"/><path d="m5 20 9 7M5 29l5-6m8-11 4 3"/>',
  crowd: '<path d="m13 24 3-19 3 19-3 4Z"/><path d="m7 22-2-12 5 3 1 11m14-2 2-12-5 3-1 11M11 22h10"/>',
  'first-strike': '<path d="m7 25 15-18 5-3-2 6-15 18Z"/><path d="m5 21 8 6M5 29l4-5M9 5v6m-3-3h6m13 12 4 4m-1-10h3"/>',
  lightning: '<path d="m19 3-13 16h9l-2 10 13-17h-9Z"/>',
  vent: '<path d="M5 9h15c6 0 6-6 1-6m-16 13h20c6 0 6 8 1 8M5 23h10c6 0 6 6 1 6M4 5v22"/><path d="m8 5 3 4-3 4m4-1 3 4-3 4m-4-1 3 4-3 4"/>',
  pierce: '<path d="m16 3 6 10-6-3-6 3Zm0 7v19M9 14l-5 4 6 6m13-10 5 4-6 6M8 17l4 3m12-3-4 3"/>',
  scope: '<circle cx="16" cy="16" r="9"/><path d="m16 11 2 3 3 2-3 2-2 3-2-3-3-2 3-2ZM16 2v6m0 16v6M2 16h6m16 0h6"/>',
  ring: '<circle cx="16" cy="16" r="3"/><circle cx="16" cy="16" r="8"/><path d="M11 3a14 14 0 0 1 18 18M21 29A14 14 0 0 1 3 11m8-8H6m23 18v5M21 29h5M3 11V6"/>',
  vortex: '<circle cx="16" cy="16" r="3"/><path d="M16 3c11 0 15 13 6 19M3 16C3 5 16 1 22 10m-6 19C5 29 1 16 10 10m19 6c0 11-13 15-19 6"/>',
  shield: '<path d="m16 3 11 5v9c0 5-7 10-11 12C12 27 5 22 5 17V8Z"/><path d="m16 8 6 3v6c0 3-3 6-6 8-3-2-6-5-6-8v-6Zm0 4v9m-4-5h8"/>',
  split: '<path d="M16 29V17M16 17 5 6m11 11L27 6M16 17V3M3 12V4h8m10 0h8v8M12 7l4-4 4 4"/>',
  missiles: '<path d="M7 21V10l4-7 4 7v11Zm10 4V14l4-7 4 7v11ZM4 21l3-6m8 6-3-6m2 10 3-6m8 6-3-6M9 25v4m4-4v3m6 0v3m4-3v3"/><path d="M7 11h8m2 4h8"/>',
};

/** Small authored vector crests keep every character/form distinct without image assets. */
const ULTIMATE: Record<FormId, string> = {
  'C01-original': '<path d="m16 2 2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM16 18v12M10 17 4 27m18-10 6 10M12 26l4 4 4-4M3 22l1 5 5-2m14 0 5 2 1-5"/>',
  'C01-summer': '<path d="M17 3c-2 7 7 7 6 13-1 7-13 7-14 0-1-4 3-7 5-9-1 5 2 5 3 3ZM3 24c5-5 8 5 13 0s8 5 13 0M3 29c5-5 8 5 13 0s8 5 13 0"/>',
  'C02-original': '<path d="m17 4-6 11h6l-2 10 8-13h-6ZM11 10 5 7m16 14 5 4M8 23l-3 3"/><circle cx="4" cy="6" r="3"/><circle cx="28" cy="27" r="3"/><circle cx="4" cy="28" r="3"/>',
  'C02-summer': '<path d="m18 7-8 11h7l-2 8 8-12h-7ZM9 3a14 14 0 0 1 20 18M3 11a14 14 0 0 0 18 18M9 8a10 10 0 0 0-3 14M23 9a10 10 0 0 1 3 14"/>',
  'C03-original': '<path d="m16 2 5 10-5-3-5 3Zm0 7v21M11 8 3 16l8 8m10-16 8 8-8 8M7 14l4 2-4 2m18-4-4 2 4 2"/>',
  'C03-summer': '<ellipse cx="16" cy="16" rx="14" ry="7" transform="rotate(-35 16 16)"/><circle cx="16" cy="16" r="8"/><path d="M16 2v9m0 10v9M2 16h9m10 0h9m-5-15 2 2-2 2-2-2Z"/>',
  'C04-original': '<circle cx="16" cy="16" r="3"/><path d="M16 2c13 0 16 17 3 19M2 16C2 3 19 0 21 13m-5 17C3 30 0 13 13 11m17 5c0 13-17 16-19 3"/>',
  'C04-summer': '<path d="m16 3 11 6v14l-11 6-11-6V9Zm0 0v26M5 9l22 14M27 9 5 23M1 12l5 3-4 3m29-6-5 3 4 3M12 1l4 5 4-5m-8 30 4-5 4 5"/>',
  'C05-original': '<path d="m23 2-8 13m13-9-8 13M18 2l-6 10M29 11l-6 10"/><path d="m12 12 4 5 7 1-5 5-1 7-5-5-7 1 2-7-4-5Z"/><circle cx="13" cy="20" r="3"/>',
  'C05-summer': '<path d="m8 6 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm16-4 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm-5 16 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>',
  'C06-original': '<path d="m16 3 12 5v9c0 5-7 10-12 13C11 27 4 22 4 17V8Zm0 6 7 7-7 9-7-9Zm0 0v16m-7-9h14"/>',
  'C06-summer': '<path d="m16 3 11 5v9c0 5-7 10-11 12C12 27 5 22 5 17V8Z"/><path d="m2 12 10 5-6 6m24-11-10 5 6 6M7 12l5 5-6 1m19-6-5 5 6 1M16 10v12"/>',
  'C07-original': '<path d="m16 5 11 21H5Z"/><circle cx="16" cy="5" r="3"/><circle cx="5" cy="26" r="3"/><circle cx="27" cy="26" r="3"/><path d="m16 13 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/>',
  'C07-summer': '<path d="m16 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM3 22c5-6 8 6 13 0s8 6 13 0M3 28c5-6 8 6 13 0s8 6 13 0"/><path d="M7 7 4 4m21 3 3-3M5 15H2m25 0h3"/>',
  'C08-original': '<path d="M8 15a8 8 0 0 1 16 0M16 1v4M5 5l3 3m19-3-3 3M1 15h4m22 0h4M7 21h18m-18 5h18M11 18v11m5-11v11m5-11v11"/>',
  'C08-summer': '<path d="M3 10h15c7 0 7-7 2-7M3 16h22c7 0 7 8 2 8M3 23h9c6 0 6 6 1 6m10-17-7 9h6l-2 8 9-12h-6Z"/>',
};

export function skillEmblem(node: DeepNode, form?: FormId): string {
  const { category, variant } = skillEmblemType(node, form);
  const paths = category === 'ultimate' ? ULTIMATE[variant as FormId] ?? ORDINARY.scope : ORDINARY[variant];
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" data-emblem="${category}" data-emblem-variant="${variant}" aria-hidden="true">${paths}</svg>`;
}
