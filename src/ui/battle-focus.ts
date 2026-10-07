/** Reorganize live HUD nodes without changing combat or replacing cached elements. */
export function enhanceBattleFocus(root: HTMLElement) {
  const layout = root.querySelector<HTMLElement>('.battle-layout');
  if (!layout) return;
  layout.classList.add('battle-focused');
  const toolbar = layout.querySelector<HTMLElement>('.range-toolbar')!;
  const details = document.createElement('details');
  details.className = 'battle-intel';
  const trigger = document.createElement('summary');
  trigger.textContent = 'ⓘ';
  trigger.setAttribute('aria-label', '隊伍／情報');
  trigger.title = '隊伍／情報';
  const body = document.createElement('div');
  body.className = 'battle-intel-body';
  body.setAttribute('aria-label', '隊伍與戰況資訊');
  for (const selector of ['.xp-caption', '#evolution-text', '#operation-event', '#weapon-strip', '#mechanic-readout', '#range-info', '.ultimate-strip']) {
    const node = layout.querySelector<HTMLElement>(selector);
    if (node) body.append(node);
  }
  details.append(trigger, body);
  toolbar.prepend(details);
  const commands = document.createElement('button');
  commands.type = 'button';
  commands.dataset.action = 'command-panel';
  commands.dataset.id = 'shortcuts';
  commands.setAttribute('aria-label', '開啟快捷選單');
  commands.setAttribute('aria-haspopup', 'dialog');
  commands.textContent = '☰';
  commands.title = '指揮選單';
  const build = toolbar.querySelector<HTMLButtonElement>('[data-action="view-build"]');
  if (build) { build.textContent = '✦'; build.title = '查看本局構築'; }
  const legend = document.createElement('p');
  legend.className = 'battle-legend';
  legend.textContent = '點敵人集火，再點取消；紅色虛線亮起表示敵人逼近。敵人頭上圖示＝屬性弱點；角色下方細條＝終極技冷卻，填滿後自動觸發。灰色表示尚未取得。';
  body.append(legend);
  toolbar.append(commands);
  toolbar.addEventListener('click', event => {
    if ((event.target as HTMLElement).closest('[data-action="view-build"],[data-action="command-panel"]')) details.open = false;
  });
}
