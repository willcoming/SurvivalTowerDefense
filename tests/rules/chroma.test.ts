import { describe,expect,it } from 'vitest';
import { removeMagentaMatte } from '../../src/game/chroma';

describe('portrait matte removal',()=>{
  it('removes the matte and mixed fringe while retaining interior purple and neutral detail',()=>{
    const width=11,pixels=new Uint8ClampedArray(width*width*4);
    const put=(x:number,y:number,c:number[])=>pixels.set(c,(y*width+x)*4);
    const read=(x:number,y:number)=>[...pixels.slice((y*width+x)*4,(y*width+x)*4+4)];
    for(let y=0;y<width;y++)for(let x=0;x<width;x++)put(x,y,[255,0,255,255]);
    for(let y=2;y<9;y++)for(let x=2;x<9;x++)put(x,y,[35,35,35,255]);
    put(2,5,[180,30,180,255]);put(3,5,[90,35,90,255]);put(5,5,[160,45,200,255]);put(8,5,[236,222,201,255]);
    expect(removeMagentaMatte(pixels,width,width)).toBe(true);
    expect(read(0,0)).toEqual([0,0,0,0]);
    expect(read(2,5)[0]).toBe(read(2,5)[1]);expect(read(2,5)[3]).toBeLessThan(255);
    expect(read(3,5)[0]).toBe(read(3,5)[1]);
    expect(read(5,5)).toEqual([160,45,200,255]);expect(read(8,5)).toEqual([236,222,201,255]);
    const clean=pixels.slice();expect(removeMagentaMatte(pixels,width,width)).toBe(false);expect(pixels).toEqual(clean);
  });
  it('does not key painted scenes or already transparent art with purple details',()=>{
    for(const alpha of [0,255]){
      const pixels=new Uint8ClampedArray(7*7*4);
      for(let i=0;i<pixels.length;i+=4)pixels.set([24,40,65,alpha],i);
      pixels.set([255,0,255,255],(3*7+3)*4);
      const before=pixels.slice();expect(removeMagentaMatte(pixels,7,7)).toBe(false);expect(pixels).toEqual(before);
    }
  });
});
