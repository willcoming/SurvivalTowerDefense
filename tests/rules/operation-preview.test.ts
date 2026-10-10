import { describe, expect, it } from 'vitest';
import { createRun } from '../../src/sim/engine';
import { operationProfile } from '../../src/data/progression';
import { createDefaultSave } from '../../src/storage/repository';
import { commandPanel } from '../../src/ui/command-panel';
import { intel } from '../../src/ui/lobby';
import type { ViewModel } from '../../src/ui/model';
import type { CharacterId, RunConfig } from '../../src/sim/types';

const view=():ViewModel=>({page:'home',stageId:'S12',characterId:'C01',challengeId:null,retrySeed:null,selectedCard:null,modal:null,saveStatus:'',message:'',showBuild:false,commandPanel:'waves'});
const waveXp=(html:string)=>[...html.matchAll(/ · (\d+) 經驗<\/h3>/g)].map(match=>Number(match[1]));
const points=(html:string)=>Number(html.match(/<small>技能預算<\/small><b>(\d+) 點<\/b>/)![1]);

describe('operation previews use the new run rules',()=>{
  it.each([
    {difficulty:'easy' as const,challengeId:null},
    {difficulty:'hard' as const,challengeId:null},
    {difficulty:'hard' as const,challengeId:'no-skill' as const},
  ])('matches live campaign XP and the solo capacity for $difficulty/$challengeId',({difficulty,challengeId})=>{
    const save=createDefaultSave(),vm=view();
    save.preferences.squadIds=['C01'];save.preferences.captainId='C01';save.preferences.difficulty=difficulty;
    save.profile.cleared=['S12'];save.profile.easyCleared=['S12'];save.profile.hardCleared=['S12'];
    vm.challengeId=challengeId;
    const config:RunConfig={stageId:vm.stageId,difficulty,challengeId,squadIds:save.preferences.squadIds,captainId:save.preferences.captainId,seed:101};
    const profile=operationProfile(createRun(config)),before=structuredClone(save);
    expect(profile.points).toBe(challengeId==='no-skill'?23:25);
    expect(waveXp(commandPanel(save,vm,null))).toEqual(profile.waveXp);
    expect(points(commandPanel(save,{...vm,commandPanel:'intel'},null))).toBe(profile.points);
    expect(intel(save,vm)).toContain(`${profile.points} 點技能`);
    expect(save).toEqual(before);
  });

  it.each([1,2,5])('uses the actual %i-member hundred-wave squad and ignores campaign settings',count=>{
    const save=createDefaultSave(),vm=view();
    save.preferences.squadIds=(['C01','C02','C03','C05','C06'] as CharacterId[]).slice(0,count);
    save.preferences.captainId='C01';save.preferences.difficulty='hard';
    vm.page='hundred';vm.challengeId='no-skill';
    const profile=operationProfile(createRun({stageId:'S03',mode:'hundred',difficulty:'easy',squadIds:save.preferences.squadIds,captainId:save.preferences.captainId,seed:101}));
    expect(profile.points).toBe(Math.min(60,count*25));
    expect(waveXp(commandPanel(save,vm,null))).toEqual(profile.waveXp);
    expect(points(commandPanel(save,{...vm,commandPanel:'intel'},null))).toBe(profile.points);
  });

  it('keeps an active historical battle on its saved profile',()=>{
    const save=createDefaultSave(),vm=view();vm.page='battle';vm.commandPanel='intel';
    save.activeRun=createRun({stageId:'S12',difficulty:'easy',squadIds:['C01'],captainId:'C01',seed:101},undefined,{balanceVersion:5,experienceVersion:3});
    expect(save.preferences.squadIds).toHaveLength(5);
    expect(points(commandPanel(save,vm,null))).toBe(operationProfile(save.activeRun).points);
    expect(points(commandPanel(save,vm,null))).toBe(25);
    expect(save.activeRun.balanceVersion).toBe(5);
    expect(save.activeRun.experienceVersion).toBe(3);
  });
});
