import {test,expect} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
test('mobile viewport: dense v3 combat keeps advancing with legal tactical skills',async({page},info)=>{
 test.skip(info.project.name!=='chromium','Single desktop renderer measurement; not physical-phone evidence.');test.setTimeout(45000);
 await page.setViewportSize({width:390,height:844});await page.routeWebSocket('**/*',s=>s.close());const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.evaluate(()=>window.__game.start({stageId:'S12',squadIds:['C01','C02','C04','C05','C06'],captainId:'C06',seed:101}));
 await page.locator('#battle-loading').waitFor({state:'detached'});const tutorial=page.locator('[data-action="tutorial-done"]').first();if(await tutorial.isVisible())await tutorial.click();
 await page.evaluate(async()=>{
  const cp='/src/sim/combat.ts',dp='/src/sim/draft.ts',ep='/src/sim/engine.ts';const {createEnemy}=await import(cp),{openDraft}=await import(dp),{command}=await import(ep);const s=window.__game.state()!;
  s.enemies=[];s.spawnCursor=s.spawnPlan.length;s.bossSpawned=true;s.bossKilled=false;s.xp=360;s.choicesEarned=12;openDraft(s);
  for(const tree of ['C01-A4','C06-C4'])for(let i=0;i<5;i++)if(!command(s,{type:'buy-node',offerId:s.draft!.id,nodeId:`${tree}/${i}`}))throw Error('Illegal stress fixture');
  for(let i=0;i<120;i++){const e=createEnemy(s,(['E01','E02','E03','E04','E05','E06','E07','E08'] as const)[i%8],35+i%10*35,30+Math.floor(i/10)*25,0,9);e.hp=e.maxHp=1e9;}
 });
 const stats=await page.evaluate(()=>new Promise<{frames:number[];ticks:number;peak:number;outcome:string|null}>(resolve=>{const start=performance.now(),tick=window.__game.state()!.tick;let last=start,peak=0;const frames:number[]=[];const run=(now:number)=>{const s=window.__game.state()!;frames.push(now-last);last=now;s.wallHp=s.wallMaxHp;for(const e of s.enemies)if(e.y>405)e.y=40;peak=Math.max(peak,s.enemies.length);if(now-start<15000)requestAnimationFrame(run);else resolve({frames,ticks:s.tick-tick,peak,outcome:s.outcome});};requestAnimationFrame(run);}));
 const sorted=[...stats.frames].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)];const dir=process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/tactical-rework';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/mobile-viewport-performance.json`,JSON.stringify({measuredAt:new Date().toISOString(),viewport:{width:390,height:844},...stats,p95FrameMs:p95,passedFrameBudget:p95<=33.33,errors,limitation:'Desktop Chromium mobile viewport; synthetic immortal/recycled targets and replenished wall sustain load. Actual new skills acquired legally; no physical-phone measurement.'},null,2));
 expect(errors).toEqual([]);expect(stats.ticks).toBeGreaterThan(200);expect(stats.peak).toBeGreaterThanOrEqual(100);expect(stats.outcome).toBeNull();await page.screenshot({path:info.outputPath('mobile-dense-tactical.png')});
});
