import {test,expect} from '@playwright/test';
import {ready,reachable,fitsScreen} from '../helpers/mobile-ui';
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}])test.describe(`seaside recruitment ${viewport.width}`,()=>{
 test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
 test('actual seaside assets and character pool survive navigation and preview',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));await page.locator('.game-dock [data-action=recruitment]').click();
  await expect(page.locator('.recruit-item')).toHaveCount(10);const ids=await page.locator('.recruit-card-grid [data-action=recruit-preview]').evaluateAll(ns=>ns.map(n=>(n as HTMLElement).dataset.id));expect(new Set(ids).size).toBe(10);expect(ids).toContain('C07-original');expect(ids).toContain('C07-summer');expect(ids).toContain('C08-original');expect(ids).toContain('C08-summer');
  const background=await page.locator('.game-world').evaluate(e=>getComputedStyle(e).backgroundImage);expect(background).toContain('recruit-beach-v1.webp');
  await page.evaluate(async()=>{const img=new Image();img.src='/assets/portrait-backgrounds/recruit-beach-v1.webp';await img.decode();if(img.naturalWidth<1000)throw Error('Background failed to load');});
  const picker=page.getByRole('combobox',{name:'獎池項目',exact:true});if(await picker.count())for(const option of await picker.locator('option').all()){await picker.selectOption((await option.getAttribute('value'))!);const art=page.locator('.recruit-card-grid .recruit-item:not([hidden]) img').first();const summer=(await art.getAttribute('data-portrait-theme'))==='summer';await expect(art).toHaveCSS('object-fit',viewport.width<800&&viewport.height>740&&summer?'cover':'contain');}
  if(await picker.count())await picker.selectOption('0');await reachable(page.locator('[data-action=draw]'));expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);await fitsScreen(page);await page.waitForTimeout(500);await page.screenshot({path:info.outputPath(`seaside-${viewport.width}.png`)});
  const art=page.locator('.recruit-card-grid .recruit-image-button').first();await art.click();await expect(page.locator('.recruit-art-viewer img')).toHaveCSS('object-fit','contain');await expect.poll(()=>page.locator('.recruit-art-stage').evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('recruit-beach-v1.webp');await page.getByRole('button',{name:'關閉大圖'}).click();await expect(art).toBeFocused();
  expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);await page.locator('.game-dock [data-action=home]').click();expect(await page.locator('.game-world').evaluate(e=>getComputedStyle(e).backgroundImage)).not.toContain('recruit-beach-v1.webp');expect(errors).toEqual([]);
 });
});
