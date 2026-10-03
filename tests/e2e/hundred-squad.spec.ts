import {test,expect} from '@playwright/test';
import {ready,reachable,fitsScreen} from '../helpers/mobile-ui';
import {FORM_MAP} from '../../src/data/forms';
import {CHARACTER_MAP} from '../../src/data/content';
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}])test.describe(`hundred squad ${viewport.width}`,()=>{
 test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
 test('names and true captain follow roster changes and persist',async({page})=>{
  await ready(page);await page.locator('.game-dock [data-action=hundred]').click();await expect(page.locator('.hundred-member')).toHaveCount(5);const captain=await page.evaluate(()=>window.__game.getSave().preferences.captainId);await expect(page.locator('.hundred-member.is-captain')).toHaveAttribute('data-id',captain);
  await page.getByRole('button',{name:'調整編隊',exact:true}).click();await page.locator('.squad-strip[data-id=C04]').click();await page.getByRole('button',{name:'設定隊長',exact:true}).click();await page.locator('.game-dock [data-action=hundred]').click();await expect(page.locator('.hundred-member.is-captain')).toHaveAttribute('data-id','C04');await expect(page.locator('.hundred-member.is-captain')).toContainText('隊長');
  await page.evaluate(async()=>{const s=window.__game.getSave();s.preferences.squadIds=['C02','C04','C06'];s.preferences.captainId='C06';s.collection.owned.push('C04-summer');s.collection.equipped.C04='C04-summer';await window.__game.save();window.__game.route('hundred');});
  await expect(page.locator('.hundred-member:not(.is-empty) strong')).toHaveText(['C02','C04','C06'].map(id=>CHARACTER_MAP[id as keyof typeof CHARACTER_MAP].name));await expect(page.locator('.hundred-member.is-empty')).toHaveCount(2);await expect(page.locator('.hundred-member.is-captain')).toHaveAttribute('data-id','C06');await expect(page.locator('.hundred-member[data-id=C04] img')).toHaveAttribute('data-portrait-theme','summer');await expect(page.locator('.hundred-member[data-id=C04] img')).toHaveAttribute('alt',`${CHARACTER_MAP.C04.name}・${FORM_MAP['C04-summer'].name}`);
  for(const el of await page.locator('.hundred-member figcaption').all())expect(await el.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1)).toBe(true);await fitsScreen(page);await reachable(page.getByRole('button',{name:'調整編隊',exact:true}));
  await page.reload();await page.waitForFunction(()=>!!window.__game);await page.locator('.game-dock [data-action=hundred]').click();await expect(page.locator('.hundred-member.is-captain')).toHaveAttribute('data-id','C06');await expect(page.locator('.hundred-member[data-id=C04] img')).toHaveAttribute('data-portrait-theme','summer');
 });
 test('zero, one, three and five members retain space and launch state',async({page})=>{
  await ready(page);for(const squad of [[],['C01'],['C01','C03','C05'],['C01','C02','C03','C04','C05']]){
   await page.evaluate(squad=>{const s=window.__game.getSave();s.preferences.squadIds=squad as any;s.preferences.captainId=(squad.at(-1)??'C01') as any;window.__game.route('hundred');},squad);await expect(page.locator('.hundred-member img')).toHaveCount(squad.length);await expect(page.locator('.hundred-member.is-empty')).toHaveCount(5-squad.length);await expect(page.locator('.hundred-member.is-captain')).toHaveCount(squad.length?1:0);if(squad.length)await expect(page.locator('[data-action=start-hundred]')).toBeEnabled();else await expect(page.locator('[data-action=start-hundred]')).toBeDisabled();await fitsScreen(page);
   for(const img of await page.locator('.hundred-member img').all()){await expect(img).toHaveCSS('object-fit','contain');expect((await img.boundingBox())!.height).toBeGreaterThan(30);}
  }
 });
});
