import { WORLD } from '../data/content';
import type { VisualEvent } from '../sim/types';
export interface AreaCue {event:VisualEvent;born:number;duration:number}
export const isAreaEvent=(e:VisualEvent)=>!!e.areaShape||e.kind==='explosion'&&(e.radius??0)>0;
/** Separate from cosmetic sprite budgets: every delivered attack keeps its footprint. */
export class AreaCueStore {
 cues:AreaCue[]=[];private lastSeq=0;
 update(events:readonly VisualEvent[],now:number){
  this.cues=this.cues.filter(c=>now-c.born<c.duration);
  for(const delivered of events){const event:VisualEvent=delivered.skill==='repulse'?{...delivered,areaShape:'wall-band',x:195,y:WORLD.wallY-85}:delivered;if(event.seq<=this.lastSeq)continue;this.lastSeq=event.seq;if(isAreaEvent(event))this.cues.push({event,born:now,duration:event.areaShape==='line'?260:event.skill==='ultimate'?600:440});}
 }
}
