import {test,expect} from '@playwright/test';
import {ready,startBattle} from '../helpers/mobile-ui';
for(const width of [390,1440])for(const reduced of [false,true])test.describe(`energy ${width} ${reduced?'compact':'full'}`,()=>{
 test.use({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390});
 test('real chain carries illustrated energy and pooled images disappear after impact',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await page.evaluate(reduced=>{const save=window.__game.getSave();save.preferences.squadIds=['C02'];save.preferences.captainId='C02';save.preferences.reducedEffects=reduced;window.__game.route('home');},reduced);await startBattle(page);
  await page.evaluate(async()=>{
   const combat='/src/sim/combat.ts',weapons='/src/sim/weapons.ts';const{createEnemy}=await import(combat),{stepWeapons}=await import(weapons),s=window.__game.state()!;
   s.enemies=[];s.events=[];s.fields=[];s.scheduled=[];s.projectiles=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.weapons.forEach(w=>w.nextAttack=1e9);
   for(const x of [195,240,285]){const e=createEnemy(s,'E03',x,330,0);e.hp=e.maxHp=100000;e.armor=e.shield=e.speed=0;}
   const w=s.weapons[0];w.nextAttack=0;stepWeapons(s);w.nextAttack=1e9;window.__game.ticks(0);
  });
  await page.waitForFunction(()=>((window.__game.presentation() as any).materialEffects.textures['vfx-soft-light']??0)>=2);
  expect(await page.evaluate(()=>window.__game.state()!.events.some(e=>e.kind==='arc'))).toBe(true);
  const active=await page.evaluate(()=>(window.__game.presentation() as any).materialEffects);expect(active.active).toBeLessThanOrEqual(active.limit);
  await page.waitForFunction(()=>(window.__game.presentation() as any).materialEffects.active===0);expect(errors).toEqual([]);
 });
});
