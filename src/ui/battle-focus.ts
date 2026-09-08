/** Reorganize live HUD nodes without changing combat or replacing cached elements. */
export function enhanceBattleFocus(root: HTMLElement) {
  const layout = root.querySelector<HTMLElement>('.battle-layout');
  if (!layout) return;
  layout.classList.add('battle-focused');
  const toolbar = layout.querySelector<HTMLElement>('.range-toolbar')!;
  const details = document.createElement('details');
  details.className = 'battle-intel';
  const trigger = document.createElement('summary');
  trigger.textContent = '隊伍／情報';
  const body = document.createElement('div');
  body.className = 'battle-intel-body';
  body.setAttribute('aria-label', '隊伍與戰況資訊');
  for (const selector of ['#wave-text', '.xp-caption', '#evolution-text', '#operation-event', '#weapon-strip', '#mechanic-readout', '#range-info']) {
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
  commands.textContent = '指揮選單';
  toolbar.append(commands);
  toolbar.addEventListener('click', event => {
    if ((event.target as HTMLElement).closest('[data-action="view-build"],[data-action="command-panel"]')) details.open = false;
  });
}
