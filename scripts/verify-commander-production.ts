import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createDefaultSave} from '../src/storage/repository';

const base=new URL(process.env.PRODUCTION_URL??'https://willcoming.github.io/SurvivalTowerDefense/');
const output=process.env.VALIDATION_OUTPUT_DIR??'dist/commander-live';mkdirSync(output,{recursive:true});
const expected=process.env.EXPECTED_COMMIT;
const versionResponse=await fetch(new URL(`version.json${expected?`?v=${expected}`:''}`,base));assert.equal(versionResponse.status,200);
const version=await versionResponse.json() as {commit:string};if(expected)assert.equal(version.commit,expected);
const results=[];
for(const browserType of [chromium,webkit])for(const width of [390,1440]){
  const browser=await browserType.launch();const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
  try{
    const page=await context.newPage(),errors:string[]=[],assets=new Set<string>();page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);const url=new URL(r.url());if(url.origin===base.origin&&url.pathname.includes('/assets/'))assets.add(url.pathname);});
    await page.goto(base.href,{waitUntil:'networkidle'});await page.getByRole('button',{name:'指揮官成長與共用技能',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>!!window.__game),false,'Production must not expose developer controls');
    await page.getByRole('button',{name:'指揮官成長與共用技能',exact:true}).click();
    assert.equal(await page.locator('.commander-level strong').textContent(),'Lv.1');assert.equal(await page.locator('[data-action="commander-upgrade"][data-id="TEAM/0"]').isDisabled(),true);
    // Only this disposable browser context receives an old-format local save.
    const legacy=createDefaultSave();delete legacy.profile.commander;legacy.profile.cleared=['S01'];legacy.preferences.tutorialSeen=true;
    await page.evaluate(saved=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('starfall-defense',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put(saved,'save');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);}),legacy);
    await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'指揮官成長與共用技能',exact:true}).click();
    assert.equal(await page.locator('.commander-level strong').textContent(),'Lv.2');assert.equal(await page.locator('.commander-points strong').textContent(),'1');
    await page.locator('[data-action="commander-upgrade"][data-id="TEAM/0"]').click();await page.waitForFunction(()=>document.querySelector('.commander-points strong')?.textContent==='0');
    await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'指揮官成長與共用技能',exact:true}).click();assert.equal(await page.locator('.commander-points strong').textContent(),'0');
    assert.ok((await page.locator('[data-action="commander-upgrade"][data-id="TEAM/0"]').textContent())?.includes('已升級'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`${output}/${browserType.name()}-${width}-commander.png`});
    await page.getByRole('button',{name:'返回作戰中心',exact:true}).click();await page.locator('[data-action="start"]').click();await page.locator('#battle-loading').waitFor({state:'detached',timeout:60000});
    assert.ok((await page.locator('#wall-text').textContent())?.replaceAll(',','').includes('1100'));
    await page.locator('.range-toolbar [data-action="view-build"]').click();await page.locator('.tactical-tree').waitFor();
    assert.equal(await page.locator('[data-action="deep-owner"]').count(),5);assert.equal(await page.locator('[data-action="deep-owner"][data-id="common"]').count(),0);
    assert.ok((await page.locator('#deep-title').textContent())?.includes('/ 10 點'));
    await page.screenshot({path:`${output}/${browserType.name()}-${width}-battle.png`});
    assert.equal(assets.size>15,true);assert.ok([...assets].every(path=>path.startsWith(`${base.pathname}assets/`)));assert.deepEqual(errors,[]);
    results.push({browser:browserType.name(),width,passed:true,commanderLevel:2,pointsSpent:1,startingWall:1100,battlePoints:10,assetCount:assets.size});
    console.log(`${browserType.name()} ${width}: migration, upgrade, persistence and battle passed`);
  }finally{await context.close();await browser.close();}
}
writeFileSync(`${output}/verification.json`,JSON.stringify({passed:true,url:base.href,commit:version.commit,checkedAt:new Date().toISOString(),results},null,2)+'\n');
