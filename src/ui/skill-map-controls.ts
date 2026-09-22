interface Camera {x:number;y:number;scale:number;width:number;height:number;tree:string;selected:string;}
const cameras=new Map<string,Camera>();
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Owns only map presentation; dragging and zooming never submit a skill purchase. */
export function mountSkillMaps(holder:HTMLElement){
 const disposers:(()=>void)[]=[];
 for(const map of holder.querySelectorAll<HTMLElement>('.skill-network')){
  const panel=map.closest<HTMLElement>('.tree-panel,.personnel-skills-dialog')!;panel.classList.add('network-panel');
  let viewport=map.closest<HTMLElement>('.skill-map-viewport');
  if(!viewport){viewport=document.createElement('div');viewport.className='skill-map-viewport';map.before(viewport);viewport.append(map);}
  viewport.classList.add('network-viewport');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','技能樹畫布，可拖曳、雙指縮放，或使用方向鍵與加減鍵');
  const controls=document.createElement('div');controls.className='network-controls';controls.innerHTML='<button type="button" data-map-control="out" aria-label="縮小技能樹">−</button><output aria-label="技能樹縮放比例"></output><button type="button" data-map-control="in" aria-label="放大技能樹">＋</button><button type="button" data-map-control="fit">全覽</button><button type="button" data-map-control="root">起點</button>';
  viewport.after(controls);
  const hint=document.createElement('span');hint.className='network-gesture-hint';hint.textContent='拖曳移動 · 雙指／滾輪縮放';viewport.append(hint);
  const key=map.dataset.mapKey!,worldW=Number(map.dataset.worldWidth),worldH=Number(map.dataset.worldHeight),tree=map.dataset.activeTree!,selected=map.dataset.selected??'';
  const previous=cameras.get(key);let camera:Camera=previous?{...previous}:{x:0,y:0,scale:1,width:0,height:0,tree,selected};
  const measure=()=>({width:viewport!.clientWidth,height:viewport!.clientHeight});
  const remember=()=>{cameras.delete(key);cameras.set(key,{...camera});if(cameras.size>24)cameras.delete(cameras.keys().next().value!);};
  const render=()=>{
   const {width,height}=measure();
   camera.x=clamp(camera.x,Math.min(width-worldW*camera.scale-50,width/2-620*camera.scale),Math.max(50,width/2));
   camera.y=clamp(camera.y,Math.min(height-worldH*camera.scale-40,0),Math.max(40,height/2));
   camera.width=width;camera.height=height;map.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
   viewport!.dataset.scale=String(camera.scale);viewport!.dataset.panX=String(camera.x);viewport!.dataset.panY=String(camera.y);controls.querySelector('output')!.textContent=`${Math.round(camera.scale*100)}%`;remember();
  };
  const focusPoint=(x:number,y:number)=>{const {width,height}=measure();camera.x=width/2-x*camera.scale;camera.y=height/2-y*camera.scale;render();};
  const fit=()=>{const {width,height}=measure();camera.scale=clamp(Math.min((width-24)/worldW,(height-20)/worldH),.2,1.2);camera.x=(width-worldW*camera.scale)/2;camera.y=(height-worldH*camera.scale)/2;render();};
  const root=()=>{const {width,height}=measure();camera.scale=width<800?.85:Math.max(.6,Math.min((width-30)/worldW,(height-20)/worldH));camera.x=width/2-620*camera.scale;camera.y=height-42-(worldH-35)*camera.scale;render();};
  const zoom=(factor:number,clientX?:number,clientY?:number)=>{const rect=viewport!.getBoundingClientRect(),x=(clientX??rect.x+rect.width/2)-rect.x,y=(clientY??rect.y+rect.height/2)-rect.y,next=clamp(camera.scale*factor,.2,2);camera.x=x-(x-camera.x)*next/camera.scale;camera.y=y-(y-camera.y)*next/camera.scale;camera.scale=next;render();};
  const reveal=(node:HTMLElement)=>{
   const x=Number(node.dataset.x),y=Number(node.dataset.y),{width,height}=measure(),px=x*camera.scale+camera.x,py=y*camera.scale+camera.y;
   if(px<55||px>width-55||py<55||py>height-70)focusPoint(x,y);
  };
  if(!previous){if(measure().width<800)root();else fit();}
  else {const {width,height}=measure();camera.x+=(width-camera.width)/2;camera.y+=(height-camera.height)/2;render();}
  if(selected&&previous?.selected!==selected){const node=[...map.querySelectorAll<HTMLElement>('.deep-node')].find(n=>n.dataset.id===selected);if(node)reveal(node);}
  else if(previous&&previous.tree!==tree&&!selected){const nodes=[...map.querySelectorAll<HTMLElement>('.deep-node')].filter(n=>n.dataset.tree===tree);focusPoint(nodes.reduce((sum,n)=>sum+Number(n.dataset.x),0)/nodes.length,nodes.reduce((sum,n)=>sum+Number(n.dataset.y),0)/nodes.length);}
  camera.tree=tree;camera.selected=selected;remember();
  const pointers=new Map<number,{x:number;y:number;startX:number;startY:number}>();let dragged=false,suppressClick=false;
  const down=(e:PointerEvent)=>{if(e.button!==0&&e.pointerType==='mouse')return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});if(pointers.size===1)dragged=false;if(pointers.size>1){dragged=true;suppressClick=true;}};
  const move=(e:PointerEvent)=>{
   const point=pointers.get(e.pointerId);if(!point)return;
   const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];
   if(other){const before=Math.hypot(point.x-other.x,point.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>1){const midX=(point.x+other.x)/2,midY=(point.y+other.y)/2;zoom(after/before,midX,midY);camera.x+=(e.clientX-point.x)/2;camera.y+=(e.clientY-point.y)/2;}}
   else {if(Math.hypot(e.clientX-point.startX,e.clientY-point.startY)>7)dragged=true;if(dragged){camera.x+=e.clientX-point.x;camera.y+=e.clientY-point.y;}}
   if(dragged){suppressClick=true;viewport!.setPointerCapture(e.pointerId);viewport!.classList.add('dragging');e.preventDefault();}
   point.x=e.clientX;point.y=e.clientY;render();
  };
  const up=(e:PointerEvent)=>{pointers.delete(e.pointerId);if(!pointers.size){viewport!.classList.remove('dragging');if(viewport!.hasPointerCapture(e.pointerId))viewport!.releasePointerCapture(e.pointerId);setTimeout(()=>{suppressClick=false;},0);}};
  const click=(e:MouseEvent)=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}};
  const wheel=(e:WheelEvent)=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.002),e.clientX,e.clientY);};
  const keydown=(e:KeyboardEvent)=>{if(e.target!==viewport)return;if(['+','=','-','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','0'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key==='0')fit();else if(e.key==='Home')root();else{camera.x+=e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0;camera.y+=e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0;render();}}};
  const focusin=(e:FocusEvent)=>{const node=(e.target as HTMLElement).closest<HTMLElement>('.deep-node');if(node&&!pointers.size)reveal(node);};
  controls.addEventListener('click',e=>{const kind=(e.target as HTMLElement).closest<HTMLElement>('[data-map-control]')?.dataset.mapControl;if(kind==='fit')fit();else if(kind==='root')root();else if(kind)zoom(kind==='in'?1.2:1/1.2);});
  viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',up);viewport.addEventListener('click',click,true);viewport.addEventListener('wheel',wheel,{passive:false});viewport.addEventListener('keydown',keydown);viewport.addEventListener('focusin',focusin);
  const observer=new ResizeObserver(()=>{const {width,height}=measure();if(camera.width===width&&camera.height===height)return;camera.x+=(width-camera.width)/2;camera.y+=(height-camera.height)/2;render();});observer.observe(viewport);
  disposers.push(()=>{remember();observer.disconnect();});
 }
 return ()=>disposers.forEach(dispose=>dispose());
}
