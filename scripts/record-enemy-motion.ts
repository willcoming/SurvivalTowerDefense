import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
const dir='artifacts/validation/enemy-motion/demo';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,recordVideo:{dir,size:{width:390,height:844}}});const page=await context.newPage();
await page.routeWebSocket('**/*',socket=>socket.close());
try{
  await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>!!window.__game);
  await page.evaluate(()=>window.__game.start({stageId:'S03',squadIds:['C01','C02','C03','C04','C05'],captainId:'C05',seed:101}));
  await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
  await page.evaluate(async()=>{
    const path='/src/sim/combat.ts';const {createEnemy}=await import(path);const s=window.__game.state()!;
    s.enemies=[];s.projectiles=[];s.scheduled=[];s.fields=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.wallHp=s.wallMaxHp=100000;
    s.weapons.forEach(w=>{w.nextAttack=s.tick+90000;});
    ['E01','E02','E03','E04','E05','E06','E07','E08','B03'].forEach((id,i)=>{const e=createEnemy(s,id,45+i%4*95,45+Math.floor(i/4)*80,0,9);e.hp=e.maxHp=1e6;e.abilityAt=e.summonAt=90000;});
  });
  await page.waitForTimeout(3000);await page.locator('#speed-button').click();await page.locator('#speed-button').click();await page.waitForTimeout(2300);
  await page.evaluate(()=>{const s=window.__game.state()!;s.enemies.forEach(e=>{e.y=e.defId.startsWith('B')?150:e.defId==='E05'?250:450;e.abilityAt=s.tick;e.attackAt=s.tick+9;});});
  await page.waitForFunction(()=>window.__game.presentation().warnings.visible);await page.getByRole('button',{name:'自動施放隊長技能',exact:true}).click();await page.waitForTimeout(1600);
  await page.locator('[data-action="pause"]').click();await page.waitForTimeout(250);
  writeFileSync(`${dir}/description.json`,JSON.stringify({evidence:'Recorded actual development game canvas and DOM. Synthetic isolated targets with large HP and original movement speeds, 1× then 3×, real deadline-driven attacks, automatic captain skill and pause. Not a legally earned battle or a balance result.',finalView:await page.evaluate(()=>window.__game.presentation())},null,2));
}finally{const video=page.video();await context.close();if(video)renameSync(await video.path(),`${dir}/enemy-motion-and-auto-skill.webm`);await browser.close();}
