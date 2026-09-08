import type { GameSave } from '../storage/repository';
import { validateCollection, validateRoster, ownedForm } from '../storage/collection';

/** A formation draft contains only editable team data, never rewards or battle state. */
export type FormationDraft = Pick<GameSave['preferences'], 'squadIds' | 'captainId' | 'branches'> & {
  equipped: GameSave['collection']['equipped'];
};
export function createFormationDraft(save: GameSave): FormationDraft {
  return structuredClone({ squadIds: save.preferences.squadIds, captainId: save.preferences.captainId,
    branches: save.preferences.branches, equipped: save.collection.equipped });
}
export function formationView(save: GameSave, draft: FormationDraft): GameSave {
  return { ...save, preferences: { ...save.preferences, squadIds: draft.squadIds, captainId: draft.captainId, branches: draft.branches },
    collection: { ...save.collection, equipped: draft.equipped } };
}
export function confirmFormation(save: GameSave, draft: FormationDraft, max = 5): GameSave {
  const candidate = structuredClone(formationView(save, draft));
  const ids = candidate.preferences.squadIds;
  if (!ids.length || ids.length > max || new Set(ids).size !== ids.length) throw new Error(`請配置 1–${max} 位不同隊員`);
  if (!ids.includes(candidate.preferences.captainId)) throw new Error('請從出戰隊員中任命隊長');
  validateCollection(candidate.collection);
  validateRoster(candidate.collection, { stageId: 'S01', seed: 1, squadIds: candidate.preferences.squadIds, captainId: candidate.preferences.captainId, forms: Object.fromEntries(candidate.preferences.squadIds.map(id => [id, ownedForm(candidate.collection, id)])) });
  return candidate;
}
