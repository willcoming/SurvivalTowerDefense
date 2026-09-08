import {expect,test,type Page} from '@playwright/test';

async function load(page:Page){await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);}
async function victory(page:Page,difficulty:'easy'|'hard'){
  await page.evaluate(async difficulty=>{
    const ep='/src/sim/engine.ts',rp='/src/storage/repository.ts';const {createRun}=await import(ep),{completeRun}=await import(rp);
    const run=createRun({stageId:'S01',difficulty,squadIds:['C01'],captainId:'C01',seed:21});run.phase='ended';run.outcome='victory';run.wallHp=5;
    completeRun(window.__game.getSave(),run);await window.__game.save();window.__game.route('home');
  },difficulty);
}
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}]){
  test(`challenge entry follows hard, unlocks per stage, and stacks restrictions on hard at ${viewport.width}`,async({page},info)=>{
    await page.setViewportSize(viewport);await load(page);
    const entry=page.locator('.difficulty-options [data-id="challenges"]');
    await expect(page.locator('.difficulty-options button')).toHaveText(['簡單','困難','挑戰']);
    const boxes=await page.locator('.difficulty-options button').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};}));
    expect(boxes[2].x).toBeGreaterThan(boxes[1].x+boxes[1].width);expect(boxes[2].y).toBe(boxes[0].y);
    await expect(entry).toBeDisabled();await expect(entry).toHaveAttribute('title','通關本關困難模式後解鎖');
    await victory(page,'easy');await expect(entry).toBeDisabled();
    await page.evaluate(async()=>{await window.__game.start({stageId:'S01',difficulty:'easy',challengeId:'no-skill',squadIds:['C01'],captainId:'C01',seed:11});});
    expect(await page.evaluate(()=>window.__game.getSave().activeRun)).toBeNull();

    await victory(page,'hard');await page.reload();await page.waitForFunction(()=>!!window.__game);
    // Reload selects the next unlocked stage; unlock stays scoped to the completed stage.
    await expect(entry).toBeDisabled();await page.getByRole('button',{name:'上一關',exact:true}).click();await expect(entry).toBeEnabled();
    await page.screenshot({path:info.outputPath(`challenge-home-${viewport.width}.png`)});
    await entry.click();await expect(page.getByRole('dialog',{name:'挑戰作戰'})).toBeVisible();
    await expect(page.locator('.tactical-challenges')).toContainText('以困難模式為基準');
    await page.locator('[data-action="challenge"][data-id="four"]').click();
    await expect(page.getByRole('button',{name:'調整編隊',exact:true})).toBeVisible();
    await expect(page.locator('.tactical-challenges [data-action="start"]')).toHaveCount(0);
    await page.locator('[data-action="challenge"][data-id="no-skill"]').click();
    await expect(page.locator('[data-action="challenge"][data-id="no-skill"]')).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:info.outputPath(`challenge-options-${viewport.width}.png`)});
    await page.getByRole('button',{name:'開始挑戰',exact:true}).click();await page.locator('#battle-loading').waitFor({state:'detached'});
    const config=await page.evaluate(()=>window.__game.state()!.config);expect(config.difficulty).toBe('hard');expect(config.challengeId).toBe('no-skill');
    // Complete this selected challenge through the real reward transaction twice.
    for(let i=0;i<2;i++)await page.evaluate(async()=>{
      const ep='/src/sim/engine.ts',rp='/src/storage/repository.ts';const {createRun}=await import(ep),{completeRun}=await import(rp);
      const save=window.__game.getSave(),run=createRun(window.__game.state()!.config);run.phase='ended';run.outcome='victory';run.wallHp=1000;
      completeRun(save,run);await window.__game.save();
    });
    expect(await page.evaluate(()=>window.__game.getSave().collection.points)).toBe(0);
    expect(await page.evaluate(()=>window.__game.getSave().collection.tickets)).toBe(18);
    await page.evaluate(()=>window.__game.route('home'));await entry.click();
    await expect(page.locator('[data-action="challenge"][data-id="no-skill"]')).toContainText('三格獎勵已領');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}
