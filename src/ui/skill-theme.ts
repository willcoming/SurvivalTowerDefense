import { FORM_MAP } from '../data/forms';
import type { SkillOwner } from '../data/deep-trees';
import type { DamageType, FormId } from '../sim/types';

/** Atlas presentation colors are independent of combat element definitions. */
export const SKILL_THEME_COLORS: Record<DamageType, string> = {
  kinetic: '#b7d5f0', plasma: '#ff806b', arc: '#81d6ff', thermal: '#ffb45c', gravity: '#b68aff',
};

export function skillTheme(form?: FormId, owner: SkillOwner = 'common'): string {
  const resolved = form ?? (owner === 'common' ? undefined : `${owner}-original` as FormId);
  const color = resolved ? SKILL_THEME_COLORS[FORM_MAP[resolved].damageType] : '#81d6ff';
  return `--atlas-accent:${color};--atlas-gold:#f4d77e;--atlas-space:#07101d;--skill-accent:${color};--skill-bg:#07101d`;
}
