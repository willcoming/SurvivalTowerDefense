import { esc } from './format';

interface NavigationState { view:'map'|'list'; branch:string; scroll:number; }
const selections=new Map<string,NavigationState>();

/** A readable alternative to the zoomable graph; it never purchases a skill. */
export function mountSkillNavigation(map:HTMLElement,viewport:HTMLElement,focusBranch:(route:string)=>void){
  const key=map.dataset.mapKey!,nodes=[...map.querySelectorAll<HTMLElement>('.deep-node')];
  const routes=new Map(nodes.map(node=>[node.dataset.tree!,node.dataset.routeName!]));
  const state:NavigationState={...(selections.get(key)??{view:'map',branch:'',scroll:0})};
  if(!routes.has(state.branch))state.branch='';
  const toolbar=document.createElement('nav');toolbar.className='skill-navigation';toolbar.setAttribute('aria-label','技能閱讀方式與分支');
  toolbar.innerHTML=`<div role="group" aria-label="技能閱讀方式"><button type="button" data-skill-view="map">路線圖</button><button type="button" data-skill-view="list">技能列表</button></div><label><span class="sr-only">聚焦分支</span><select aria-label="聚焦分支"><option value="">全部分支</option>${[...routes].map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label>`;
  const shell=document.createElement('div');shell.className='skill-canvas-shell';
  viewport.before(toolbar,shell);shell.append(viewport);
  const list=document.createElement('div');list.className='skill-readable-list';list.tabIndex=0;list.setAttribute('role','region');list.setAttribute('aria-label','可讀技能列表');
  shell.append(list);
  list.innerHTML=nodes.map(node=>{
    const name=node.querySelector('strong')!.textContent!,status=node.getAttribute('aria-label')!.slice(name.length+1);
    return `<button type="button" class="skill-list-node ${node.dataset.state}" data-id="${esc(node.dataset.id!)}" data-tree="${esc(node.dataset.tree!)}" aria-label="${esc(name)}，${esc(status)}" aria-pressed="${node.getAttribute('aria-pressed')}"><span class="skill-list-heading"><strong>${esc(name)}</strong><small>${esc(node.dataset.cost!)} 點 · ${esc(status.replace(/^\d+ 點/,''))}</small></span><span>${esc(node.dataset.description!)}</span><small>前置：${esc(node.dataset.prerequisites!)}${node.classList.contains('ultimate')?'；此角色先投入 4 點':''}</small></button>`;
  }).join('');
  const select=toolbar.querySelector('select')!;
  const remember=()=>{
    if(state.view==='list')state.scroll=list.scrollTop;
    selections.delete(key);selections.set(key,{...state});
    if(selections.size>24)selections.delete(selections.keys().next().value!);
  };
  const render=()=>{
    shell.dataset.view=state.view;select.value=state.branch;
    viewport.style.visibility=state.view==='list'?'hidden':'';
    viewport.inert=state.view==='list';viewport.setAttribute('aria-hidden',String(state.view==='list'));
    list.hidden=state.view!=='list';
    toolbar.querySelectorAll<HTMLElement>('[data-skill-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.skillView===state.view)));
    list.querySelectorAll<HTMLElement>('.skill-list-node').forEach(node=>node.hidden=!!state.branch&&node.dataset.tree!==state.branch);
    nodes.forEach(node=>node.classList.toggle('outside-focused-branch',!!state.branch&&node.dataset.tree!==state.branch));
  };
  toolbar.addEventListener('click',event=>{
    const view=(event.target as HTMLElement).closest<HTMLElement>('[data-skill-view]')?.dataset.skillView;
    if(view==='map'||view==='list'){if(state.view==='list')state.scroll=list.scrollTop;state.view=view;render();if(view==='list')list.scrollTop=state.scroll;else if(state.branch)focusBranch(state.branch);remember();}
  });
  select.addEventListener('change',()=>{state.branch=select.value;state.scroll=0;render();list.scrollTop=0;if(state.view==='map')focusBranch(state.branch);remember();});
  list.addEventListener('click',event=>{
    const selected=(event.target as HTMLElement).closest<HTMLElement>('.skill-list-node');
    if(selected){event.stopPropagation();nodes.find(node=>node.dataset.id===selected.dataset.id)?.click();}
  });
  list.addEventListener('scroll',remember,{passive:true});
  render();list.scrollTop=state.scroll;remember();
  return {remember};
}
