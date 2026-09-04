import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { EnemyId, StageId } from '../../src/sim/types';
const dir = process.env.VALIDATION_OUTPUT_DIR ?? 'artifacts/validation/enemy-motion';
mkdirSync(`${dir}/screenshots`, { recursive: true });
const groups: [StageId, EnemyId[]][] = [['S03',['E01','E02','E03','E04','E05','E06','E07','E08','B03']], ['S01',['B01']], ['S02',['B02']]];
async function boot(page: Page, stageId: StageId, speed: number) {
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(stageId => window.__game.start({ stageId, squadIds: ['C01','C02','C03','C04','C05'], captainId: 'C05', seed: 101 }), stageId);
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  if (await page.locator('[data-action="tutorial-done"]').count()) await page.locator('[data-action="tutorial-done"]').first().click();
  while (await page.locator('#speed-button').innerText() !== `${speed}×`) await page.locator('#speed-button').click();
}
async function fixture(page: Page, types: EnemyId[]) {
  await page.evaluate(async types => {
    const path = '/src/sim/combat.ts'; const { createEnemy } = await import(path); const s = window.__game.state()!;
    s.enemies=[];s.projectiles=[];s.scheduled=[];s.fields=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;
    s.wallHp=s.wallMaxHp=1e6;
    for(const w of s.weapons)w.nextAttack=s.tick+90000;
    types.forEach((id,i)=>{const e=createEnemy(s,id,40+i%5*76,45+Math.floor(i/5)*70,0,9);e.hp=e.maxHp=1e9;e.abilityAt=e.summonAt=999999;});
  }, types);
}
for (const [stage, types] of groups) for(const speed of [1,3]) test(`ENEMY ${stage} ${speed}×: real frames follow movement, idle, anticipation and actual attacks`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await boot(page,stage,speed);await fixture(page,types);
  const positions=await page.evaluate(()=>window.__game.state()!.enemies.map(e=>({id:e.id,y:e.y})));
  await page.waitForFunction(types=>types.every(id=>[2,3,4,5,6,7].every(f=>window.__game.presentation().enemyHistory[id]?.frames.includes(f))),types);
  const moving=await page.evaluate(()=>({view:window.__game.presentation(), enemies:structuredClone(window.__game.state()!.enemies)}));
  for(const e of moving.enemies){expect(e.y).toBeGreaterThan(positions.find(p=>p.id===e.id)!.y);const m=moving.view.enemyMotions.find(m=>m.id===e.id)!;expect(m.mode).toBe('move');expect(m.fps).toBeLessThanOrEqual(14);expect(m.texture).toBe(`enemy-motion-${e.defId}`);expect(moving.view.enemyTextureFrames[e.defId]).toBe(12);}
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-${stage}-${speed}x-moving.png`});
  await page.evaluate(()=>{const s=window.__game.state()!;s.enemies.forEach(e=>{e.y=e.defId.startsWith('B')?150:e.defId==='E05'?250:450;e.attackAt=s.tick+90000;});});
  await page.waitForFunction(types=>types.every(id=>[0,1].every(f=>window.__game.presentation().enemyHistory[id]?.frames.includes(f))),types);
  const idle=await page.evaluate(()=>window.__game.presentation());expect(idle.enemyMotions.every(m=>m.mode==='idle')).toBe(true);
  // Set only deadlines/positions; stepEnemies performs each real melee, shot and Boss release.
  const before=await page.evaluate(()=>{const s=window.__game.state()!;s.enemies.forEach(e=>{if(e.defId.startsWith('B')||e.defId==='E05')e.abilityAt=s.tick;else e.attackAt=s.tick+9;});return {wall:s.wallHp,tick:s.tick};});
  await page.waitForFunction(types=>types.every(id=>window.__game.presentation().enemyHistory[id]?.releases>0),types);
  const attack=await page.evaluate(()=>({view:window.__game.presentation(),enemies:structuredClone(window.__game.state()!.enemies),wall:window.__game.state()!.wallHp}));
  expect(attack.wall).toBeLessThan(before.wall);
  for(const id of types){const history=attack.view.enemyHistory[id];expect(history.modes).toEqual(expect.arrayContaining(['move','idle','charge','attack']));expect(history.frames).toEqual(expect.arrayContaining([0,1,2,3,4,5,6,7,8,9,10,11]));expect(attack.enemies.find(e=>e.defId===id)!.lastAction!.tick).toBeGreaterThan(before.tick);}
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-${stage}-${speed}x-attack.png`});
  writeFileSync(`${dir}/${info.project.name}-${stage}-${speed}x-motion.json`,JSON.stringify({evidence:'Synthetic target positions, large HP and isolated deadlines. Normal RAF, real movement speeds, stepEnemies and real damage/projectile creation drive the animation; not a balance run.',positions,moving,idle,before,attack,errors},null,2));expect(errors).toEqual([]);
});

test('ENEMY: stun freezes every pose, compact effects retain gait, pause and saved charge restore correctly',async({page},info)=>{
  await boot(page,'S03',3);await fixture(page,groups[0][1]);await page.waitForTimeout(500);
  await page.evaluate(()=>{const s=window.__game.state()!;for(const e of s.enemies)e.effects=[{id:'motion-stun',kind:'stun',source:'C02',value:1,expires:s.tick+900,nextTick:0,armorIgnore:0}];});
  await page.waitForFunction(()=>window.__game.presentation().enemyMotions.every(m=>m.mode==='stunned'));
  const frozen=await page.evaluate(()=>({view:window.__game.presentation().enemyMotions,ys:window.__game.state()!.enemies.map(e=>e.y)}));await page.waitForTimeout(250);
  expect(await page.evaluate(()=>({view:window.__game.presentation().enemyMotions,ys:window.__game.state()!.enemies.map(e=>e.y)}))).toEqual(frozen);
  await page.locator('[data-action="pause"]').click();await page.locator('#reduced').check();
  const paused=await page.evaluate(()=>window.__game.presentation().enemyMotions);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__game.presentation().enemyMotions)).toEqual(paused);
  await page.evaluate(()=>{const s=window.__game.state()!;s.enemies.forEach(e=>{e.effects=[];});});
  await page.locator('[data-action="resume"]').click();await page.waitForFunction(()=>window.__game.presentation().enemyMotions.every(m=>m.mode==='move'));
  expect(await page.evaluate(()=>window.__game.presentation().detail)).toBe('compact');
  // Save a running gait, a real future charge deadline, and a historical action cue together.
  await page.locator('[data-action="pause"]').click();
  const saved=await page.evaluate(async()=>{const s=window.__game.state()!;const boss=s.enemies.find(e=>e.defId==='B03')!;boss.y=150;boss.chargeKind='boss';boss.chargeUntil=s.tick+90;boss.lastAction={tick:s.tick-1,kind:'summon'};await window.__game.save();return structuredClone(s);});
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});
  const restored=await page.evaluate(()=>({state:structuredClone(window.__game.state()!),view:window.__game.presentation()}));
  expect(restored.state.enemies).toEqual(saved.enemies);expect(restored.state.tick).toBe(saved.tick);expect(restored.state.rng).toEqual(saved.rng);expect(restored.view.enemyMotions.every(m=>m.releases===0)).toBe(true);
  await page.locator('[data-action="resume"]').click();await page.waitForFunction(()=>window.__game.presentation().enemyMotions.find(m=>m.type==='B03')?.mode==='charge');
  const resumed=await page.evaluate(()=>window.__game.presentation());expect(resumed.warnings.visible).toBe(true);expect(resumed.enemyMotions.find(m=>m.type==='B03')!.releases).toBe(0);expect(resumed.enemyMotions.filter(m=>m.type!=='B03').every(m=>m.mode==='move')).toBe(true);
  await page.locator('[data-action="cast"]').click();await page.waitForFunction(()=>window.__game.presentation().cutin.visible);
  const warning=await page.evaluate(()=>window.__game.presentation());expect(warning.warnings.depth).toBeGreaterThan(warning.cutin.depth);expect(warning.warnings.bottom).toBeLessThan(warning.cutin.top);
  await page.screenshot({path:`${dir}/screenshots/${info.project.name}-restored-charge-warning.png`});
  // Explicitly cancel this fixture charge; advancing through its deadline must not release it.
  await page.evaluate(()=>{window.__game.state()!.enemies.find(e=>e.defId==='B03')!.chargeCancelled=true;});await page.waitForTimeout(1100);
  expect(await page.evaluate(()=>window.__game.presentation().enemyMotions.find(m=>m.type==='B03')!.releases)).toBe(0);
  writeFileSync(`${dir}/${info.project.name}-motion-recovery.json`,JSON.stringify({frozen,paused,saved,restored,resumed,warning},null,2));
});
