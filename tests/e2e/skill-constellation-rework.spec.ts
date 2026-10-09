import { expect, test, type Locator, type Page } from '@playwright/test';
import { finishWave, ready, reachable, startBattle } from '../helpers/mobile-ui';

const viewports=[{width:320,height:500},{width:390,height:844},{width:768,height:1024},{width:1023,height:800},{width:1024,height:768},{width:1440,height:900}];

async function selectedNodeStaysVisible(node:Locator,sheet:Locator){
  await expect.poll(async()=>{
    const covered=await sheet.boundingBox();
    return node.evaluate((el,detail)=>{
      const r=el.getBoundingClientRect(),v=el.closest('.network-viewport')!.getBoundingClientRect();
      const center={x:r.left+r.width/2,y:r.top+r.height/2};
      const occluded=detail&&center.x>=detail.x&&center.x<=detail.x+detail.width&&center.y>=detail.y&&center.y<=detail.y+detail.height;
      return !occluded&&r.left>=v.left-1&&r.right<=v.right+1&&r.top>=v.top-1&&r.bottom<=v.bottom+1&&el.contains(document.elementFromPoint(center.x,center.y));
    },covered);
  }).toBe(true);
}

async function allBranchesFitHorizontally(page:Page){
  await expect(page.locator('.skill-network .deep-node')).toHaveCount(24);
  await expect.poll(()=>page.locator('.skill-network').evaluate(map=>{
    const view=map.closest('.network-viewport')!.getBoundingClientRect();
    return [...map.querySelectorAll('.deep-node')].every(node=>[node,node.querySelector('strong')!,...node.querySelectorAll('.ultimate-orbits')].every(part=>{
      const rect=part.getBoundingClientRect();return rect.left>=view.left-1&&rect.right<=view.right+1;
    }));
  })).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}

for(const viewport of viewports){
  test.describe(`constellation archive ${viewport.width}`,()=>{
    test.use({isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
    test('fits every branch and keeps selected skills visible beside read-only details',async({page},info)=>{
      await page.setViewportSize(viewport);await ready(page);await page.evaluate(()=>window.__game.route('codex'));
      const collection=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
      await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
      await allBranchesFitHorizontally(page);
      await expect(page.locator('.skill-network .deep-node .node-symbol > svg[data-emblem]')).toHaveCount(24);
      const categories=await page.locator('.skill-network .deep-node svg[data-emblem]').evaluateAll(icons=>[...new Set(icons.map(icon=>icon.getAttribute('data-emblem')))]);
      expect(categories.length).toBeGreaterThanOrEqual(5);
      await expect(page.locator('.network-viewport .network-gesture-hint')).toHaveCount(0);
      const sheet=page.locator('.skill-bottom-sheet');
      if(viewport.width>=1024){
        await expect(sheet).toBeVisible();
        const mapBox=(await page.locator('.network-viewport').boundingBox())!,sheetBox=(await sheet.boundingBox())!;
        expect(mapBox.x+mapBox.width).toBeLessThanOrEqual(sheetBox.x+1);
        expect(sheetBox.width).toBeGreaterThanOrEqual(320);expect(sheetBox.width).toBeLessThanOrEqual(360);
      }
      const ultimate=page.locator('[data-action=personnel-skill-node].ultimate');
      await ultimate.focus();await ultimate.press('Enter');
      await expect(sheet).toHaveAttribute('data-open','true');
      await expect(sheet.locator('.node-status')).toHaveText('圖鑑預覽');
      await expect(sheet.locator('[data-action=buy-node]')).toHaveCount(0);
      expect(await sheet.evaluate(el=>el.matches(':modal'))).toBe(false);
      await selectedNodeStaysVisible(ultimate,sheet);
      await expect(sheet.locator('.node-detail-icon')).toHaveCSS('width','44px');
      if(viewport.width<1024){
        const box=(await sheet.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(140);expect(box.height).toBeLessThanOrEqual(156);
        expect(box.y).toBeGreaterThan(viewport.height/2);
      }
      await reachable(sheet.getByRole('button',{name:'關閉',exact:true}));
      await page.getByRole('button',{name:'夏日換裝',exact:true}).click();
      await expect(page.locator('.personnel-skills-dialog .deep-node')).toHaveCount(24);
      await ultimate.focus();await ultimate.press('Enter');
      await expect(sheet.locator('.node-effect')).toContainText('冷卻');
      await expect(sheet).toContainText('熔浪覆蓋');
      await selectedNodeStaysVisible(ultimate,sheet);
      expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(collection);
      if(viewport.width===390||viewport.width===1440)await page.screenshot({path:info.outputPath(`archive-sheet-${viewport.width}.png`)});
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveAttribute('data-open','false');await expect(ultimate).toBeFocused();
      await expect(page.locator('.personnel-skills-dialog')).toBeVisible();
    });
  });
}

test('branch badges and dropdown highlight matching nodes and connections without allocating points',async({page})=>{
  await ready(page);await startBattle(page);await finishWave(page);
  const before=await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,nodes:window.__game.state()!.treeNodes,tick:window.__game.state()!.tick}));
  const map=page.locator('.skill-network'),branch='C01-B4';
  await expect(page.locator('.network-branch-badge')).toHaveCount(3);
  await page.locator(`.network-branch-badge[data-map-branch="${branch}"]`).click();
  await expect(map).toHaveAttribute('data-branch-focus',branch);
  await expect(page.getByRole('combobox',{name:'聚焦分支',exact:true})).toHaveValue(branch);
  await expect(map.locator(`.deep-node[data-tree="${branch}"]:not(.branch-highlight)`)).toHaveCount(0);
  await expect(map.locator(`.deep-node.branch-highlight:not([data-tree="${branch}"])`)).toHaveCount(0);
  expect(await map.locator('.network-edges path.branch-highlight[data-child]').count()).toBeGreaterThan(0);
  await page.getByRole('combobox',{name:'聚焦分支',exact:true}).selectOption('C01-C4');
  await expect(map).toHaveAttribute('data-branch-focus','C01-C4');
  await expect(page.locator('.network-branch-badge[data-map-branch="C01-C4"]')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('combobox',{name:'聚焦分支',exact:true}).selectOption('');
  await expect(map).not.toHaveAttribute('data-branch-focus',/./);
  await expect(map.locator('.branch-highlight,.outside-focused-branch')).toHaveCount(0);
  await allBranchesFitHorizontally(page);
  expect(await page.evaluate(()=>({spent:window.__game.state()!.choicesSpent,nodes:window.__game.state()!.treeNodes,tick:window.__game.state()!.tick}))).toEqual(before);
  expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds??[])).toEqual([]);
});

test('readable list keeps keyboard focus through selection, confirmation and detail close',async({page})=>{
  await ready(page);await startBattle(page);await finishWave(page);
  const spent=await page.evaluate(()=>window.__game.state()!.choicesSpent);
  await page.getByRole('button',{name:'技能列表',exact:true}).click();
  const list=page.getByRole('region',{name:'可讀技能列表',exact:true});
  const entry=list.locator('.skill-list-node[data-id="C01-A4/0"]');
  await entry.focus();await entry.press('Enter');
  const sheet=page.locator('.skill-bottom-sheet[data-open=true]');
  await expect(sheet).toBeVisible();await expect(entry).toBeFocused();
  await expect(page.locator('.network-viewport')).toHaveAttribute('inert','');
  await expect(sheet.locator('.node-status')).toHaveText('待確認');
  expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(spent);
  const confirm=sheet.locator('[data-action=buy-node]');await confirm.focus();await confirm.press('Enter');
  await expect(sheet.locator('.node-status')).toHaveText('已取得');await expect(confirm).toBeDisabled();
  await expect(entry).toBeFocused();await expect(entry).toHaveClass(/owned/);
  expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(spent+1);
  await sheet.getByRole('button',{name:'關閉',exact:true}).click();
  await expect(page.locator('.skill-bottom-sheet')).toHaveAttribute('data-open','false');
  await expect(entry).toBeFocused();await expect(list).toBeVisible();
  expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual([]);
});

test.describe('desktop squad stats',()=>{
test.use({isMobile:false,hasTouch:false});
test('desktop shows before and after stats for the actual affected squad without simulating combat',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await ready(page);await startBattle(page);await finishWave(page);
  await page.evaluate(async()=>{
    const path='/src/data/battle-experience.ts';const {battleXpAt}=await import(path),s=window.__game.state()!;
    s.xp=battleXpAt(9);s.choicesEarned=8;s.draft!.pointTarget=8;
    for(const nodeId of ['C06-B4/0','C06-B4/1'])window.__game.command({type:'buy-node',offerId:s.draft!.id,nodeId});
  });
  const purePreview=await page.evaluate(async()=>{
    const path='/src/ui/skill-stat-preview.ts';const {skillStatComparison}=await import(path),s=window.__game.state()!;
    const before=JSON.stringify(s),storage=JSON.stringify({...localStorage});
    const first=skillStatComparison(s,'C06','C06-B4/2'),second=skillStatComparison(s,'C06','C06-B4/2');
    return {unchanged:before===JSON.stringify(s),storageUnchanged:storage===JSON.stringify({...localStorage}),repeatable:JSON.stringify(first)===JSON.stringify(second),squad:s.config.squadIds,affected:first.filter((row:{changed:boolean})=>row.changed).map((row:{ownerId:string})=>row.ownerId)};
  });
  expect(purePreview.unchanged).toBe(true);expect(purePreview.storageUnchanged).toBe(true);expect(purePreview.repeatable).toBe(true);
  // C06's 0.5-second interval remains 15 simulation ticks after rounding this 6% bonus.
  expect([...purePreview.affected].sort()).toEqual(purePreview.squad.filter(id=>id!=='C06').sort());
  await page.locator('[data-action=deep-owner][data-id=C06]').click();
  const skill=page.locator('[data-action=deep-node][data-id="C06-B4/2"]');await skill.focus();await skill.press('Enter');
  const stats=page.locator('.skill-stat-preview');await expect(stats).toBeVisible();await expect(stats).toContainText('配置前 → 配置後');
  const displayed=await stats.locator('[data-stat-owner]').evaluateAll(rows=>rows.map(row=>(row as HTMLElement).dataset.statOwner));
  expect(displayed.sort()).toEqual([...purePreview.squad].sort());
  for(const row of await stats.locator('[data-stat=interval]').all()){
    const before=Number(await row.getAttribute('data-before')),after=Number(await row.getAttribute('data-after'));
    expect(after).toBeLessThanOrEqual(before);
  }
  expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(2);
});
});

test('reduced motion keeps state and ultimate distinctions while stopping decorative animation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await startBattle(page);await finishWave(page);
  await expect(page.locator('.deep-node.available')).not.toHaveCount(0);
  const ultimate=page.locator('.deep-node.ultimate');
  await expect(ultimate.locator('.ultimate-orbits i')).toHaveCount(2);
  expect(await ultimate.evaluate(el=>(el as HTMLElement).offsetWidth)).toBe(60);
  const animations=await page.locator('.skill-network').evaluate(map=>[map,...map.querySelectorAll('*')].flatMap(el=>[null,'::before','::after'].map(pseudo=>{
    const style=getComputedStyle(el,pseudo);return {name:style.animationName,duration:style.animationDuration};
  })).filter(style=>style.name!=='none'&&style.duration.split(',').some(value=>parseFloat(value)>0.001)));
  expect(animations).toEqual([]);
  const node=page.locator('[data-action=deep-node][data-id="C01-A4/0"]');await node.focus();await node.press('Enter');
  await expect(page.locator('.skill-bottom-sheet[data-open=true]')).toBeVisible();
  await expect(page.locator('[data-action=buy-node]')).toBeEnabled();
  await selectedNodeStaysVisible(node,page.locator('.skill-bottom-sheet'));
});
