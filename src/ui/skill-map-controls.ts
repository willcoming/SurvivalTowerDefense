import { DEEP_NODE_MAP } from '../data/deep-trees';
import { skillNetworkLayout, type SkillMapLayoutMode } from './skill-network-layout';
import { mountSkillNavigation } from './skill-map-navigation';

interface Camera {
  x: number; y: number; scale: number; width: number; height: number;
  tree: string; selected: string; detailOpen: boolean; session: string; layout: SkillMapLayoutMode; mode: 'width' | 'fit' | 'manual';
}
const cameras = new Map<string, Camera>();
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Owns only map presentation; dragging and zooming never submit a skill purchase. */
export function mountSkillMaps(holder: HTMLElement) {
  const disposers: (() => void)[] = [];
  for (const map of holder.querySelectorAll<HTMLElement>('.skill-network')) {
    const panel = map.closest<HTMLElement>('.tree-panel,.personnel-skills-dialog')!;
    panel.classList.add('network-panel');
    let viewport = map.closest<HTMLElement>('.skill-map-viewport');
    if (!viewport) {
      viewport = document.createElement('div'); viewport.className = 'skill-map-viewport';
      map.before(viewport); viewport.append(map);
    }
    viewport.classList.add('network-viewport'); viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', '技能樹畫布，可拖曳、雙指縮放，或使用方向鍵與加減鍵');
    const controls = document.createElement('div'); controls.className = 'network-controls';
    controls.innerHTML = '<button type="button" data-map-control="out" aria-label="縮小技能樹">−</button><output aria-label="技能樹縮放比例"></output><button type="button" data-map-control="in" aria-label="放大技能樹">＋</button><button type="button" data-map-control="ultimate" aria-label="定位終極技">終極</button><button type="button" data-map-control="fit">全覽</button><button type="button" data-map-control="root" aria-label="起點">回起點</button><button type="button" data-map-control="help" aria-label="星圖操作說明" aria-expanded="false">?</button>';
    const help = document.createElement('p'); help.className = 'network-map-help'; help.hidden = true;
    help.textContent = '拖曳移動 · 雙指／滾輪縮放 · 虛線為跨分支前置 · 全覽顯示完整星圖';
    viewport.after(controls, help);
    const desktop = matchMedia('(min-width:1024px)'), reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
    const context = panel.querySelector<HTMLButtonElement>('.skill-map-toolbar .mobile-detail-trigger');
    const contextToolbar = context?.parentElement;
    const key = map.dataset.mapKey!, session = panel.dataset.mapSession ?? key;
    const tree = map.dataset.activeTree!, selected = map.dataset.selected ?? '';
    const detailOpen = !!panel.querySelector('.skill-bottom-sheet[data-open="true"]');
    const skillNodes = [...map.querySelectorAll<HTMLElement>('.deep-node')];
    const dataNodes = skillNodes.map(node => DEEP_NODE_MAP[node.dataset.id!]).sort((a, b) => a.treeId.localeCompare(b.treeId) || a.id.localeCompare(b.id));
    const edgePaths = [...map.querySelectorAll<SVGPathElement>('.network-edges path[data-child]')];
    const measure = () => ({ width: viewport!.clientWidth, height: viewport!.clientHeight });
    let geometry = skillNetworkLayout(dataNodes, desktop.matches ? 'desktop' : 'mobile', measure().width);
    const cached = cameras.get(key), previous = cached?.session === session ? cached : undefined;
    const camera: Camera = previous ? { ...previous } : { x: 0, y: 0, scale: 1, width: 0, height: 0, tree, selected: '', detailOpen: false, session, layout: desktop.matches ? 'desktop' : 'mobile', mode: desktop.matches ? 'fit' : 'width' };
    let animation = 0, disposed = false;
    const cancelAnimation = () => { cancelAnimationFrame(animation); animation = 0; };
    const remember = () => {
      cameras.delete(key); cameras.set(key, { ...camera });
      if (cameras.size > 24) cameras.delete(cameras.keys().next().value!);
    };
    const updateLayout = () => {
      const mode = desktop.matches ? 'desktop' : 'mobile';
      geometry = skillNetworkLayout(dataNodes, mode, measure().width);
      camera.layout = mode; map.dataset.mapLayout = mode;
      controls.querySelector<HTMLButtonElement>('[data-map-control="ultimate"]')!.hidden = mode === 'mobile';
      controls.querySelector<HTMLOutputElement>('output')!.hidden = mode === 'mobile' && measure().width < 340;
      if (context && contextToolbar) {
        context.textContent = mode === 'mobile' ? '敵情' : '敵情／構築';
        context.setAttribute('aria-label', '敵情／構築');
        (mode === 'mobile' ? controls : contextToolbar).append(context);
      }
      map.dataset.worldWidth = String(geometry.width); map.dataset.worldHeight = String(geometry.height);
      map.style.setProperty('--map-width', `${geometry.width}px`); map.style.setProperty('--map-height', `${geometry.height}px`);
      map.style.setProperty('--map-label-width', `${geometry.labelWidth}px`);
      map.style.setProperty('--map-badge-width', `${Math.min(100, (geometry.width - 32) / 3 - 8)}px`);
      for (const node of skillNodes) {
        const point = geometry.positions.get(node.dataset.id!)!;
        node.dataset.x = String(point.x); node.dataset.y = String(point.y);
        node.style.setProperty('--node-x', `${point.x}px`); node.style.setProperty('--node-y', `${point.y}px`);
      }
      for (const svg of map.querySelectorAll('svg.network-edges,svg.network-grid')) svg.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`);
      const routes = new Map(geometry.edges.map(edge => [`${edge.parent}:${edge.child}`, edge.path]));
      for (const path of edgePaths) {
        const route = routes.get(`${path.dataset.parent}:${path.dataset.child}`)!;
        path.setAttribute('d', route);
        path.parentElement?.querySelectorAll('.route-underlay,.route-flow').forEach(decoration => decoration.setAttribute('d', route));
      }
      for (const mask of map.querySelectorAll('mask')) {
        mask.setAttribute('width', String(geometry.width)); mask.setAttribute('height', String(geometry.height));
        for (const rect of mask.querySelectorAll<SVGRectElement>('rect[data-node-id]')) {
          const id = rect.dataset.nodeId!, point = geometry.positions.get(id)!;
          rect.setAttribute('x', String(point.x - geometry.labelWidth / 2 - 2)); rect.setAttribute('width', String(geometry.labelWidth + 4));
          rect.setAttribute('y', String(point.y + (DEEP_NODE_MAP[id].kind === 'ultimate' ? 36 : 28))); rect.setAttribute('height', '36');
        }
      }
      const core = map.querySelector<HTMLElement>('.network-core');
      if (core) { core.style.left = `${geometry.core.x}px`; core.style.top = `${geometry.core.y}px`; }
      for (const badge of map.querySelectorAll<HTMLElement>('[data-map-branch]')) {
        const point = geometry.badgePositions.get(badge.dataset.mapBranch!);
        if (point) { badge.style.left = `${point.x}px`; badge.style.top = `${point.y}px`; }
      }
    };
    const highlightPath = (id: string) => {
      if (id) map.dataset.pathFocus = id; else delete map.dataset.pathFocus;
      const ancestors = new Set<string>();
      const trace = (child: string) => {
        if (ancestors.has(child)) return; ancestors.add(child);
        for (const edge of edgePaths) if (edge.dataset.child === child && edge.dataset.parent) trace(edge.dataset.parent);
      };
      if (id) trace(id);
      const parents = new Set(edgePaths.filter(edge => edge.dataset.child === id).map(edge => edge.dataset.parent));
      for (const edge of edgePaths) {
        edge.classList.toggle('focus-direct', !!id && edge.dataset.child === id);
        edge.classList.toggle('focus-ancestor', !!id && edge.dataset.child !== id && ancestors.has(edge.dataset.child!));
      }
      for (const node of skillNodes) {
        node.classList.toggle('path-node', ancestors.has(node.dataset.id!)); node.classList.toggle('path-parent', parents.has(node.dataset.id));
      }
      const priority = (edge: SVGPathElement) => edge.classList.contains('focus-direct') ? 4 : edge.classList.contains('focus-ancestor') ? 3 : edge.classList.contains('queued') ? 2 : edge.classList.contains('connected') ? 1 : 0;
      for (const edge of [...edgePaths].sort((a, b) => priority(a) - priority(b))) edge.parentElement!.parentElement!.append(edge.parentElement!);
    };
    const render = () => {
      const { width, height } = measure(), bounds = geometry.bounds;
      // The complete mobile width stays centered until the player deliberately zooms in.
      if (camera.layout === 'mobile' && camera.scale <= 1) camera.x = (width - geometry.width * camera.scale) / 2;
      else camera.x = clamp(camera.x, 24 - bounds.right * camera.scale, width - 24 - bounds.left * camera.scale);
      camera.y = clamp(camera.y, Math.min(24, height * .35) - bounds.bottom * camera.scale, height * .65 - bounds.top * camera.scale);
      camera.width = width; camera.height = height;
      map.style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
      viewport!.dataset.scale = String(camera.scale); viewport!.dataset.panX = String(camera.x); viewport!.dataset.panY = String(camera.y);
      controls.querySelector('output')!.textContent = `${Math.round(camera.scale * 100)}%`; remember();
    };
    const moveCamera = (x: number, y: number, smooth = false) => {
      cancelAnimation();
      if (!smooth || reducedMotion.matches || panel.closest('.reduced-effects')) { camera.x = x; camera.y = y; render(); return; }
      const startX = camera.x, startY = camera.y, start = performance.now();
      const tick = (now: number) => {
        if (disposed) return;
        const progress = Math.min(1, (now - start) / 220), eased = 1 - Math.pow(1 - progress, 3);
        camera.x = startX + (x - startX) * eased; camera.y = startY + (y - startY) * eased; render();
        animation = progress < 1 ? requestAnimationFrame(tick) : 0;
      };
      animation = requestAnimationFrame(tick);
    };
    const fit = () => {
      cancelAnimation(); const { width, height } = measure(), b = geometry.bounds;
      camera.mode = 'fit'; camera.scale = clamp(Math.min((width - 24) / (b.right - b.left), (height - 24) / (b.bottom - b.top)), .1, 1.2);
      moveCamera(width / 2 - (b.left + b.right) / 2 * camera.scale, height / 2 - (b.top + b.bottom) / 2 * camera.scale);
    };
    const root = () => {
      cancelAnimation(); const { width, height } = measure();
      camera.mode = camera.layout === 'mobile' ? 'width' : 'manual'; camera.scale = camera.layout === 'mobile' ? 1 : .85;
      moveCamera(width / 2 - geometry.core.x * camera.scale, height - 56 - geometry.core.y * camera.scale);
    };
    const reveal = (node: HTMLElement, smooth = true) => {
      const { width, height } = measure(), x = Number(node.dataset.x), y = Number(node.dataset.y);
      const radius = node.offsetHeight / 2 * camera.scale;
      if (camera.layout === 'desktop' && camera.mode === 'fit') {
        const label = node.querySelector<HTMLElement>('strong'), px = x * camera.scale + camera.x, py = y * camera.scale + camera.y;
        const side = Math.max(node.offsetWidth / 2 + 14, (label?.offsetWidth ?? 0) / 2) * camera.scale;
        const top = (node.classList.contains('ultimate') ? 60 : node.offsetHeight / 2 + 18) * camera.scale;
        const bottom = radius + (8 + (label?.offsetHeight ?? 32)) * camera.scale;
        // The side panel gives details without disturbing an already complete panorama.
        if (px >= side && px <= width - side && py >= top && py <= height - bottom) return;
      }
      // Details occupy their own layout row/column, so viewport measures only visible map space.
      const targetX = camera.layout === 'mobile' && camera.scale <= 1 ? camera.x : width / 2 - x * camera.scale;
      const halo = radius + 18 * camera.scale;
      const margin = Math.min(height >= halo * 2 ? halo : radius + 4, height / 2);
      const targetY = clamp(height * .35, margin, height - margin);
      moveCamera(targetX, targetY - y * camera.scale, smooth);
    };
    const zoom = (factor: number, clientX?: number, clientY?: number) => {
      cancelAnimation(); camera.mode = 'manual';
      const rect = viewport!.getBoundingClientRect(), x = (clientX ?? rect.x + rect.width / 2) - rect.x, y = (clientY ?? rect.y + rect.height / 2) - rect.y;
      const next = clamp(camera.scale * factor, .1, 2);
      camera.x = x - (x - camera.x) * next / camera.scale; camera.y = y - (y - camera.y) * next / camera.scale; camera.scale = next; render();
    };
    const focusBranch = (route: string) => {
      const nodes = skillNodes.filter(node => node.dataset.tree === route);
      if (!nodes.length) { if (camera.layout === 'mobile') root(); else fit(); return; }
      const entry = nodes.find(node => DEEP_NODE_MAP[node.dataset.id!].kind === 'entry')!;
      if (camera.layout === 'mobile') reveal(entry);
      else {
        const xs = nodes.map(node => Number(node.dataset.x)), ys = nodes.map(node => Number(node.dataset.y)), size = measure();
        camera.mode = 'manual'; camera.scale = clamp(Math.min(1, (size.width - 24) / (Math.max(...xs) - Math.min(...xs) + 150), (size.height - 24) / (Math.max(...ys) - Math.min(...ys) + 160)), .3, 1);
        moveCamera(size.width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2 * camera.scale, size.height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2 * camera.scale, true);
      }
    };
    const navigation = mountSkillNavigation(map, viewport, focusBranch);
    updateLayout(); highlightPath(selected);
    if (!previous || previous.layout !== camera.layout) { if (camera.layout === 'mobile') root(); else fit(); }
    else {
      const { width, height } = measure(); camera.x += (width - camera.width) / 2; camera.y += (height - camera.height) / 2; render();
    }
    if (selected && (previous?.selected !== selected || previous?.layout !== camera.layout || detailOpen && !previous?.detailOpen)) { const node = skillNodes.find(node => node.dataset.id === selected); if (node) reveal(node); }
    camera.tree = tree; camera.selected = selected; camera.detailOpen = detailOpen; remember();
    const pointers = new Map<number, { x: number; y: number; startX: number; startY: number }>();
    let dragged = false, suppressClick = false;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      cancelAnimation(); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      if (pointers.size === 1) dragged = false; else { dragged = true; suppressClick = true; }
    };
    const move = (event: PointerEvent) => {
      const point = pointers.get(event.pointerId); if (!point) return;
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(point.x - other.x, point.y - other.y), after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before > 1) { zoom(after / before, (point.x + other.x) / 2, (point.y + other.y) / 2); camera.x += (event.clientX - point.x) / 2; camera.y += (event.clientY - point.y) / 2; }
      } else {
        if (Math.hypot(event.clientX - point.startX, event.clientY - point.startY) > 7) dragged = true;
        if (dragged) { camera.mode = 'manual'; camera.x += event.clientX - point.x; camera.y += event.clientY - point.y; }
      }
      if (dragged) { suppressClick = true; viewport!.setPointerCapture(event.pointerId); viewport!.classList.add('dragging'); event.preventDefault(); }
      point.x = event.clientX; point.y = event.clientY; render();
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (!pointers.size) { viewport!.classList.remove('dragging'); if (viewport!.hasPointerCapture(event.pointerId)) viewport!.releasePointerCapture(event.pointerId); setTimeout(() => { suppressClick = false; }, 0); }
    };
    const click = (event: MouseEvent) => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); } };
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom(Math.exp(-event.deltaY * .002), event.clientX, event.clientY); };
    const keydown = (event: KeyboardEvent) => {
      if (event.target !== viewport || !['+', '=', '-', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', '0'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); cancelAnimation();
      if (event.key === '+' || event.key === '=') zoom(1.2); else if (event.key === '-') zoom(1 / 1.2); else if (event.key === '0') fit(); else if (event.key === 'Home') root();
      else { camera.mode = 'manual'; camera.x += event.key === 'ArrowLeft' ? 60 : event.key === 'ArrowRight' ? -60 : 0; camera.y += event.key === 'ArrowUp' ? 60 : event.key === 'ArrowDown' ? -60 : 0; render(); }
    };
    // Pointer focus must not move the target before its click is dispatched.
    const focusin = (event: FocusEvent) => {
      const node = (event.target as HTMLElement).closest<HTMLElement>('.deep-node');
      if (node && !pointers.size) { if (node.matches(':focus-visible') && node.dataset.id !== selected) reveal(node, false); highlightPath(node.dataset.id!); }
    };
    const hover = (event: PointerEvent) => { if (event.pointerType !== 'touch' && !pointers.size) highlightPath((event.target as Element).closest<HTMLElement>('.deep-node')?.dataset.id ?? selected); };
    map.addEventListener('pointerover', hover); map.addEventListener('pointerleave', () => highlightPath(selected));
    map.addEventListener('focusout', event => { if (!map.contains(event.relatedTarget as Node | null)) highlightPath(selected); });
    controls.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-map-control]'), kind = button?.dataset.mapControl;
      if (kind === 'help') { help.hidden = !help.hidden; button!.setAttribute('aria-expanded', String(!help.hidden)); }
      else if (kind === 'ultimate') { const node = skillNodes.find(node => node.classList.contains('ultimate')); if (node) { reveal(node); node.focus({ preventScroll: true }); highlightPath(node.dataset.id!); } }
      else if (kind === 'fit') fit(); else if (kind === 'root') root(); else if (kind) zoom(kind === 'in' ? 1.2 : 1 / 1.2);
    });
    viewport.addEventListener('pointerdown', down); viewport.addEventListener('pointermove', move); viewport.addEventListener('pointerup', up); viewport.addEventListener('pointercancel', up);
    viewport.addEventListener('click', click, true); viewport.addEventListener('wheel', wheel, { passive: false }); viewport.addEventListener('keydown', keydown); viewport.addEventListener('focusin', focusin);
    const resize = () => {
      const size = measure(), mode = desktop.matches ? 'desktop' : 'mobile';
      if (disposed || !size.width || !size.height || camera.width === size.width && camera.height === size.height && camera.layout === mode) return;
      cancelAnimation(); const changedMode = camera.layout !== mode, oldWidth = camera.width, oldHeight = camera.height;
      updateLayout();
      if (changedMode || camera.mode === 'fit') { if (mode === 'mobile' && changedMode) root(); else fit(); }
      else { camera.x += (size.width - oldWidth) / 2; camera.y += (size.height - oldHeight) / 2; render(); }
      const node = skillNodes.find(node => node.dataset.id === selected);
      if (node && panel.querySelector('.skill-bottom-sheet')) reveal(node, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(viewport); desktop.addEventListener('change', resize);
    disposers.push(() => { disposed = true; cancelAnimation(); navigation.remember(); remember(); observer.disconnect(); desktop.removeEventListener('change', resize); });
  }
  return () => disposers.forEach(dispose => dispose());
}
