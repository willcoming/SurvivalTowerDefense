import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {command,stepRun} from '../../src/sim/engine';
import {createRun} from '../helpers/previous-tree-run';
import {shouldAutoCast} from '../../src/ui/auto-tactical';
import type {RunConfig} from '../../src/sim/types';

function play(config:RunConfig) {
  const s=createRun(config);
  const plan=['C02-A:0','C03-B:0','C05-A:0','C02-A:1','C03-B:1','C05-A:1','C02-A:2','C03-B:2','C05-A:2','C02-A:4','C03-B:4','C05-A:4','C01-A:0','C01-A:1','C06-C:0','C06-C:1','G01-1','G01-2'];
  for(let guard=0;guard<17000&&!s.outcome;guard++){
    if(s.draft){const nodeId=plan[s.choicesSpent];if(!command(s,{type:'custom-node',nodeId})||!command(s,{type:'choose',offerId:s.draft.id,nodeId}))throw new Error('Invalid replay plan');continue;}
    if(s.bossIntro){command(s,{type:'finish-boss-intro'});continue;}
    if(shouldAutoCast(s,true))command(s,{type:'cast'});stepRun(s);
  }return s;
}

test('TREE: all three complete legal playthroughs replay in browser, unlock progression and render node history',async({page},info)=>{
  test.setTimeout(90000);await page.routeWebSocket('**/*',socket=>socket.close());
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  const rows=[];
  for(const stageId of ['S01','S02','S03'] as const){
    const config:RunConfig={stageId,squadIds:['C01','C02','C03','C05','C06'],captainId:'C02',seed:101};
    const expected=play(config);expect(expected.outcome).toBe('victory');
    await page.evaluate(async config=>{const loading=window.__game.start(config,'0.2.0-dev.1');window.__game.command({type:'pause',reason:'user'});await loading;},config);
    await page.locator('#battle-loading').waitFor({state:'detached'});if(await page.locator('[data-action="tutorial-done"]').count())await page.locator('[data-action="tutorial-done"]').first().click();
    const actual=await page.evaluate(async actions=>{
      const api=window.__game,s=api.state()!;api.command({type:'resume',reason:'user'});let cursor=0;
      for(let guard=0;guard<17000&&!s.outcome;guard++){
        while(actions[cursor]?.tick===s.tick){if(!api.command(actions[cursor++].command))throw new Error('Browser replay rejected action');}
        if(s.outcome)break;if(s.pauseReasons.length)throw new Error(`Unexpected pause ${s.pauseReasons}`);
        api.ticks(Math.max(1,(actions[cursor]?.tick??14400)-s.tick));
      }
      await api.save();return {outcome:s.outcome,tick:s.tick,wallHp:s.wallHp,nodes:s.treeNodes,stats:s.stats,rng:s.rng,cleared:api.getSave().profile.cleared,active:api.getSave().activeRun};
    },expected.actions);
    expect(actual.outcome).toBe('victory');expect(actual.tick).toBe(expected.tick);expect(actual.wallHp).toBe(expected.wallHp);expect(actual.nodes).toEqual(expected.treeNodes);expect(actual.stats).toEqual(expected.stats);expect(actual.rng).toEqual(expected.rng);
    await expect(page.locator('.result-screen')).toBeVisible();await expect(page.locator('.choice-history li')).toHaveCount(18);expect(actual.cleared).toContain(stageId);expect(actual.active).toBeNull();
    rows.push({stageId,tick:actual.tick,wallHp:actual.wallHp,nodes:actual.nodes,cleared:actual.cleared});
    await page.locator('.result-actions [data-action="home"]').click();
  }
  expect(errors).toEqual([]);const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/skill-trees';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${info.project.name}-new-playthroughs.json`,JSON.stringify({rows,errors},null,2));
});
