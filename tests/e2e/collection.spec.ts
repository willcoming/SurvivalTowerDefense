import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const dir=(process.env.VALIDATION_OUTPUT_DIR??'artifacts/validation/0.4.0-dev.1')+'/screenshots/collection';
mkdirSync(dir,{recursive:true});
async function ready(page:Page){await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);}
async function seed(page:Page,kind:'tickets'|'exchange'|'complete'|'forms'){
  await page.evaluate(async kind=>{const s=window.__game.getSave();if(kind==='tickets')s.profile.cleared=['S01','S02','S03'];if(kind==='exchange')s.collection.fragments=100;
    if(kind==='forms')s.collection.owned.push('C07-original','C07-summer','C08-original','C08-summer');
    if(kind==='complete'){const p='/src/data/campaign.ts';const {MAIN_IDS,SIDE_IDS,CHALLENGES}=await import(p);s.profile.cleared=[...MAIN_IDS,...SIDE_IDS];s.profile.challengeClears=MAIN_IDS.flatMap((id:string)=>CHALLENGES.map((c:string)=>id+':'+c));}
    await window.__game.save();
  },kind);await page.reload();await page.waitForFunction(()=>!!window.__game);
}
test('COLLECTION: free pool, disabled draws, full artwork and responsive layouts',async({page},info)=>{
  const errors:string[]=[],loaded=new Set<string>();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());if(r.ok())loaded.add(new URL(r.url()).pathname);});await ready(page);await page.locator('.main-nav [data-action="recruitment"]').click();
  await expect(page.locator('.collection-card')).toHaveCount(10);await expect(page.locator('[data-action="draw"]')).toBeDisabled();
  await expect(page.locator('.collection-card').filter({hasText:'晴海狙擊'})).toHaveCount(1);await expect(page.locator('.collection-card').filter({hasText:'深藍潛航'})).toHaveCount(0);
  for(const [width,height] of [[320,720],[768,1024],[1024,1400],[1440,1600]]){
    await page.setViewportSize({width,height});for(const card of await page.locator('.collection-card').all()){await card.scrollIntoViewIfNeeded();await expect.poll(()=>card.locator('img').evaluate(i=>(i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);}await page.locator('.recruitment-banner').scrollIntoViewIfNeeded();
    await expect.poll(()=>page.locator('.collection-card img').evaluateAll(imgs=>imgs.every(i=>(i as HTMLImageElement).naturalWidth>0))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:dir+'/'+info.project.name+'-collection-'+width+'.png',fullPage:true});
  }expect(errors).toEqual([]);for(const owner of ['C07','C08'])for(const theme of ['original','summer'])expect(loaded.has(`/assets/forms/${owner}-${theme}-${theme==='summer'?'pose-v4':'stage-v3'}.webp`)).toBe(true);
  expect([...loaded].some(path=>/\/C0[78]-(original|summer)(-stage-v2)?\.webp$|\/C0[78]-summer-stage-v3\.webp$/.test(path))).toBe(false);
});
test('COLLECTION: a double click draws once, commits first, and survives reload',async({page})=>{
  await ready(page);await seed(page,'tickets');await page.locator('.main-nav [data-action="recruitment"]').click();
  expect(await page.evaluate(()=>window.__game.getSave().collection.tickets)).toBe(3);
  await page.locator('[data-action="draw"]').evaluate(b=>{(b as HTMLButtonElement).click();(b as HTMLButtonElement).click();});
  await expect(page.locator('.recruitment-receipt')).toBeVisible();
  const c=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));expect(c.tickets).toBe(2);expect(c.sequence).toBe(1);
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('.main-nav [data-action="recruitment"]').click();
  expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(c);await expect(page.locator('.recruitment-receipt')).toContainText('#1');
});
test('COLLECTION: summer-first exchange directly unlocks one character, not original form',async({page},info)=>{
  await ready(page);await seed(page,'exchange');await page.locator('.main-nav [data-action="recruitment"]').click();await page.locator('[data-action="exchange"][data-id="C07-summer"]').click();
  await expect(page.locator('.recruitment-receipt')).toContainText('汐音');await page.locator('.main-nav [data-action="roster"]').click();
  await expect(page.locator('#form-C07')).toHaveValue('C07-summer');await expect(page.locator('#form-C07 option[value="C07-original"]')).toBeDisabled();
  await page.locator('.filled-slot').first().click();await page.locator('.add-character[data-id="C07"]').click();await page.locator('.captain-button[data-id="C07"]').click();
  await page.locator('[data-action="start"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
  await expect(page.locator('#mechanic-readout')).toContainText('地雷');await expect(page.locator('#range-C07 .element-badge')).toContainText('電漿');
  expect(await page.evaluate(()=>window.__game.state()!.config.forms!.C07)).toBe('C07-summer');
  await page.screenshot({path:dir+'/'+info.project.name+'-summer-first.png'});
});
test('COLLECTION: all 51 goals grant full collection once and stop spending',async({page})=>{
  await ready(page);await seed(page,'complete');await page.locator('.main-nav [data-action="recruitment"]').click();await expect(page.locator('[data-action="draw"]')).toHaveText('本期已全收集');await expect(page.locator('[data-action="draw"]')).toBeDisabled();
  const c=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));expect(c.owned).toHaveLength(16);expect(c.claimed).toHaveLength(51);expect([c.tickets,c.points]).toEqual([15,900]);
  await page.reload();await page.waitForFunction(()=>!!window.__game);expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(c);
});
test('COLLECTION: codex keyboard navigation and native form selection use current artwork without old portraits',async({page},info)=>{
  const errors:string[]=[],loaded=new Set<string>();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());if(r.ok())loaded.add(new URL(r.url()).pathname);});
  await ready(page);await seed(page,'forms');await page.locator('.main-nav [data-action="codex"]').focus();await page.keyboard.press('Enter');
  for(const id of ['C07','C08'] as const){
    const tab=page.locator(`.character-tabs [data-id="${id}"]`);await tab.focus();await page.keyboard.press('Space');
    await expect(page.locator('.weapon-info img')).toHaveAttribute('alt',id==='C07'?'預置共振雷':'高熱旋轉砲');
    const control=page.locator(`#form-${id}`);await control.focus();
    // Mobile headless WebKit does not drive native select popups with arrow keys,
    // also reproducible on a standalone two-option HTML select. Keep real keyboard
    // navigation for buttons/focus and use its supported native-option driver.
    if(info.project.name==='webkit')await control.selectOption(`${id}-summer`);else{await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');}await expect(control).toHaveValue(`${id}-summer`);
    await expect(page.locator('.dossier-art img')).toHaveAttribute('alt',id==='C07'?'汐音・潮汐布雷師':'熾夏・海風快槍');await expect(page.locator('.weapon-info img')).toHaveAttribute('src',/^data:image/);
    await page.screenshot({path:dir+'/'+info.project.name+'-'+id+'-codex.png'});
    await control.focus();if(info.project.name==='webkit')await control.selectOption(`${id}-original`);else{await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');}await expect(control).toHaveValue(`${id}-original`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  for(const id of ['C07','C08'])expect(loaded.has(`/assets/forms/${id}-summer-pose-v4.webp`)).toBe(true);
  expect([...loaded].some(path=>/\/C0[78]-(original|summer)(-stage-v2)?\.webp$|\/C0[78]-summer-stage-v3\.webp$/.test(path))).toBe(false);expect(errors).toEqual([]);
});
test('COLLECTION: new captain mechanics, elemental portraits, skills and restore',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await seed(page,'forms');
  for(const theme of ['original','summer'] as const)for(const captainId of ['C07','C08'] as const){
    await page.evaluate(async({captainId,theme})=>{const s=window.__game.getSave();s.preferences.tutorialSeen=true;const loading=window.__game.start({stageId:'S04',squadIds:['C07','C08','C06'],captainId,seed:101,forms:{C07:`C07-${theme}`,C08:`C08-${theme}`}});window.__game.command({type:'pause',reason:'user'});await loading;},{captainId,theme});
    await page.locator('#battle-loading').waitFor({state:'detached'});
    await page.evaluate(async()=>{const api=window.__game,s=api.state()!;const p='/src/sim/combat.ts';const {createEnemy}=await import(p);const e=createEnemy(s,'E03',195,250);e.hp=e.maxHp=100000;e.speed=0;e.attackAt=s.tick+90000;s.tacticalReadyAt=0;api.command({type:'resume',reason:'user'});api.ticks(80);});
    await expect(page.locator('#tactical-button')).toBeEnabled();await page.locator('#tactical-button').click();
    await expect.poll(()=>page.evaluate(()=>window.__game.presentation().cutin.visible)).toBe(true);
    await page.screenshot({path:dir+'/'+info.project.name+'-'+captainId+'-'+theme+'-skill.png'});
    await page.setViewportSize({width:320,height:720});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(page.locator('#tactical-button')).toBeInViewport();await page.screenshot({path:dir+'/'+info.project.name+'-'+captainId+'-'+theme+'-battle-320.png'});await page.setViewportSize({width:390,height:844});
    await page.locator('[data-action="pause"]').click();
    const before=await page.evaluate(async()=>{await window.__game.save();return structuredClone(window.__game.state()!);});
    await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="continue"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});
    const after=await page.evaluate(()=>window.__game.state()!);expect(after.weapons).toEqual(before.weapons);expect(after.mines).toEqual(before.mines);expect(after.config.forms).toEqual(before.config.forms);
    await expect(page.locator('#range-C08 .element-badge')).toContainText(theme==='summer'?'電弧':'熱能');await expect(page.locator('#range-C07 .element-badge')).toContainText(theme==='summer'?'電漿':'動能');await expect(page.locator('#range-C07 img')).toHaveAttribute('src',/^data:image/);
  }expect(errors).toEqual([]);
});
