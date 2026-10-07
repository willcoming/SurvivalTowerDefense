import{writeFileSync}from'node:fs';import{DEEP_NODE_MAP}from'../../src/data/deep-trees';import{difficultyPlan,naturalCommander,simulateDifficulty}from'../../scripts/lib/difficulty-policy';import type{StageId,ChallengeId}from'../../src/sim/types';
const path=(id:string):string[]=>[...new Set([...DEEP_NODE_MAP[id].parents.slice(0,1).flatMap(path),id])];const rows=[];
for(const [stage,challenge]of [['S10','no-skill'],['S12','four']]as[StageId,ChallengeId][])for(const terminals of [['C04-A/10','C03-A/7','C05-A/8'],['C04-A/10','C05-B/7','C03-A/7'],['C04-B/7','C05-B/7','C03-A/7'],['C04-A/11','C05-A/8','C03-A/7']]){
 const base=difficultyPlan('control',stage,challenge),plan=[...new Set([...terminals.flatMap(path),...base.plan])];
 const results=[101,211,307].map(seed=>simulateDifficulty({stageId:stage,difficulty:'hard',challengeId:challenge,squadIds:base.squad,captainId:base.captain,seed,commanderNodes:naturalCommander(stage,'hard',challenge).nodes},plan));
 const row={stage,challenge,terminals,wins:results.filter(r=>r.outcome==='victory').length,hp:results.map(r=>Math.round(r.hpRatio*100))};rows.push(row);console.log(JSON.stringify(row));
}writeFileSync('artifacts/difficulty-v2/probe-targets.json',JSON.stringify(rows,null,2));
