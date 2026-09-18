import {test,expect} from '@playwright/test';
test.use({isMobile:false,hasTouch:false});

for(const width of [320,768,1024,1440])test(`dense battle remains readable at ${width}`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:width===320?600:900});
  await page.goto('/');await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.start({stageId:'S12',squadIds:['C01','C02','C04','C06','C07'],captainId:'C01',seed:101}));
  await page.locator('#battle-loading').waitFor({state:'detached'});
  await page.locator('[data-action="tutorial-done"]').first().click();
  await page.evaluate(async()=>{
    const path='/src/sim/combat.ts';const {createEnemy}=await import(path),s=window.__game.state()!;
    s.weapons.forEach(w=>w.nextAttack=s.tick+999999);s.tacticalReadyAt=s.tick+999999;
    s.enemies=[];s.fields=[];s.spawnCursor=s.spawnPlan.length;
    for(let i=0;i<36;i++){
      const enemy=createEnemy(s,i%3===0?'E03':'E01',35+(i%6)*64,110+Math.floor(i/6)*42,0);
      enemy.shield=40;enemy.hp*=.8;enemy.speed=0;
    }
    const boss=createEnemy(s,'B03',195,90,0);boss.chargeKind='boss';boss.chargeUntil=s.tick+90;
    for(let i=0;i<3;i++)s.fields.push({id:s.nextEntityId++,source:'C04',kind:'gravity',x:90+i*105,y:240+(i%2)*70,radius:75,expires:s.tick+300,nextTick:s.tick+30,dps:1,damageType:'gravity',slow:.2,slowDuration:30,pull:1,burnDuration:0,armorIgnore:0});
    s.actionSeq++;
  });
  await expect.poll(()=>page.evaluate(()=>window.__game.presentation().warnings.visible)).toBe(true);
  await page.screenshot({path:info.outputPath(`dense-${width}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
