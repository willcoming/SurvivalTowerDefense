import { describe, expect, it } from 'vitest';
import { deepTreesFor, type DeepMods, type DeepNode } from '../../src/data/deep-trees';
import { CHARACTER_IDS } from '../../src/data/content';
import { FORMS } from '../../src/data/forms';
import { resolveSkillNode } from '../../src/data/reworked-skills';
import { skillEmblem, skillEmblemType } from '../../src/ui/skill-emblems';
import { skillTheme } from '../../src/ui/skill-theme';

const sample = (mods: DeepMods): DeepNode => ({
  id: 'C01-A4/0', treeId: 'C01-A4', ownerId: 'C01', name: '範例', description: '',
  kind: 'branch', parents: [], requires: 'any', layer: 0, lane: 0, mods,
});

describe('skill atlas semantic emblems', () => {
  it('distinguishes seven effects rather than sending unfamiliar modifiers to the blade', () => {
    const examples: [DeepMods, string][] = [
      [{ crowdDamage: .24 }, 'damage'], [{ pressureHaste: .16 }, 'haste'],
      [{ guardDamage: .24 }, 'pierce'], [{ exposureEvery: 3 }, 'crit'],
      [{ fieldExposure: .08 }, 'radius'], [{ autoShield: 55 }, 'shield'], [{ missiles: .35 }, 'split'],
    ];
    const glyphs = new Set<string>();
    for (const [mods, category] of examples) {
      const svg = skillEmblem(sample(mods));
      expect(skillEmblemType(sample(mods)).category).toBe(category);
      expect(svg).toContain(`data-emblem="${category}"`);
      glyphs.add(svg.replace(/data-emblem(?:-variant)?="[^"]+"/g, ''));
    }
    expect(glyphs.size).toBe(7);
  });

  it('uses offensive armor and shield modifiers for piercing, and actual protection for shields', () => {
    for (const mods of [{ shield: .35 }, { armor: .15 }, { armorBreak: .08 }, { burnArmor: .2 }]) {
      expect(skillEmblemType(sample(mods)).category).toBe('pierce');
    }
    for (const mods of [{ shieldCapacity: 50 }, { shieldInterval: 15 }, { shieldReflect: .12 }, { emergencyShield: 100 }]) {
      expect(skillEmblemType(sample(mods)).category).toBe('shield');
    }
  });

  it('keeps conditional names meaningful when small range bonuses or summer secondary conditions exist', () => {
    expect(skillEmblemType(sample({ guardDamage: .24, range: 15 })).category).toBe('pierce');
    expect(skillEmblemType(sample({ markedHaste: .16, range: 15 })).category).toBe('haste');
    expect(skillEmblemType(sample({ freshDamage: .12, pressureHaste: .08, range: 15 })).variant).toBe('first-strike');
    expect(skillEmblemType(sample({ pressureHaste: .08, freshDamage: .12, range: 15 })).category).toBe('haste');
    expect(skillEmblemType(sample({ cooling: .25, guardDamage: .12 })).variant).toBe('vent');
  });

  it('renders every real original and summer node, with sixteen distinct ultimate crests', () => {
    const crests = new Set<string>();
    for (const form of FORMS) {
      const nodes = deepTreesFor(form.ownerId).flatMap(tree => tree.nodes);
      expect(nodes).toHaveLength(24);
      for (const base of nodes) {
        const node = resolveSkillNode(base, form.id), svg = skillEmblem(node, form.id);
        expect(svg).not.toContain('undefined');
        expect(svg).toContain('<path');
        if (node.kind === 'ultimate') {
          expect(svg).toContain(`data-emblem-variant="${form.id}"`);
          crests.add(svg.replace(/data-emblem-variant="[^"]+"/, ''));
        }
      }
    }
    expect(crests.size).toBe(16);
  });

  it('uses form-specific atlas colors without changing the content palette', () => {
    for (const owner of CHARACTER_IDS) {
      expect(skillTheme(undefined, owner)).toBe(skillTheme(`${owner}-original`, owner));
      expect(skillTheme(`${owner}-summer`, owner)).not.toBe(skillTheme(`${owner}-original`, owner));
    }
    expect(skillTheme('C02-original')).toContain('--atlas-accent:#81d6ff');
    expect(skillTheme('C04-original')).toContain('--atlas-accent:#b68aff');
  });
});
