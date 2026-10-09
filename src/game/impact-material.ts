/** Retire the red/purple spiked atlas frames across every presentation path. */
export function impactMaterial(frame:number):{key:string;frame?:number;color:number} {
  const row=Math.floor(frame/4),phase=frame%4;
  if(row===1)return {key:'combat-fx',frame:phase<2?6:7,color:0xffffff};
  if(row===3)return {key:'combat-props',frame:5,color:0x67cfb4};
  return {key:'vfx-soft-light',color:row===2?0x91dfff:0xc3caff};
}
