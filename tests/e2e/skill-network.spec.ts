import {test,expect,type Page} from '@playwright/test';
async function node(page:Page,id:string){const target=page.locator(`[data-action="deep-node"][data-id="${id}"]`);await target.focus();await target.click();}
async function preview(page:Page){await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.evaluate(()=>window.__game.route('codex'));await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();}
for(const viewport of [{width:320,height:500},{width:390,height:844}])test(`complete mobile tree pans, zooms and retains camera at ${viewport.width}`,async({page},info)=>{
 await page.setViewportSize(viewport);await preview(page);const map=page.locator('.network-viewport');
 await expect(map.locator('.deep-node:visible')).toHaveCount(24);await expect(map).toHaveCSS('touch-action','none');
 const before=await page.evaluate(()=>structuredClone(window.__game.getSave()));
 const rect=(await map.boundingBox())!,start=await map.getAttribute('data-pan-x');
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+70,rect.y+rect.height/2+25,{steps:8});await page.mouse.up();
 expect(await map.getAttribute('data-pan-x')).not.toBe(start);await expect(page.locator('.personnel-skill-detail')).toContainText('點選節點');
 const scale=Number(await map.getAttribute('data-scale'));await page.getByRole('button',{name:'放大技能樹',exact:true}).click();expect(Number(await map.getAttribute('data-scale'))).toBeGreaterThan(scale);
 const zoom=await map.getAttribute('data-scale');const target=page.locator('[data-action="personnel-skill-node"][data-id="C01-A4/4"]');await target.focus();await page.keyboard.press('Enter');
 await expect(target).toBeInViewport();await expect(page.locator('.personnel-skill-detail')).toContainText('星雨掃射');await expect(map).toHaveAttribute('data-scale',zoom!);
 await page.locator('[data-action="personnel-skill-form"][data-id="C01-summer"]').click();await expect(map).toHaveAttribute('data-scale',zoom!);await expect(page.locator('.personnel-skill-detail')).toContainText('熔浪覆蓋');
 await page.getByRole('button',{name:'全覽',exact:true}).click();for(const n of await map.locator('.deep-node').all())await expect(n).toBeInViewport();
 await page.getByRole('button',{name:'起點',exact:true}).click();await expect(map.locator('.network-core')).toBeInViewport();
 for(const action of ['縮小技能樹','放大技能樹','全覽','起點'])await expect(page.getByRole('button',{name:action,exact:true})).toBeInViewport();
 await page.screenshot({path:info.outputPath(`network-mobile-${viewport.width}.png`)});expect(await page.evaluate(()=>window.__game.getSave())).toEqual(before);
});
test('two-finger pinch scales the whole map without selecting a skill',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Native multi-touch injection is provided by Chromium CDP.');await preview(page);const map=page.locator('.network-viewport'),r=(await map.boundingBox())!,x=r.x+r.width/2,y=r.y+r.height/2;
 const scale=Number(await map.getAttribute('data-scale')),session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(Number(await map.getAttribute('data-scale'))).toBeGreaterThan(scale*1.5);await expect(page.locator('.personnel-skill-detail')).toContainText('點選節點');await session.detach();
});
test('a pending merge keeps its other prerequisite and cross-route unlocks work in battle',async({page})=>{
 await page.routeWebSocket('**/*',s=>s.close());await page.goto('/');await page.waitForFunction(()=>!!window.__game);await page.locator('[data-action="start"]').click();await page.locator('#battle-loading').waitFor({state:'detached'});await page.locator('[data-action="tutorial-done"]').first().click();
 await page.evaluate(()=>{const s=window.__game.state()!;s.xp=180;s.choicesEarned=6;window.__game.ticks(1);for(const nodeId of ['C01-A4/0','C01-A4/1'])window.__game.command({type:'buy-node',offerId:s.draft!.id,nodeId});});
 await page.locator('[data-action="deep-owner"][data-id="C01"]').click();await node(page,'C01-A4/5');await node(page,'C01-A4/2');await node(page,'C01-A4/5');
 expect(await page.evaluate(()=>window.__game.state()!.draft!.pendingNodeIds)).toEqual(['C01-A4/2']);
 await node(page,'C01-B4/6');await expect(page.locator('[data-action="buy-node"]')).toBeEnabled();await page.locator('[data-action="buy-node"]').click();
 expect(await page.evaluate(()=>window.__game.state()!.treeNodes)).toEqual(['C01-A4/0','C01-A4/1','C01-A4/2','C01-B4/6']);
 await node(page,'C01-B4/3');await node(page,'C01-B4/7');await page.locator('[data-action="buy-node"]').click();
 await expect(page.locator('.tactical-tree')).toHaveCount(0);expect(await page.evaluate(()=>window.__game.state()!.choicesSpent)).toBe(6);
});
for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`routes stay readable and emphasize a selected cross-branch prerequisite at ${viewport.width}`,async({page},info)=>{
 await page.setViewportSize(viewport);await preview(page);
 await page.getByRole('button',{name:'關閉技能樹',exact:true}).click();
 await page.locator('.character-tabs [data-id="C02"]').click();
 await page.getByRole('button',{name:'技能樹與節點',exact:true}).click();
 await page.getByRole('button',{name:'全覽',exact:true}).click();
 const graph=page.locator('.skill-network');
 await expect(graph.locator('.deep-node')).toHaveCount(24);
 for(const n of await graph.locator('.deep-node').all())await expect(n).toBeInViewport();
 await page.screenshot({path:info.outputPath(`readable-overview-${viewport.width}.png`)});
 const target=graph.locator('[data-id="C02-A4/6"]');await target.focus();await page.keyboard.press('Enter');
 await expect(graph).toHaveAttribute('data-path-focus','C02-A4/6');
 expect(await graph.locator('.network-edges .focus-direct').evaluateAll(es=>es.map(e=>(e as SVGElement).dataset.parent).sort())).toEqual(['C02-A4/1','C02-A4/5','C02-B4/1']);
 await expect(graph.locator('.cross-route.focus-direct')).toHaveCount(1);
 await expect(graph.locator('[data-parent="C02-C4/0"][data-child="C02-C4/1"]')).toHaveCSS('opacity','0.15');
 await expect(page.locator('.personnel-skill-detail')).toContainText('或');
 await expect(graph.locator('.path-parent')).toHaveCount(3);
 await page.screenshot({path:info.outputPath(`readable-selected-${viewport.width}.png`)});
});
