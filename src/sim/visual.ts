import type { VisualEvent } from './types';

/** Presentation priority only; never consulted by damage or simulation timing. */
export function visualPriority(e: VisualEvent) {
  if (e.kind === 'tactical' || e.kind === 'evolution' || e.kind === 'shield' || e.kind === 'interrupt' || e.kind === 'death' && e.enemyDefId?.startsWith('B')) return 3;
  if (e.kind === 'shot' || e.kind === 'beam' || e.kind === 'arc' || e.kind === 'explosion') return 2;
  return e.kind === 'spawn' ? 0 : 1;
}
