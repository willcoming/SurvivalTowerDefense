import {test,expect} from '@playwright/test';
import {ready,startBattle} from '../helpers/mobile-ui';
for(const compact of [false,true])test(`burn labels follow real victims and remain at death, compact=${compact}`,async({page})=>{
 await ready(page);await startBattle(page);
 const id=await page.evaluate(async compact=>{
  const c='/src/sim/combat.ts',engine='/src/sim/engine.ts';const {createEnemy,applyEffect}=await import(c),{stepRun}=await import(engine);
  const s=window.__game.state()!;window.__game.getSave().preferences.reducedEffects=compact;s.pauseReasons=[];s.phase='running';s.enemies=[];s.fields=[];s.projectiles=[];s.scheduled=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.weapons.forEach(w=>w.nextAttack=1e9);
  const e=createEnemy(s,'E03',120,200,0);e.hp=e.maxHp=100000;e.speed=e.armor=e.shield=0;applyEffect(s,e,{id:'follow-burn',kind:'burn',source:'C05',value:8,expires:s.tick+180,nextTick:s.tick+1,armorIgnore:1});stepRun(s);window.__game.ticks(0);s.pauseReasons=['user'];s.phase='paused';return e.id;
 },compact);
 await page.waitForFunction(id=>window.__game.presentation().burnNumbers.some((l:any)=>l.targetId===id),id);
 const first=await page.evaluate(id=>window.__game.presentation().burnNumbers.find((l:any)=>l.targetId===id),id);
 expect(first!.value).toBeGreaterThan(0);
 await page.evaluate(id=>{const e=window.__game.state()!.enemies.find(e=>e.id===id)!;e.x+=50;e.y+=30;},id);
 await page.waitForFunction(id=>window.__game.presentation().burnNumbers.some((l:any)=>l.targetId===id&&l.hitX===170&&l.hitY===230),id);
 const moved=await page.evaluate(id=>window.__game.presentation().burnNumbers.find((l:any)=>l.targetId===id),id);
 expect(moved!.value).toBe(first!.value);expect(Math.abs(moved!.x-170)).toBeLessThanOrEqual(24);expect(Math.abs(moved!.y-230)).toBeLessThanOrEqual(48);
 await page.evaluate(async id=>{const c='/src/sim/combat.ts';const {hitEnemy}=await import(c);const s=window.__game.state()!,e=s.enemies.find(e=>e.id===id)!;hitEnemy(s,e,{source:'C01',skill:'death-fixture',raw:1e9,damageType:'plasma',armorIgnore:1,shieldMultiplier:1});window.__game.ticks(0);},id);
 const dead=await page.evaluate(id=>window.__game.presentation().burnNumbers.find((l:any)=>l.targetId===id),id);expect(dead!.value).toBe(first!.value);expect(Math.abs(dead!.x-170)).toBeLessThanOrEqual(24);
});
