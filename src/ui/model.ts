import type { CharacterId, StageId, ChallengeId } from '../sim/types';
export type Page = 'home' | 'intel' | 'roster' | 'codex' | 'stories' | 'settings' | 'battle' | 'result';
export interface ViewModel {
  page: Page; stageId: StageId; characterId: CharacterId; challengeId: ChallengeId;
  retrySeed: number | null; selectedCard: string | null; modal: 'pause' | 'tutorial' | 'abandon' | 'reset' | null;
  saveStatus: string; message: string; showBuild: boolean;
}
