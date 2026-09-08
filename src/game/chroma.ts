/** Remove the export matte, then decontaminate only its two-pixel foreground edge. */
export function removeMagentaMatte(pixels:Uint8ClampedArray,width:number,height:number):boolean {
  const key=(i:number)=>pixels[i]>=195&&pixels[i+2]>=195&&pixels[i+1]<85&&pixels[i+3]>0;
  let border=0,marked=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x===0||y===0||x===width-1||y===height-1){border++;if(key((y*width+x)*4))marked++;}
  // Already transparent sheets and painted scenes are not chroma-key sources.
  if(marked<border*.1)return false;
  const mask=new Uint8Array(width*height);
  for(let p=0;p<mask.length;p++)if(key(p*4)){mask[p]=1;pixels.fill(0,p*4,p*4+4);}
  const near=(p:number)=>p%width>0&&mask[p-1]===1||p%width<width-1&&mask[p+1]===1||p>=width&&mask[p-width]===1||p<mask.length-width&&mask[p+width]===1;
  for(let pass=0;pass<2;pass++){
    const edges:number[]=[];
    for(let p=0;p<mask.length;p++){
      const i=p*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      if(mask[p]||!pixels[i+3]||!near(p)||Math.min(r,b)-g<30||Math.abs(r-b)>100)continue;
      const spill=Math.min(r,b)-g,alpha=1-spill/255;
      pixels[i]=Math.max(0,(r-spill)/alpha);pixels[i+1]=g/alpha;pixels[i+2]=Math.max(0,(b-spill)/alpha);
      pixels[i+3]=Math.round(pixels[i+3]*alpha);edges.push(p);
    }
    // Do not recursively eat into purple costume details within the same pass.
    for(const p of edges)mask[p]=1;
  }
  return true;
}
/** Runtime material key: source art stays untouched. */
export function keyPixels(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data=context.getImageData(0,0,width,height);
  const changed=removeMagentaMatte(data.data,width,height);
  if(changed)context.putImageData(data,0,0);
  return changed;
}
const imageCache = new Map<string, string>();
export function keyInterfaceImage(image: HTMLImageElement) {
  const source = image.getAttribute('src') ?? '';
  if (!/\/assets\/(enemies|weapons|evolutions|forms)\//.test(source) || !image.naturalWidth) return;
  const cached = imageCache.get(source); if (cached) { image.src = cached; return; }
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return;
  context.drawImage(image, 0, 0);
  if (keyPixels(context, canvas.width, canvas.height)) { const url = canvas.toDataURL('image/png'); imageCache.set(source, url); image.src = url; }
}
