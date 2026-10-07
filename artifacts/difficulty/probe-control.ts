import {DEEP_NODE_MAP} from '../../src/data/deep-trees';
import {difficultyPlan,naturalCommander,simulateDifficulty} from '../../scripts/lib/difficulty-policy';
import type {CharacterId,StageId,ChallengeId} from '../../src/sim/types';
const route=(id:string):string[]=>[...new Set([...DEEP_NODE_MAP[id].parents.slice(0,1).flatMap(route),id])];
for(const stage of ['S10'] as StageId[])for(const terminals of [['C04-A/11','C05-A/8','C03-B/8'],['C04-A/10','C05-B/7','C03-A/7'],['C04-A/10','C03-A/7','C05-A/8'],['C04-A/11','C03-A/7','C05-A/8']]) {
 const base=difficultyPlan('control',stage);
 const squad=['C02','C03','C04','C05'] as CharacterId[],captain='C04';
 const plan=[...new Set([...terminals.flatMap(route),...base.plan])];
 for(const challenge of ['four'] as ChallengeId[]) {
 const rows=[101,211,307,419,521].map(seed=>simulateDifficulty({stageId:stage,difficulty:'hard',challengeId:challenge,squadIds:challenge==='four'?squad:base.squad,captainId:captain,seed,commanderNodes:naturalCommander(stage,'hard',challenge).nodes},plan));
 console.log(JSON.stringify({stage,challenge,terminals,wins:rows.filter(r=>r.outcome==='victory').length,hp:rows.map(r=>Math.round(r.hpRatio*100))}));
 }
}
