export type CharacterId = 'C01' | 'C02' | 'C03' | 'C04' | 'C05' | 'C06';
export type StageId = 'S01' | 'S02' | 'S03';
export type EnemyId = 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07' | 'E08' | 'B01' | 'B02' | 'B03';
export type Branch = 'A' | 'B';
export type DamageType = 'plasma' | 'arc' | 'kinetic' | 'gravity' | 'thermal';
export type ChallengeId = 'four' | 'no-skill' | 'two-evolutions' | null;
export type PauseReason = 'user' | 'upgrade' | 'hidden' | 'orientation' | 'tutorial' | 'error' | 'boss-intro' | 'tree';
export interface RunConfig {
  stageId: StageId; squadIds: CharacterId[]; captainId: CharacterId;
  preferredBranches?: Partial<Record<CharacterId, Branch>>; seed: number; challengeId?: ChallengeId;
}
export interface CharacterDef {
  id: CharacterId; name: string; english: string; age: number; role: string; color: string;
  description: string; weaponName: string; damage: number; interval: number; damageType: DamageType;
  passive: string; tacticalName: string; tacticalDescription: string; cooldown: number;
}
export interface RouteDef {
  id: string; ownerId: CharacterId; branch: Branch; name: string; tags: string[];
  nodes: [string, string, string]; tradeoff: string;
}
export interface CommonDef { id: string; name: string; description: string; max: number }
export interface EnemyDef {
  id: EnemyId; name: string; hp: number; shield: number; armor: number; speed: number;
  damage: number; interval: number; radius: number; color: string; mechanic: string; counter: string;
}
export interface StageDef {
  id: StageId; name: string; subtitle: string; description: string; hpMultiplier: number;
  bossId: EnemyId; waves: string[]; enemyIds: EnemyId[]; color: string;
  intro: string[]; outro: string[];
}
export interface UpgradeCard { nodeId: string; kind: 'random' | 'focus' | 'evolution' | 'empty' }
export interface DraftOffer { id: number; choice: number; cards: UpgradeCard[]; focusId: CharacterId; selectedEvolution: string | null; customNodeId?: string; pointTarget?: number }
export interface Effect {
  id: string; kind: 'slow' | 'stun' | 'exposure' | 'burn'; source: CharacterId | 'boss';
  expires: number; value: number; armorIgnore: number; nextTick: number;
}
export interface Enemy {
  id: number; defId: EnemyId; x: number; y: number; hp: number; maxHp: number;
  shield: number; armor: number; speed: number; radius: number; xp: number; wave: number;
  spawnedAt: number; effects: Effect[]; attackAt: number; abilityAt: number; summonAt: number;
  chargeUntil: number; chargeKind: 'shot' | 'rush' | 'boss' | null; chargeCancelled: boolean;
  phaseTriggered: boolean; rushUntil: number; stunImmuneUntil: number; moveImmuneUntil: number;
  exposureUntil: number; summonCount: number; arcCharges: number;
  /** Optional presentation cue. Never used to calculate damage, movement or cooldowns. */
  armorBroken?: { value: number; expires: number };
  lastAction?: { tick: number; kind: 'melee' | 'shot' | 'blast' | 'burst' | 'rush' | 'summon' | 'repair' | 'shield' };
}
export interface DamagePacket {
  source: CharacterId; skill: string; raw: number; damageType: DamageType;
  armorIgnore: number; shieldMultiplier: number; exposureBonus?: number; exposure?: { value: number; duration: number };
  armorBreak?: number; executeDamage?: number; executeThreshold?: number; controlledBonus?: number; secondary?: boolean;
  burn?: { dps: number; duration: number; armorIgnore: number; key: string };
  slow?: { value: number; duration: number }; stun?: number; knockback?: number;
}
export interface Projectile {
  id: number; x: number; y: number; tx: number; ty: number; vx: number; vy: number;
  expires: number; hitIds: number[]; remaining: number; falloff: number[];
  radius: number; blastRadius: number; packet: DamagePacket | null;
  enemyDamage: number; enemySource: EnemyId | null; impactAt: number;
  travelRemaining?: number;
  echo?: { count: number; damage: number; radius: number };
  fire?: { radius: number; dps: number; duration: number; burnDuration: number; armorIgnore: number };
}
export interface Field {
  id: number; source: CharacterId; kind: 'gravity' | 'fire'; x: number; y: number;
  radius: number; expires: number; nextTick: number; dps: number; damageType: DamageType;
  slow: number; slowDuration: number; pull: number; burnDuration: number; armorIgnore: number; exposure?: number;
}
export interface Shield { source: string; value: number; expires: number }
export interface WeaponState {
  id: CharacterId; branch: Branch | null; rank: number; readyAt: number;
  nextAttack: number; attacks: number; droneAttacks: [number, number]; shieldAt: number;
}
export interface SpawnEntry { at: number; defId: EnemyId; x: number; xp: number; wave: number }
export interface ScheduledHit { at: number; packet: DamagePacket | null; x: number; y: number; radius: number; enemyDamage: number; enemySource: EnemyId | null }
export interface VisualEvent {
  seq: number; tick: number; kind: 'shot' | 'beam' | 'arc' | 'explosion' | 'hit' | 'death' | 'shield' | 'evolution' | 'tactical' | 'wall-hit' | 'spawn' | 'interrupt';
  x: number; y: number; x2?: number; y2?: number; radius?: number; value?: number; source?: CharacterId; color?: string;
  affectedIds?: number[];
  weaponTree?: string; targetId?: number; enemyDefId?: EnemyId; skill?: string; weaponRank?: number; weaponBranch?: Branch | null;
}
export interface ActionRecord { tick: number; seq: number; command: Command }
export interface RunStats {
  kills: number; damageByCharacter: Record<CharacterId, number>; shieldDamageByCharacter: Record<CharacterId, number>;
  wallDamageByEnemy: Record<string, number>; shieldAbsorbed: number; controlTicks: Record<CharacterId, number>;
  choices: { tick: number; nodeId: string }[]; casts: number[]; encountered: EnemyId[];
}
export interface WaveBrief { wave: number; variant: 'standard' | 'fast' | 'armored' | 'shielded'; event: 'none' | 'ion' | 'heat' | 'gravity' }
export interface SupportState { repairAt:number; pulseAt:number; emergencyAt:number; repulseAt:number; damageTaken:number; secondWindUsed:number; repaired:number; prevented:number; reflected:number }
export interface RunState {
  schemaVersion: number; contentVersion: string; runId: string; config: RunConfig;
  tick: number; phase: 'running' | 'choosing' | 'paused' | 'ended'; pauseReasons: PauseReason[];
  wallHp: number; wallMaxHp: number; shields: Shield[]; xp: number; choicesEarned: number; choicesSpent: number;
  rerollsRemaining: number; evolvedCount: number; evolutionLimit: number; tacticalReadyAt: number;
  treeNodes?: string[];
  wavePlan?: WaveBrief[]; support?: SupportState; upgradePendingAt?: number;
  weapons: WeaponState[]; commonRanks: Record<string, number>; preferredBranches: Record<CharacterId, Branch>;
  enemies: Enemy[]; projectiles: Projectile[]; fields: Field[]; scheduled: ScheduledHit[];
  spawnPlan: SpawnEntry[]; spawnCursor: number; bossSpawned: boolean; bossKilled: boolean;
  bossIntro?: { enemyId: number; remainingMs: number };
  rng: { spawn: number; draft: number; visual: number }; nextEntityId: number;
  draft: DraftOffer | null; nextOfferId: number; events: VisualEvent[]; eventSeq: number;
  actions: ActionRecord[]; actionSeq: number; stats: RunStats;
  outcome: 'victory' | 'wall' | 'timeout' | 'abandoned' | null;
}
export type Command =
  | { type: 'cast' }
  | { type: 'buy-node'; offerId: number; nodeId: string }
  | { type: 'finish-boss-intro' }
  | { type: 'pause'; reason: PauseReason }
  | { type: 'resume'; reason: PauseReason }
  | { type: 'choose'; offerId: number; nodeId: string }
  | { type: 'reroll'; offerId: number }
  | { type: 'focus'; characterId: CharacterId; branch?: Branch }
  | { type: 'evolution'; nodeId: string }
  | { type: 'custom-node'; nodeId: string }
  | { type: 'abandon' };
