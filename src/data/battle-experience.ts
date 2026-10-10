import type { OperationProfile } from './progression';
import { REWORKED_TREES } from './reworked-skills';
import type { RunConfig } from '../sim/types';
import { distribute } from './tactical-encounters';

export type ExperienceMode = 'campaign' | 'hundred';
// The default is also the historical version-2 curve, including old hundred runs.
export const battleLevelCost = (level: number, mode: ExperienceMode = 'campaign') => (mode === 'hundred' ? 40 : 30) + (level - 1) * (mode === 'hundred' ? 8 : 5);
export const battleXpAt = (level: number, mode: ExperienceMode = 'campaign') => (level - 1) * (2 * (mode === 'hundred' ? 40 : 30) + (level - 2) * (mode === 'hundred' ? 8 : 5)) / 2;
export function battlePointCapacity(config: Pick<RunConfig, 'squadIds' | 'challengeId'>) {
  const nodes=REWORKED_TREES.filter(tree=>config.squadIds.includes(tree.ownerId as RunConfig['squadIds'][number])).flatMap(tree=>tree.nodes);
  const ordinary=nodes.filter(node=>node.kind!=='ultimate').length;
  const ultimates=config.challengeId==='no-skill'?0:Math.min(config.challengeId==='two-evolutions'?2:config.squadIds.length,nodes.filter(node=>node.kind==='ultimate').length);
  return ordinary+ultimates*2;
}


const profiles = new WeakMap<OperationProfile, OperationProfile>();
/** Keep the point budget and relative wave rewards while funding the rising level costs. */
export function progressiveExperienceProfile(base: OperationProfile): OperationProfile {
  const cached = profiles.get(base); if (cached) return cached;
  const rewards = distribute(battleXpAt(base.points + 1), [...base.waveXp, base.escortXp ?? 0]);
  const profile = { ...base, waveXp: rewards.slice(0, -1), escortXp: rewards.at(-1)! };
  profiles.set(base, profile); return profile;
}

const pacedProfiles = new WeakMap<OperationProfile, Map<string, OperationProfile>>();
/** Fund points along each mode's waves, without inflating early rewards to fund late levels. */
export function pacedExperienceProfile(base: OperationProfile, mode: ExperienceMode, capacity = base.points): OperationProfile {
  const points=Math.min(base.points,capacity),key=`${mode}:${points}`;
  let variants=pacedProfiles.get(base);if(!variants){variants=new Map();pacedProfiles.set(base,variants);}
  const cached=variants.get(key);if(cached)return cached;
  // Final-wave gains cannot be spent in the hundred-wave boss fight: fund the last allocation.
  const allocationWaves=mode==='hundred'?Math.max(1,base.waves.length-1):base.waves.length;
  let awarded=0;
  const waveXp=base.waves.map((_,index)=>{
    const progress=allocationWaves<=1?1:Math.min(1,index/(allocationWaves-1));
    const target=points===0?0:1+(points-1)*Math.pow(progress,mode==='hundred'?.95:1.05);
    const cumulative=Math.round(battleXpAt(target+1,mode)),reward=cumulative-awarded;awarded=cumulative;return reward;
  });
  const profile={...base,points,waveXp};variants.set(key,profile);return profile;
}

const steadyProfiles = new WeakMap<OperationProfile, Map<string, OperationProfile>>();
/** Version 4: keep one opening point, then advance equally through the remaining level costs. */
export function steadyExperienceProfile(base: OperationProfile, mode: ExperienceMode, capacity = base.points): OperationProfile {
  const points = Math.min(base.points, capacity), key = `${mode}:${points}`;
  let variants = steadyProfiles.get(base);
  if (!variants) { variants = new Map(); steadyProfiles.set(base, variants); }
  const cached = variants.get(key); if (cached) return cached;
  // The last hundred-wave reward must be available during the allocation before its boss.
  const allocationWaves = mode === 'hundred' ? Math.max(1, base.waves.length - 1) : base.waves.length;
  const intervals = allocationWaves - 1;
  let awarded = 0;
  const waveXp = base.waves.map((_, index) => {
    let cumulative = battleXpAt(points + 1, mode);
    if (points > 0 && intervals > 0) {
      // Use exact integer level boundaries, then fund the same fraction of the next level.
      // This tracks 30, 35, 40... XP costs instead of giving every wave a flat XP amount.
      const steps = (points - 1) * Math.min(index, intervals);
      const wholePoints = 1 + Math.floor(steps / intervals);
      cumulative = battleXpAt(wholePoints + 1, mode)
        + Math.floor(battleLevelCost(wholePoints + 1, mode) * (steps % intervals) / intervals);
    }
    const reward = cumulative - awarded; awarded = cumulative; return reward;
  });
  const profile = { ...base, points, waveXp };
  variants.set(key, profile); return profile;
}
