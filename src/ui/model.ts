import type { SkillOwner } from '../data/deep-trees';
import type { CharacterId, StageId, ChallengeId } from '../sim/types';
export type Page = 'home' | 'intel' | 'roster' | 'codex' | 'stories' | 'settings' | 'battle' | 'result' | 'recruitment';
export interface ViewModel {
  page: Page; stageId: StageId; characterId: CharacterId; challengeId: ChallengeId;
  retrySeed: number | null; selectedCard: string | null; modal: 'pause' | 'tutorial' | 'abandon' | 'reset' | null;
  treePanel?: { ownerId: SkillOwner; treeId: string; nodeId: string | null; mode: 'choose' | 'view' };
  codexNode?: string;
  saveStatus: string; message: string; showBuild: boolean;
}
