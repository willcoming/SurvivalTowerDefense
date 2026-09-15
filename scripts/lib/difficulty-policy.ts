import { MAIN_IDS, SIDE_IDS } from '../../src/data/campaign';
import { DEEP_NODES, DEEP_NODE_MAP } from '../../src/data/deep-trees';
import { STAGE_MAP } from '../../src/data/content';
import { commanderProgress, COMMANDER_MAX_XP } from '../../src/data/commander';
import { migrateCommander, commanderVictoryXp } from '../../src/storage/commander';
import { deepLegalNodes, deepNodeCost } from '../../src/sim/deep-tree';
import { command, createRun, restoreRun, stepRun } from '../../src/sim/engine';
import { operationProfile } from '../../src/data/progression';
import { shouldAutoCast } from '../../src/ui/auto-tactical';
import type { CharacterId, ChallengeId, RunConfig, RunState, StageId } from '../../src/sim/types';

export const POLICIES = {
  balanced: { name: '均衡爆破', squad: ['C02','C03','C04','C05','C06'], captain: 'C03', remove: 'C04' },
  chain: { name: '連鎖穿透', squad: ['C01','C02','C03','C05','C06'], captain: 'C02', remove: 'C06' },
  control: { name: '控場灼燒', squad: ['C01','C02','C03','C04','C05'], captain: 'C04', remove: 'C01' },
} as const;
export type PolicyId = keyof typeof POLICIES;
const route = (id: string): string[] => [...new Set([...(DEEP_NODE_MAP[id].parents.slice(0, 1).flatMap(route)), id])];

export function naturalCommander(stage: StageId, difficulty: 'easy'|'hard', challenge: ChallengeId = null) {
  if (difficulty === 'easy') return { level: 1, xp: 0, nodes: [] as string[] };
  const preceding = stage.startsWith('X') ? [...MAIN_IDS.slice(0, 3), ...SIDE_IDS.slice(0, SIDE_IDS.indexOf(stage))] : MAIN_IDS.slice(0, MAIN_IDS.indexOf(stage));
  const state = migrateCommander([...preceding, stage]);
  if (challenge) state.xp = Math.min(COMMANDER_MAX_XP, state.xp + commanderVictoryXp(stage, 'hard'));
  const level = commanderProgress(state).level;
  const nodes = ['TEAM/0','TEAM/1','TEAM/2','TEAM/3','TEAM/8','TEAM/9','TEAM/10','TEAM/11','TEAM/4','TEAM/5','TEAM/6','TEAM/7'].slice(0, level - 1);
  return { level, xp: state.xp, nodes };
}

export function difficultyPlan(policy: PolicyId, stage: StageId, challenge: ChallengeId = null, weak = false) {
  const p = POLICIES[policy];
  const remove = policy === 'chain' && stage === 'S09' ? 'C01' : p.remove;
  const squad = p.squad.filter(id => challenge !== 'four' || id !== remove) as CharacterId[];
  const shieldBoss = STAGE_MAP[stage].bossId === 'B02';
  const terminals = policy === 'balanced'
    ? ['C05-B/7', shieldBoss ? 'C02-A/9' : 'C03-B/8', shieldBoss ? 'C03-B/8' : 'C02-A/9']
    : policy === 'chain' ? ['C03-A/7', 'C02-A/9', 'C01-B/8']
    : ['C04-A/10', shieldBoss ? 'C03-B/8' : 'C05-A/8', shieldBoss ? 'C05-A/8' : 'C03-B/8'];
  // Heavy elites in S09 call for early splash plus piercing before chain investment.
  if (stage === 'S09' && policy !== 'control') terminals.splice(0, terminals.length, 'C05-B/7', 'C03-A/7', 'C02-A/9');
  if (stage === 'S10' && challenge === 'no-skill' && policy === 'control') terminals.splice(0, terminals.length, 'C04-A/10', 'C05-B/7', 'C03-A/7');
  if (stage === 'S12' && challenge === 'four' && policy === 'control') terminals.splice(0, terminals.length, 'C04-A/11', 'C05-A/8', 'C03-A/7');
  const chosen = (challenge === 'two-evolutions' ? terminals.slice(0, 2) : terminals).flatMap(route);
  const plan = weak ? [] : [...new Set(chosen)];
  // The comparison deliberately spreads points over entry nodes instead of finishing routes.
  const fillers = DEEP_NODES.filter(n => n.ownerId !== 'common' && squad.includes(n.ownerId) && n.kind !== 'ultimate');
  if (weak) fillers.sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id));
  for (const node of fillers) if (!plan.includes(node.id)) plan.push(node.id);
  return { squad, captain: p.captain as CharacterId, plan };
}

/** Observable captain-specific timing; never uses the seed or unspawned plan. */
export function shouldManualCast(s: RunState) {
  const enemies=s.enemies.filter(e=>e.hp>0),boss=enemies.find(e=>e.defId.startsWith('B'));
  const charge=enemies.some(e=>e.chargeKind&&!e.chargeCancelled&&e.chargeUntil-s.tick>0&&e.chargeUntil-s.tick<=18);
  const crowd=enemies.filter(e=>!e.defId.startsWith('B')&&e.y>300).length;
  const waited=s.tick-s.tacticalReadyAt;
  if(s.config.captainId==='C02')return charge||crowd>=4||waited>=300;
  if(s.config.captainId==='C03')return boss?(boss.exposureUntil>s.tick||boss.hp<500||boss.defId!=='B03'||waited>=240):(enemies.some(e=>e.maxHp>=300&&e.y>250)||waited>=180);
  if(s.config.captainId==='C04')return crowd>=3||enemies.some(e=>e.defId==='E08'&&(e.chargeKind==='rush'||e.rushUntil>s.tick))||waited>=240;
  return charge||crowd>=3||waited>=240;
}

export function simulateDifficulty(config: RunConfig, plan: string[], manual = false, checkRestore = false, legacyBalance = false, balanceVersion:1|2=2) {
  let s = createRun(config, undefined, legacyBalance?{legacyBalance:true}:{balanceVersion}), restored = false;
  const profile = operationProfile(s), waveHealth: number[] = [];
  let peakEnemies = s.enemies.length, peakProjectiles = 0, bossHealth: number | null = null, bossStartedAt = 0, minimumHealth = s.wallHp;
  for (let guard = 0; guard < profile.deadline * 30 + 1000 && !s.outcome; guard++) {
    if (s.draft) {
      const legal = deepLegalNodes(s);
      const id = plan.find(id => !s.treeNodes?.includes(id) && legal.includes(id) && deepNodeCost(id, s) <= s.draft!.pointTarget! - s.choicesSpent);
      if (!id || !command(s, { type: 'buy-node', offerId: s.draft.id, nodeId: id })) throw new Error(`Illegal policy ${config.stageId}: ${id}`);
      if (checkRestore && !restored && s.choicesSpent >= 4) { s = restoreRun(s); restored = true; }
      continue;
    }
    if (s.bossIntro) { bossHealth = s.wallHp / s.wallMaxHp; bossStartedAt = s.tick; command(s, { type: 'finish-boss-intro' }); continue; }
    if (shouldAutoCast(s, true)) {
      if (!manual || shouldManualCast(s)) command(s, { type: 'cast' });
    }
    stepRun(s);
    peakEnemies = Math.max(peakEnemies, s.enemies.length); peakProjectiles = Math.max(peakProjectiles, s.projectiles.length);
    minimumHealth = Math.min(minimumHealth, s.wallHp);
    const wave = Math.min(profile.waves.length, Math.floor(s.tick / (profile.interval * 30)) + 1);
    if (waveHealth.length < wave) waveHealth.push(s.wallHp / s.wallMaxHp);
  }
  return { outcome: s.outcome, hp: s.wallHp, hpRatio: s.wallHp / s.wallMaxHp, minimumHpRatio: minimumHealth / s.wallMaxHp, seconds: s.tick / 30,
    bossSeconds: bossStartedAt ? (s.tick - bossStartedAt) / 30 : null, bossEntryHpRatio: bossHealth, waveHealth, peakEnemies, peakProjectiles,
    points: s.choicesSpent, expectedPoints: profile.points, damage: s.stats.damageByCharacter, damageTaken: s.stats.wallDamageByEnemy, casts: s.stats.casts.length,
    restored, commanderNodes: config.commanderNodes ?? [], chosenNodes: s.treeNodes ?? [], operationVersion: s.operationVersion, balanceVersion: s.balanceVersion ?? 0 };
}
