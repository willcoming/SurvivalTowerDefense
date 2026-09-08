import { expect, test, type Page } from '@playwright/test';
import type { StageId } from '../../src/sim/types';

async function load(page:Page) {
  await page.routeWebSocket('**/*',socket=>socket.close());
  await page.goto('/');
  await page.waitForFunction(()=>!!window.__game);
  await page.locator('.mission-diorama').evaluate((img:HTMLImageElement)=>img.decode());
}
async function unlockHard(page:Page){
  await page.evaluate(()=>{const ids:StageId[]=['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','X01','X02','X03'];const s=window.__game.getSave();s.profile.cleared=[...ids];s.profile.easyCleared=[...ids];window.__game.route('home');});
}

test('each stage unlocks hard after its own easy victory and cannot start hard while locked',async({page})=>{
  await load(page);
  const hard=page.locator('[data-action="difficulty"][data-id="hard"]');
  await expect(hard).toBeDisabled();
  await page.evaluate(async()=>{await window.__game.start({stageId:'S01',difficulty:'hard',squadIds:['C01'],captainId:'C01',seed:17});});
  expect(await page.evaluate(()=>window.__game.getSave().activeRun)).toBeNull();
  await page.evaluate(async()=>{
    const engine='/src/sim/engine.ts',repository='/src/storage/repository.ts';
    const {createRun}=await import(engine),{completeRun}=await import(repository);
    const run=createRun({stageId:'S01',difficulty:'easy',squadIds:['C01'],captainId:'C01',seed:19});
    run.phase='ended';run.outcome='victory';run.wallHp=5;
    completeRun(window.__game.getSave(),run);await window.__game.save();window.__game.route('home');
  });
  await expect(hard).toBeEnabled();await hard.click();
  await page.getByRole('button',{name:'下一關',exact:true}).click();
  await expect(hard).toBeDisabled();
  await expect(page.locator('[data-action="difficulty"][data-id="easy"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action="preview-reward"][data-id="3"]').click();
  await expect(page.locator('.reward-ticket-icon b')).toHaveText('50');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'上一關',exact:true}).click();
  await expect(hard).toBeEnabled();await expect(hard).toHaveAttribute('aria-pressed','true');
  await page.reload();await page.waitForFunction(()=>!!window.__game);
  await expect(page.locator('.mission-lobby')).toHaveAttribute('data-stage','S02');
  await expect(hard).toBeDisabled();await page.getByRole('button',{name:'上一關',exact:true}).click();
  await expect(hard).toBeEnabled();
});

test('left/right stage navigation loads models without mutating rewards',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await load(page);
  await expect(page.getByRole('button',{name:'下一關',exact:true})).toBeDisabled();
  await expect(page.locator('.mission-rewards,.stage-picker-mount,.mission-tools-right')).toHaveCount(0);
  await expect(page.locator('.mission-start')).toHaveText('START開始作戰');
  await page.evaluate(()=>{window.__game.getSave().profile.cleared=['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','X01','X02','X03'];window.__game.route('home');});
  const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
  const stages=['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','X01','X02','X03'];
  for(const [index,id] of stages.entries()){
    if(index)await page.getByRole('button',{name:'下一關',exact:true}).click();
    await expect(page.locator('.mission-lobby')).toHaveAttribute('data-stage',id);
    await page.locator('.mission-diorama').evaluate((img:HTMLImageElement)=>img.decode());
  }
  await expect(page.getByRole('button',{name:'下一關',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'上一關',exact:true}).click();
  await expect(page.locator('.mission-lobby')).toHaveAttribute('data-stage','X02');
  expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);expect(errors).toEqual([]);
});

test('difficulty is selectable, persisted and carried into battle; reward rules are visible',async({page})=>{
  await load(page);await unlockHard(page);
  await expect(page.locator('.difficulty-options button')).toHaveCount(3);
  await expect(page.locator('[data-action="difficulty"][data-id="easy"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.durability-reward strong')).toHaveText(['耐久 1%','耐久 50%','耐久 100%']);
  await expect(page.locator('.durability-reward small,.durability-status,.difficulty-reward-note,.mission-squad-link')).toHaveCount(0);
  await page.locator('[data-action="difficulty"][data-id="hard"]').click();
  await expect(page.locator('[data-action="preview-reward"][data-id="3"]')).toHaveAttribute('aria-label','耐久 100%，招募券 3 張');
  await page.evaluate(()=>window.__game.save());await page.reload();await page.waitForFunction(()=>!!window.__game);
  await expect(page.locator('[data-action="difficulty"][data-id="hard"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action="preview-reward"][data-id="3"]').click();
  await expect(page.locator('.reward-ticket-icon b')).toHaveText('3');
  await expect(page.getByRole('dialog')).not.toContainText('累計');
  await expect(page.getByRole('dialog')).not.toContainText('尚未達成');
  await page.keyboard.press('Escape');
  await page.locator('.mission-start').click();await page.locator('#battle-loading').waitFor({state:'detached'});
  expect(await page.evaluate(()=>window.__game.state()!.config.difficulty)).toBe('hard');
  await expect(page.locator('.commander-profile small')).toContainText('困難');
});

test('tactical page separates wave composition from enemy details',async({page})=>{
  await load(page);await page.getByRole('button',{name:'作戰功能與說明'}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-page','command');
  await page.getByRole('tab',{name:'波次',exact:true}).click();
  await expect(page.locator('.tactical-wave-list article')).toHaveCount(4);
  await expect(page.locator('.tactical-enemy-list')).toHaveCount(0);
  await page.getByRole('tab',{name:'敵情',exact:true}).click();
  await expect(page.locator('.tactical-enemy-list article')).not.toHaveCount(0);
  await expect(page.locator('.tactical-wave-list')).toHaveCount(0);
});

test('durability reward checks follow each difficulty entitlement',async({page})=>{
  await load(page);await unlockHard(page);
  await page.evaluate(()=>{window.__game.getSave().collection.difficultyClaims={'S01:easy':2,'S01:hard':1};window.__game.route('home');});
  await expect(page.locator('.durability-case .chest-open')).toHaveCount(2);
  await expect(page.locator('.durability-case .chest-closed')).toHaveCount(1);
  await page.locator('[data-action="difficulty"][data-id="hard"]').click();
  await expect(page.locator('.durability-case .chest-open')).toHaveCount(1);
  await expect(page.locator('.durability-case .chest-closed')).toHaveCount(2);
});

test('each chest previews its reward without claiming and reflects open/closed state',async({page})=>{
  await load(page);await unlockHard(page);
  await expect(page.locator('.chest-closed')).toHaveCount(3);
  await expect(page.locator('.chest-open')).toHaveCount(0);
  const before=await page.evaluate(()=>structuredClone(window.__game.getSave().collection));
  for(const difficulty of ['easy','hard']){
    await page.locator(`[data-action="difficulty"][data-id="${difficulty}"]`).click();
    for(let tier=1;tier<=3;tier++){
      const chest=page.locator(`[data-action="preview-reward"][data-id="${tier}"]`);
      await chest.click();
      await expect(page.getByRole('heading',{name:'獎勵一覽',exact:true})).toBeVisible();
      await expect(page.locator('.reward-ticket-icon b')).toHaveText(`${difficulty==='hard'?tier:[25,25,50][tier-1]}`);
      await expect(page.locator('.reward-preview-condition')).toContainText(`耐久 ${[1,50,100][tier-1]}%`);
      await page.keyboard.press('Escape');await expect(chest).toBeFocused();
    }
  }
  expect(await page.evaluate(()=>window.__game.getSave().collection)).toEqual(before);
  await page.evaluate(()=>{window.__game.getSave().collection.difficultyClaims={'S01:hard':2};window.__game.route('home');});
  await expect(page.locator('.chest-open')).toHaveCount(2);
  await expect(page.locator('.chest-closed')).toHaveCount(1);
  await page.locator('[data-action="preview-reward"][data-id="2"]').click();
  await expect(page.locator('.reward-ticket-icon b')).toHaveText('2');
  await expect(page.locator('.reward-preview-status,.reward-preview-rule')).toHaveCount(0);
  await page.getByRole('button',{name:'關閉獎勵一覽'}).click();
  await page.locator('[data-action="preview-reward"][data-id="3"]').click();
  await expect(page.locator('.reward-ticket-icon b')).toHaveText('3');
});

test('question mark opens a full page with only three keyboard-accessible information tabs',async({page})=>{
  await load(page);
  await expect(page.locator('.mission-tools,.mission-kicker')).toHaveCount(0);
  const menu=page.getByRole('button',{name:'作戰功能與說明'});
  const before=await page.evaluate(()=>structuredClone(window.__game.getSave()));
  await menu.click();
  await expect(page.getByRole('heading',{name:'戰術指揮台',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveText(['情報','波次','敵情']);
  await expect(page.locator('.tactical-command-screen [data-action="command-auto"],.command-menu-grid')).toHaveCount(0);
  await page.getByRole('tab',{name:'情報',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'波次',exact:true})).toBeFocused();
  await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'敵情',exact:true})).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'情報',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(menu).toBeFocused();
  expect(await page.evaluate(()=>window.__game.getSave())).toEqual(before);
});
