import type { SkillOwner } from '../data/deep-trees';
import type { CharacterId, StageId, ChallengeId } from '../sim/types';
import type { RosterPanel } from './roster';
import type { CommandPanel } from './command-panel';
export type Page = 'home' | 'intel' | 'roster' | 'codex' | 'stories' | 'settings' | 'battle' | 'result' | 'recruitment' | 'command' | 'commander';
export interface ViewModel {
  page: Page; stageId: StageId; characterId: CharacterId; challengeId: ChallengeId;
  retrySeed: number | null; selectedCard: string | null; modal: 'pause' | 'tutorial' | 'abandon' | 'reset' | null;
  treePanel?: { ownerId: SkillOwner; treeId: string; nodeId: string | null; mode: 'choose' | 'view' };
  personnelSkills?: import('./personnel-skills').PersonnelSkills;
  rosterPanel?: RosterPanel;
  rosterEditing?: boolean;
  rosterSelectedId?: CharacterId;
  commandPanel?: CommandPanel;
  commandView?: import('./tactical-command').TacticalView;
  rewardPreview?: {tier:number;x:number;y:number};
  recruitView?: import('./recruitment').RecruitView;
  recruitPreview?: import('../sim/types').FormId;
  navigationTarget?: Page;
  saveStatus: string; message: string; showBuild: boolean;
}
