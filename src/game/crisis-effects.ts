import type Phaser from 'phaser';
import { NaturalEffects, variation } from './natural-effects';
import type { VisualEvent } from '../sim/types';

/** Passive emergency pulse; owns no input handlers or targeting state. */
export class CrisisEffects {
  private visuals: NaturalEffects;
  private pulses: { event: VisualEvent; born: number }[] = [];
  private count = 0;
  constructor(scene: Phaser.Scene) { this.visuals = new NaturalEffects(scene,12,20); }
  update(fresh: VisualEvent[], now: number, reduced: boolean) {
    for (const event of fresh) if (event.kind === 'emp_wave') {
      this.pulses.push({ event, born: now }); this.count++;
    }
    this.pulses = this.pulses.filter(p => now - p.born < 650);
    const v = this.visuals; v.begin();
    for (const { event, born } of this.pulses) {
      const progress = (now - born) / 650, radius = reduced ? 200 : 30 + progress * 320;
      v.glow(event.x,event.y,radius*1.7,0x8dd4e1,(1-progress)*.2);
      for(let i=0;i<7;i++){
        const seed=variation(event.seq,i),angle=Math.PI*(1.1+seed*.8),reach=radius*(.3+variation(event.seq,i+10)*.5);
        v.glow(event.x+Math.cos(angle)*reach,event.y+Math.sin(angle)*reach*v.aspect,5+seed*5,0xb2f1ff,(1-progress)*.65);
      }
    }
    v.end();
  }
  diagnostics() { return { crisis: { pulseCount: this.count, active: this.pulses.length, drawCommands: this.visuals.active } }; }
}
