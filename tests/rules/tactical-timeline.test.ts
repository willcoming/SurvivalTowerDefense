import { describe, it, expect } from 'vitest';
import { createRun, command } from '../../src/sim/engine';
import { TacticalTimeline, TACTICAL_DURATION_MS } from '../../src/game/tactical-timeline';

const run = () => createRun({ stageId: 'S01', squadIds: ['C01'], captainId: 'C01', seed: 10 });
describe('presentation hold lifecycle', () => {
  it('rejects a duplicate start, consumes wall time once and holds the completion frame', () => {
    const state = run(), timeline = new TacticalTimeline();
    expect(timeline.play(state)).toBe(true);
    timeline.advance(state, 300);
    expect(timeline.play(state)).toBe(false);
    expect(timeline.elapsedMs).toBe(300);
    for (let i = 0; i < 3; i++) timeline.advance(state, 300);
    expect(timeline.advance(state, 300)).toBe(true);
    expect(timeline.elapsedMs).toBe(TACTICAL_DURATION_MS);
    expect(timeline.active(state)).toBe(false);
    expect(timeline.advance(state, 16)).toBe(false);
  });
  it('keeps the remaining pose while user/hidden pauses overlap, and rejects long gaps', () => {
    const state = run(), timeline = new TacticalTimeline(); timeline.play(state);
    timeline.advance(state, 340);
    command(state, { type: 'pause', reason: 'hidden' });
    command(state, { type: 'pause', reason: 'user' });
    timeline.advance(state, 250);
    command(state, { type: 'resume', reason: 'hidden' });
    timeline.advance(state, 250); expect(timeline.elapsedMs).toBe(340);
    command(state, { type: 'resume', reason: 'user' });
    timeline.advance(state, 1500); timeline.advance(state, NaN);
    expect(timeline.elapsedMs).toBe(340);
    timeline.advance(state, 200); expect(timeline.elapsedMs).toBe(540);
  });
  it('never blocks a replacement run or resurrects an abandoned battle', () => {
    const state = run(), replacement = run(), timeline = new TacticalTimeline(); timeline.play(state);
    expect(timeline.active(replacement)).toBe(false);
    command(state, { type: 'abandon' }); expect(timeline.active(state)).toBe(false);
    expect(timeline.play(replacement)).toBe(true);
  });
});
