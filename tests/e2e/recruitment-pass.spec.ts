import {test,expect,type Page} from '@playwright/test';
import {ready,reachable,fitsScreen} from '../helpers/mobile-ui';
async function choose(page:Page,id:string){const ids=await page.locator('.recruit-card-grid [data-action=recruit-preview]').evaluateAll(ns=>ns.map(n=>(n as HTMLElement).dataset.id));const picker=page.getByRole('combobox',{name:'獎池項目',exact:true});const size=Math.ceil(ids.length/await picker.locator('option').count());await picker.selectOption(String(Math.floor(ids.indexOf(id)/size)));return page.locator(`.recruit-card-grid [data-action=recruit-preview][data-id="${id}"]`);}
const forms=[['C07-original','shion-v1.webp'],['C07-summer','recruit-beach-v1.webp'],['C08-original','chika-v1.webp'],['C08-summer','recruit-beach-v1.webp'],['C07-original','shion-v1.webp']];
for(const viewport of [{width:320,height:500},{width:390,height:844},{width:1440,height:900}])test.describe(`recruitment pass ${viewport.width}`,()=>{
 test.use({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800});
 test('original and summer backgrounds survive repeated draw/exchange previews and return',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await page.locator('.game-dock [data-action=recruitment]').click();const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
  for(const tab of ['draw','exchange']){
   await page.locator(`[data-action=recruit-tab][data-id=${tab}]`).click();
   for(const [id,background] of forms){const trigger=await choose(page,id);await reachable(trigger);const img=trigger.locator('img');await expect(img).toHaveAttribute('data-portrait-backdrop',id);expect(await img.evaluate(e=>(e as HTMLElement).style.getPropertyValue('--portrait-background'))).toContain(background);await trigger.click();await expect(page.locator('.recruit-art-stage')).toHaveCSS('background-image',new RegExp(background.replace('.','\\.')));await expect(page.locator('.recruit-art-viewer img')).toHaveAttribute('data-portrait-backdrop',id);await page.getByRole('button',{name:'關閉大圖'}).click();await expect(trigger).toBeFocused();}
  }
  expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);expect(errors).toEqual([]);await fitsScreen(page);
 });
 test('result form uses its matching backdrop and shortage, busy and active-run states block spending',async({page})=>{
  await ready(page);await page.locator('.game-dock [data-action=recruitment]').click();await expect(page.locator('[data-action=draw]')).toBeDisabled();await reachable(page.locator('[data-action=draw]'));
  for(const [id,background] of forms.slice(0,4)){
   await page.evaluate(async id=>{const c=window.__game.getSave().collection;c.lastReceipt={id:++c.sequence,kind:'draw',formId:id as any,duplicate:false,spent:'ticket'};await window.__game.save();window.__game.route('recruitment');},id);
   const result=page.getByRole('button',{name:'招募結果',exact:true});if(await result.count())await result.click();const trigger=page.locator('.recruitment-receipt [data-action=recruit-preview]');await reachable(trigger);await expect(trigger.locator('img')).toHaveAttribute('data-portrait-backdrop',id);await trigger.click();await expect(page.locator('.recruit-art-stage')).toHaveCSS('background-image',new RegExp(background.replace('.','\\.')));await page.getByRole('button',{name:'關閉大圖'}).click();await expect(trigger).toBeFocused();if(await result.count())await page.keyboard.press('Escape');
  }
  const states=await page.evaluate(async()=>{const source='/src/ui/recruitment.ts';const {recruitment}=await import(source);const save=window.__game.getSave();save.collection.tickets=1;const target=document.createElement('div');const read=(html:string)=>{target.innerHTML=html;return (target.querySelector('[data-action=draw]') as HTMLButtonElement).disabled;};const busy=read(recruitment(save,true));const active=read(recruitment({...save,activeRun:{} as any}));const enabled=read(recruitment(save));return{busy,active,enabled};});expect(states).toEqual({busy:true,active:true,enabled:false});
 });
});
