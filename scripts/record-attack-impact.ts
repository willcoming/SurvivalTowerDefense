import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { CHARACTER_IDS } from '../src/data/content';
const dir='artifacts/validation/attack-impact/demo';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir,size:{width:390,height:844}}});const page=await context.newPage();
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**/*',s=>s.close());
try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>!!window.__game);
  for(const id of CHARACTER_IDS){
    await page.evaluate(id=>window.__game.start({stageId:'S03',squadIds:[id],captainId:id,seed:101}),id);await page.locator('#battle-loading').waitFor({state:'detached'});
    if(await page.locator('[data-action="tutorial-done"]').count())await page.locator('[data-action="tutorial-done"]').first().click();
    while(await page.locator('#speed-button').innerText()!=='3×')await page.locator('#speed-button').click();
    await page.evaluate(async()=>{const path='/src/sim/combat.ts';const{createEnemy}=await import(path);const s=window.__game.state()!;s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;for(let i=0;i<4;i++){const e=createEnemy(s,'E03',105+i*60,220+i%2*35);e.hp=e.maxHp=100000;e.speed=0;}});
    await page.waitForTimeout(2400);
  }
  await page.locator('[data-action="pause"]').click();await page.locator('#battle-overlay').evaluate(e=>{e.style.visibility='hidden';});
  const widths=[];for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:900});const bounds=await page.locator('#battle-canvas canvas').boundingBox();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);widths.push({width,bounds,overflow});if(overflow)throw new Error(`overflow at ${width}`);}
  if(errors.length)throw new Error(errors.join('\n'));
  writeFileSync(`${dir}/capture.json`,JSON.stringify({evidence:'Six individual base weapons in the actual game at 3×. Synthetic durable stationary targets isolate attack effects; real weapon cooldowns, projectiles and damage run throughout. Desktop context and responsive widths; not physical-phone evidence.',widths,errors},null,2));
}finally{const video=page.video();await context.close();if(video)renameSync(await video.path(),`${dir}/six-weapons-3x.webm`);await browser.close();}
