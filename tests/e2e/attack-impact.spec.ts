import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHARACTER_IDS } from '../../src/data/content';
const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/attack-impact';mkdirSync(`${dir}/screenshots`,{recursive:true});
for(const id of CHARACTER_IDS)for(const speed of [1,3])test(`IMPACT ${id} ${speed}×: actual hits remain readable above characters and freeze on pause`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**/*',s=>s.close());
  await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.evaluate(id=>window.__game.start({stageId:'S03',squadIds:[id],captainId:id,seed:101}),id);
  await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
  while(await page.locator('#speed-button').innerText()!==`${speed}×`)await page.locator('#speed-button').click();
  await page.evaluate(async()=>{const path='/src/sim/combat.ts';const{createEnemy}=await import(path);const s=window.__game.state()!;s.enemies=[];s.projectiles=[];s.fields=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.weapons[0].nextAttack=s.tick+90000;for(let i=0;i<3;i++){const e=createEnemy(s,'E03',140+i*55,245+i%2*35);e.hp=e.maxHp=100000;e.speed=0;}});
  await page.waitForTimeout(700); // Let the replaced initial actors finish their cosmetic removal.
  const initial=await page.evaluate(()=>{const s=window.__game.state()!;s.weapons[0].nextAttack=s.tick;return {seq:s.eventSeq,hp:s.enemies.reduce((sum,e)=>sum+e.hp,0)};});
  await page.waitForFunction(({id,seq})=>window.__game.state()!.events.some(e=>e.seq>seq&&e.source===id&&e.kind==='hit'),{id,seq:initial.seq});
  const hit=await page.evaluate(({id,seq})=>{const s=window.__game.state()!;s.weapons[0].nextAttack=s.tick+90000;return s.events.find(e=>e.seq>seq&&e.source===id&&e.kind==='hit')!;},{id,seq:initial.seq});
  await page.waitForFunction(seq=>window.__game.presentation().visibleEffects.some(e=>e.seq===seq&&e.age>=150&&e.age<240),hit.seq);
  await page.evaluate(()=>window.__game.command({type:'pause',reason:'user'}));
  const paused=await page.evaluate(()=>({tick:window.__game.state()!.tick,view:window.__game.presentation(),hp:window.__game.state()!.enemies.reduce((sum,e)=>sum+e.hp,0)}));
  const effect=paused.view.visibleEffects.find(e=>e.seq===hit.seq)!;expect(effect).toBeDefined();expect(effect.duration).toBe(260);expect(paused.view.effectsDepth).toBeGreaterThan(paused.view.alliesDepth);expect(paused.view.effectsDepth).toBeLessThan(paused.view.warnings.geometryDepth);
  if(id!=='C04')expect(paused.hp).toBeLessThan(initial.hp);
  await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__game.presentation().visibleEffects)).toEqual(paused.view.visibleEffects);
  await page.locator('#battle-overlay').evaluate(e=>{e.style.visibility='hidden';}); // Show the frozen canvas for visual review, not a gameplay action.
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-${id}-${speed}x-impact.png`});
  await page.evaluate(()=>window.__game.command({type:'resume',reason:'user'}));await page.waitForTimeout(500);
  expect(await page.evaluate(seq=>window.__game.presentation().visibleEffects.some(e=>e.seq===seq),hit.seq)).toBe(false);expect(errors).toEqual([]);
  writeFileSync(`${dir}/${info.project.name}-${id}-${speed}x-impact.json`,JSON.stringify({evidence:'Isolated high-HP target fixture; real automatic weapon, simulation damage and real-time render loop trigger the hit. Frozen canvas captured at least 150 ms after the impact.',initial,hit,paused,errors},null,2));
});
