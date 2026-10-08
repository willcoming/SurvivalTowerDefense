import { test, expect } from '@playwright/test';
import { ready } from '../helpers/mobile-ui';

test.use({ video: 'on' });
for(const width of [390,1440])for(const stage of ['S01','S02','S03'] as const)test.describe(`${stage} ${width}`,()=>{
  test.use({viewport:{width,height:width===390?844:1000},isMobile:width===390,hasTouch:width===390});
  test('boss entrance, charge and actual impact stay readable without arena lines',async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await ready(page);
    await page.evaluate(stageId=>window.__game.start({stageId,squadIds:['C01','C02','C03','C04','C05'],captainId:'C01',seed:101}),stage);
    await page.locator('#battle-loading').waitFor({state:'detached'});
    await page.locator('[data-action=tutorial-done]').first().click();
    await page.evaluate(()=>{
      const s=window.__game.state()!;s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;
      s.weapons.forEach(w=>{w.nextAttack=999999;w.ultimateReadyAt=999999;});
      s.wallHp=s.wallMaxHp=100000;s.bossSpawned=false;s.waveFlow!.wave=11;s.waveFlow!.phase='combat';
      window.__game.ticks(1);
    });
    await page.waitForFunction(()=>!!window.__game.presentation().bossIntro&&(window.__game.state()!.bossIntro?.remainingMs??1500)<900);
    const frozen=await page.evaluate(()=>window.__game.state()!.tick);
    await page.screenshot({path:info.outputPath('boss-entrance.png')});
    expect(await page.evaluate(()=>window.__game.state()!.tick)).toBe(frozen);
    await page.waitForFunction(()=>!window.__game.state()!.bossIntro);
    await page.evaluate(()=>{
      const s=window.__game.state()!;s.enemies=s.enemies.filter(e=>e.defId.startsWith('B'));s.projectiles=[];s.scheduled=[];
      const boss=s.enemies[0];boss.hp=boss.maxHp=1e7;boss.abilityAt=s.tick;boss.attackAt=999999;
    });
    await page.waitForFunction(()=>window.__game.presentation().warnings.visible);
    await page.screenshot({path:info.outputPath('boss-charge.png')});
    await page.waitForFunction(()=>window.__game.presentation().bossAssault.releases>0);
    const impact=await page.evaluate(()=>({hp:window.__game.state()!.wallHp,view:window.__game.presentation().bossAssault}));
    expect(impact.hp).toBeLessThan(100000);expect(impact.view.impactText).toContain('防線 −');
    await page.screenshot({path:info.outputPath('boss-impact.png')});
    expect(errors).toEqual([]);
  });
});
