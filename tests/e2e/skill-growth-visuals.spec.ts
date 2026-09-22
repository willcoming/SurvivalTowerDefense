import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pathTo } from '../helpers/deep-build';
import type { CharacterId } from '../../src/sim/types';

const builds: [CharacterId, string[]][] = [
  ['C01', ['C01-A/9']], ['C02', ['C02-A/1', 'C02-A/7', 'C02-A/10']],
  ['C03', ['C03-A/7']], ['C04', ['C04-A/0']], ['C05', ['C05-A/2']],
  ['C06', ['C06-A/4', 'C06-A/10']], ['C07', ['C07-A/8']], ['C08', ['C08-A/8']],
];
for (const [id, terminals] of builds) test(`skill growth ${id}: real purchases retain visible upgraded attacks`, async ({ page }, info) => {
  await page.goto('/'); await page.waitForFunction(() => !!window.__game);
  await page.evaluate(async id => {
    window.__game.getSave().preferences.autoTactical = false;
    await window.__game.start({ stageId: 'S03', squadIds: id === 'C06' ? ['C01','C02','C03','C04','C06'] : [id], captainId: id, seed: 71 });
  }, id);
  await page.locator('#battle-loading').waitFor({ state: 'detached' });
  await page.locator('[data-action="tutorial-done"]').first().click();
  const plan = [...new Set(terminals.flatMap(pathTo))];
  const result = await page.evaluate(async ({ id, plan }) => {
    const combatPath='/src/sim/combat.ts', draftPath='/src/sim/draft.ts', enginePath='/src/sim/engine.ts', weaponPath='/src/sim/deep-weapons.ts', treePath='/src/sim/deep-tree.ts';
    const { createEnemy }=await import(combatPath), { openDraft }=await import(draftPath), { command }=await import(enginePath), { stepDeepWeapons, deepWeaponStats }=await import(weaponPath);
    const { deepNodeCost, deepLegalNodes }=await import(treePath);
    const s=window.__game.state()!;
    command(s,{type:'pause',reason:'user'});
    s.enemies=[]; s.projectiles=[]; s.fields=[]; s.mines=[]; s.spawnCursor=s.spawnPlan.length;
    s.tacticalReadyAt=999999; s.weapons.forEach(w=>w.nextAttack=999999);
    for(let i=0;i<12;i++){const e=createEnemy(s,'E03',165+(i%3)*30,210+Math.floor(i/3)*40); e.hp=e.maxHp=1e8;e.speed=0;}
    const w=s.weapons.find(w=>w.id===id)!;
    const fire=()=>{s.events=[];s.projectiles=[];s.fields=[];s.mines=[];w.nextAttack=s.tick;stepDeepWeapons(s);w.nextAttack=999999;return {stats:deepWeaponStats(s,w), events:structuredClone(s.events), projectiles:structuredClone(s.projectiles),mines:structuredClone(s.mines),fields:structuredClone(s.fields)};};
    const before=fire();
    s.choicesEarned=24;s.xp=720;openDraft(s);
    for(const nodeId of plan){
      if(deepNodeCost(nodeId,s)>s.draft!.pointTarget!-s.choicesSpent){
        const filler=deepLegalNodes(s).find((n:string)=>n.startsWith(id)&&!plan.includes(n)&&deepNodeCost(n,s)===1)!;
        if(!command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:filler}))throw new Error('Rejected filler');
      }
      if(!command(s,{type:'buy-node',offerId:s.draft!.id,nodeId}))throw new Error(`Rejected ${nodeId}`);
    }
    const after=fire();s.actionSeq++;
    return {before,after,nodes:s.treeNodes};
  }, { id, plan });
  await expect.poll(()=>page.evaluate(()=>window.__game.presentation().materialEffects.active)).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath(`${id}-upgraded.png`),style:'#battle-overlay { display:none !important; }'});
  const view=await page.evaluate(()=>window.__game.presentation());
  if(id==='C01')expect(result.after.projectiles.length).toBeGreaterThan(result.before.projectiles.length);
  if(id==='C02'){
    const cues=result.after.events.filter(e=>e.kind==='arc'||e.kind==='beam');
    expect(cues.length).toBeGreaterThan(6);
    expect(view.visibleEffects.filter(e=>e.source===id&&(e.kind==='arc'||e.kind==='beam'))).toHaveLength(cues.length);
  }
  if(id==='C03')expect(result.after.events.filter(e=>e.kind==='hit').length).toBeGreaterThan(result.before.events.filter(e=>e.kind==='hit').length);
  if(id==='C04')expect(result.after.fields.length).toBeGreaterThan(result.before.fields.length);
  if(id==='C05')expect(result.after.projectiles[0].fire).toBeTruthy();
  if(id==='C07')expect(result.after.mines[0].radius).toBeGreaterThan(result.before.mines[0].radius);
  if(id==='C08')expect(result.after.projectiles[0].remaining).toBeGreaterThan(result.before.projectiles[0].remaining);
  if(id==='C06'){
    expect(view.materialEffects.drones).toHaveLength(5);
    expect(view.materialEffects.drones.every(d=>d.x-d.width/2>=0&&d.x+d.width/2<=390)).toBe(true);
    expect(result.after.events.filter(e=>e.kind==='beam')).toHaveLength(5);
  }
  expect(result.nodes).toEqual(expect.arrayContaining(plan));
  writeFileSync(info.outputPath(`${id}-growth.json`),JSON.stringify({result,view},null,2));
});
