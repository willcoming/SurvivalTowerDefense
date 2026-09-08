import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../../src/storage/repository';
import { createFormationDraft, confirmFormation } from '../../src/ui/formation-draft';

describe('formation drafts', () => {
  it('keeps member, captain and outfit edits isolated until one confirmation', () => {
    const save = createDefaultSave(); save.collection.owned.push('C01-summer');
    const before = structuredClone(save), draft = createFormationDraft(save);
    draft.squadIds = ['C01', 'C03']; draft.captainId = 'C03'; draft.equipped.C01 = 'C01-summer';
    expect(save).toEqual(before);
    save.collection.tickets = 3; // Rewards obtained while a draft is retained must survive its commit.
    const committed = confirmFormation(save, draft);
    expect(committed.preferences.squadIds).toEqual(['C01', 'C03']);
    expect(committed.preferences.captainId).toBe('C03');
    expect(committed.collection.equipped.C01).toBe('C01-summer');
    expect(committed.collection.tickets).toBe(3);
    expect(save.preferences).toEqual(before.preferences);
  });
  it('rejects empty teams, invalid captains, locked outfits and challenge overflow', () => {
    const save = createDefaultSave(), draft = createFormationDraft(save);
    expect(() => confirmFormation(save, draft, 4)).toThrow();
    draft.squadIds = []; expect(() => confirmFormation(save, draft)).toThrow();
    draft.squadIds = ['C01']; expect(() => confirmFormation(save, draft)).toThrow();
    draft.captainId = 'C01'; draft.equipped.C01 = 'C01-summer';
    expect(() => confirmFormation(save, draft)).toThrow();
  });
});
