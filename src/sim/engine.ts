import { usesFreeSkills } from '../data/deep-trees';
import { usesCollection, STARTER_IDS, FORM_MAP } from '../data/forms';
import { prepareOperation, eventMultiplier } from './operations';
import { stepSupport } from './deep-support';
import { NODE_MAP, usesSkillTrees } from '../data/skill-trees';
import { validateTreeState } from './skill-tree';
import { CHARACTER_IDS, CHARACTER_MAP, ENEMY_MAP, CONTENT_VERSION, BOSS_INTRO_MS, supportedContent, SCHEMA_VERSION, STAGE_MAP, ticks } from '../data/content';
import { alive, applyEffect, area, boss, createEnemy, distance, emit, hitEnemy, hitWall, stepEffects } from './combat';
import { getLegalNodeIds, getReadyEvolutions, openDraft, rebuildDraft, rerollDraft } from './draft';
import { stepEnemies } from './enemies';
import { seedValue } from './rng';
import { makeSpawnPlan } from './spawn';
import { usesRangeRules } from './range';
import type { CharacterId, Command, RunConfig, RunState } from './types';
import { applyUpgrade, castTactical, stepWeapons } from './weapons';
export { getLegalNodeIds, getReadyEvolutions } from './draft';
export function createRun(config:RunConfig, contentVersion=CONTENT_VERSION):RunState{
  if(!supportedContent(contentVersion))throw new Error('Unknown content version');
  if(!STAGE_MAP[config.stageId]||!Number.isSafeInteger(config.seed)||!config.squadIds.length||config.squadIds.length>5||new Set(config.squadIds).size!==config.squadIds.length||config.squadIds.some(id=>!CHARACTER_IDS.includes(id))||!config.squadIds.includes(config.captainId))throw new Error('Invalid run configuration');
  if(config.challengeId==='four'&&config.squadIds.length>4)throw new Error('四人挑戰最多4人');
  if(config.challengeId&&!['four','no-skill','two-evolutions'].includes(config.challengeId))throw new Error('Unknown challenge');
  if(!usesCollection({contentVersion})&&(config.squadIds.some(id=>!STARTER_IDS.includes(id))||!['S01','S02','S03'].includes(config.stageId)||config.forms))throw new Error('舊版本不支援新角色、形態或關卡');
  if(config.stageId.startsWith('X')&&config.challengeId)throw new Error('外傳沒有挑戰模式');
  if(config.forms&&Object.entries(config.forms).some(([id,form])=>!FORM_MAP[form! as keyof typeof FORM_MAP]||FORM_MAP[form! as keyof typeof FORM_MAP].ownerId!==id))throw new Error('形態與角色不符');
  const ids=usesCollection({contentVersion})?CHARACTER_IDS:STARTER_IDS;
  const counters=()=>Object.fromEntries(ids.map(id=>[id,0])) as Record<CharacterId,number>;
  const s:RunState={schemaVersion:SCHEMA_VERSION,contentVersion,...(usesSkillTrees({contentVersion})?{treeNodes:[]}:{}),runId:globalThis.crypto?.randomUUID?.()??`run-${Date.now()}-${config.seed}`,config:structuredClone(config),tick:0,phase:'running',pauseReasons:[],wallHp:1000,wallMaxHp:1000,shields:[],xp:0,choicesEarned:0,choicesSpent:0,rerollsRemaining:3,evolvedCount:0,evolutionLimit:config.challengeId==='two-evolutions'?2:3,tacticalReadyAt:0,weapons:config.squadIds.map(id=>({id,branch:null,rank:0,readyAt:0,nextAttack:0,attacks:0,droneAttacks:[0,0],shieldAt:0})),commonRanks:{},preferredBranches:Object.fromEntries(ids.map(id=>[id,config.preferredBranches?.[id]??'A'])) as RunState['preferredBranches'],enemies:[],projectiles:[],fields:[],scheduled:[],spawnPlan:[],spawnCursor:0,bossSpawned:false,bossKilled:false,rng:{spawn:seedValue(config.seed,1),draft:seedValue(config.seed,2),visual:seedValue(config.seed,3)},nextEntityId:1,draft:null,nextOfferId:1,events:[],eventSeq:0,actions:[],actionSeq:0,stats:{kills:0,damageByCharacter:counters(),shieldDamageByCharacter:counters(),wallDamageByEnemy:{},shieldAbsorbed:0,controlTicks:counters(),choices:[],casts:[],encountered:[]},outcome:null};
  if(usesFreeSkills(s)){s.rerollsRemaining=0;s.tacticalReadyAt=ticks(CHARACTER_MAP[config.captainId].cooldown);s.support={repairAt:0,pulseAt:0,emergencyAt:0,repulseAt:0,damageTaken:0,secondWindUsed:0,repaired:0,prevented:0,reflected:0};}
  if(usesCollection(s)){s.mines=[];for(const w of s.weapons)if(w.id==='C08'){w.heat=0;w.cooling=false;w.ventUntil=0;}}
  s.spawnPlan=makeSpawnPlan(s);prepareOperation(s);while(s.spawnCursor<s.spawnPlan.length&&s.spawnPlan[s.spawnCursor].at===0){const p=s.spawnPlan[s.spawnCursor++];createEnemy(s,p.defId,p.x,20,p.xp,p.wave);}return s;
}
export function getPhase(s:RunState):RunState['phase']{return s.outcome?'ended':s.pauseReasons.includes('upgrade')?'choosing':s.pauseReasons.length?'paused':'running';}
export function command(s:RunState,cmd:Command):boolean{
  if(s.outcome)return false;let accepted=false;
  if(cmd.type==='pause'&&!s.pauseReasons.includes(cmd.reason)&&cmd.reason!=='upgrade'&&cmd.reason!=='boss-intro'){s.pauseReasons.push(cmd.reason);accepted=true;}
  if(cmd.type==='resume'&&cmd.reason!=='upgrade'&&cmd.reason!=='boss-intro'&&s.pauseReasons.includes(cmd.reason)){s.pauseReasons=s.pauseReasons.filter(r=>r!==cmd.reason);accepted=true;}
  if(cmd.type==='finish-boss-intro'&&s.bossIntro&&s.pauseReasons.every(r=>r==='boss-intro')){delete s.bossIntro;s.pauseReasons=s.pauseReasons.filter(r=>r!=='boss-intro');accepted=true;}
  if(cmd.type==='cast'&&getPhase(s)==='running')accepted=castTactical(s);
  if(cmd.type==='abandon'){s.outcome='abandoned';accepted=true;}
  if(cmd.type==='choose'&&!usesFreeSkills(s)&&s.draft?.id===cmd.offerId&&s.draft.cards.some(c=>c.nodeId===cmd.nodeId)&&(cmd.nodeId==='EMPTY'||getLegalNodeIds(s).includes(cmd.nodeId))){
    applyUpgrade(s,cmd.nodeId);s.stats.choices.push({tick:s.tick,nodeId:cmd.nodeId});s.choicesSpent++;s.draft=null;s.pauseReasons=s.pauseReasons.filter(r=>r!=='upgrade');openDraft(s);accepted=true;
  }
  if(cmd.type==='buy-node'&&usesFreeSkills(s)&&s.draft?.id===cmd.offerId&&s.pauseReasons.includes('upgrade')&&!s.pauseReasons.some(r=>['error','hidden','orientation','tutorial'].includes(r))&&s.choicesSpent<s.draft.pointTarget!&&getLegalNodeIds(s).includes(cmd.nodeId)){
    applyUpgrade(s,cmd.nodeId);s.stats.choices.push({tick:s.tick,nodeId:cmd.nodeId});s.choicesSpent++;
    if(s.choicesSpent===s.draft.pointTarget){s.draft=null;s.pauseReasons=s.pauseReasons.filter(r=>r!=='upgrade'&&r!=='tree');openDraft(s);}
    if(s.bossKilled&&s.spawnCursor===s.spawnPlan.length&&!alive(s).length&&s.choicesSpent>=s.choicesEarned)s.outcome='victory';accepted=true;
  }
  if(cmd.type==='reroll'&&s.draft?.id===cmd.offerId)accepted=rerollDraft(s);
  if(cmd.type==='custom-node'&&usesSkillTrees(s)&&!usesFreeSkills(s)&&s.draft&&getLegalNodeIds(s).includes(cmd.nodeId)){s.draft.customNodeId=cmd.nodeId;if(NODE_MAP[cmd.nodeId])s.draft.focusId=NODE_MAP[cmd.nodeId].ownerId;rebuildDraft(s);accepted=true;}
  if(cmd.type==='focus'&&!usesSkillTrees(s)&&s.draft&&s.config.squadIds.includes(cmd.characterId)){
    if(!getLegalNodeIds(s).some(id=>id.startsWith(`${cmd.characterId}-`)))return false;
    const w=s.weapons.find(w=>w.id===cmd.characterId)!;
    if(cmd.branch&&!['A','B'].includes(cmd.branch))return false;
    if(!w.branch&&cmd.branch)s.preferredBranches[cmd.characterId]=cmd.branch;
    s.draft.focusId=cmd.characterId;rebuildDraft(s);accepted=true;
  }
  if(cmd.type==='evolution'&&!usesSkillTrees(s)&&s.draft&&getReadyEvolutions(s).includes(cmd.nodeId)){s.draft.selectedEvolution=cmd.nodeId;rebuildDraft(s);accepted=true;}
  if(accepted){s.actions.push({tick:s.tick,seq:++s.actionSeq,command:structuredClone(cmd)});s.phase=getPhase(s);}return accepted;
}
function stepProjectiles(s:RunState){
  for(const p of s.projectiles){
    if(p.impactAt){if(s.tick<p.impactAt)continue;const targets=area(s,p.tx,p.ty,p.blastRadius);for(const e of targets)if(p.packet)hitEnemy(s,e,p.packet);emit(s,{affectedIds:targets.map(e=>e.id),kind:'explosion',x:p.tx,y:p.ty,radius:p.blastRadius,source:p.packet?.source});
      if(p.echo&&p.packet)for(let i=0;i<p.echo.count;i++)s.scheduled.push({at:s.tick+ticks(.2*(i+1)),x:p.tx+(i%2?18:-18),y:p.ty-i*12,radius:p.echo.radius,packet:{...p.packet,raw:p.echo.damage,skill:'cluster-burst',secondary:true,burn:undefined},enemyDamage:0,enemySource:null});
      if(p.fire&&p.packet){const own=s.fields.filter(f=>f.source===p.packet!.source&&f.kind==='fire').sort((a,b)=>a.id-b.id);if(own.length>=2)s.fields=s.fields.filter(f=>f.id!==own[0].id);s.fields.push({id:s.nextEntityId++,source:p.packet.source,kind:'fire',x:p.tx,y:p.ty,radius:p.fire.radius,expires:s.tick+p.fire.duration,nextTick:s.tick,dps:p.fire.dps,damageType:'thermal',slow:0,slowDuration:0,pull:0,burnDuration:p.fire.burnDuration,armorIgnore:p.fire.armorIgnore});}p.remaining=0;continue;
    }
    const old={x:p.x,y:p.y},stepLength=Math.hypot(p.vx,p.vy)/30,travel=p.travelRemaining===undefined?1:Math.min(1,p.travelRemaining/(stepLength||1));p.x+=p.vx/30*travel;p.y+=p.vy/30*travel;if(p.travelRemaining!==undefined)p.travelRemaining=Math.max(0,p.travelRemaining-stepLength);
    if(p.enemySource){if(p.y>=450){hitWall(s,p.enemyDamage,p.enemySource);p.remaining=0;}continue;}
    const dx=p.x-old.x,dy=p.y-old.y,len2=dx*dx+dy*dy;
    const contacts=alive(s).filter(e=>!p.hitIds.includes(e.id)).map(e=>{const t=Math.max(0,Math.min(1,((e.x-old.x)*dx+(e.y-old.y)*dy)/(len2||1)));return {e,t,d:distance(e,{x:old.x+t*dx,y:old.y+t*dy})};}).filter(x=>x.d<=x.e.radius+p.radius).sort((a,b)=>a.t-b.t||a.e.id-b.e.id);
    for(const {e} of contacts){if(!p.remaining)break;if(p.packet)hitEnemy(s,e,{...p.packet,raw:p.packet.raw*(p.falloff[p.hitIds.length]??1),...(usesSkillTrees(s)&&p.hitIds.length?{exposure:undefined}:{})});p.hitIds.push(e.id);p.remaining--;}
  }
  s.projectiles=s.projectiles.filter(p=>p.remaining>0&&(p.travelRemaining===undefined||p.travelRemaining>0)&&p.expires>s.tick&&p.y>=-50);
}
function stepFields(s:RunState){
  for(const f of s.fields){
    if(f.expires<=s.tick)continue;
    const targets=area(s,f.x,f.y,f.radius);
    if(f.kind==='gravity')for(const e of targets){
      applyEffect(s,e,{id:`field:${f.source}`,kind:'slow',source:f.source,expires:s.tick+f.slowDuration,value:f.slow,armorIgnore:0,nextTick:0});
      if(f.exposure)applyEffect(s,e,{id:`exposure:${f.source}:field`,kind:'exposure',source:f.source,value:Math.min(.25,f.exposure),expires:s.tick+ticks(.6),armorIgnore:0,nextTick:0});
      if(boss(e)&&e.moveImmuneUntil>s.tick)continue;
      const d=distance(e,f);if(d>1){const amount=Math.min(d,f.pull/30*(boss(e)?.25:1)*(usesFreeSkills(s)?eventMultiplier(s,e.wave,'displacement'):1));e.x+=(f.x-e.x)/d*amount;e.y+=(f.y-e.y)/d*amount;if(boss(e))e.moveImmuneUntil=s.tick+ticks(6);if(e.y<450)e.attackAt=0;}
    }
    if(f.nextTick<=s.tick){
      for(const e of targets)if(f.kind==='gravity')hitEnemy(s,e,{source:f.source,skill:'gravity-field',raw:f.dps*.5,damageType:f.damageType,armorIgnore:f.armorIgnore,shieldMultiplier:1});else applyEffect(s,e,{id:`burn:${f.source}:field`,kind:'burn',source:f.source,value:f.dps,expires:s.tick+f.burnDuration,armorIgnore:f.armorIgnore,nextTick:s.tick+15});
      f.nextTick=s.tick+15;
    }
  }s.fields=s.fields.filter(f=>f.expires>s.tick);
}
export function stepRun(s:RunState,count=1):void{
  if(!Number.isInteger(count)||count<0||count>14400)throw new Error('Invalid simulation step count');
  for(let i=0;i<count;i++){
    if(getPhase(s)!=='running')break;
    s.tick++;
    while(s.spawnCursor<s.spawnPlan.length&&s.spawnPlan[s.spawnCursor].at<=s.tick){const p=s.spawnPlan[s.spawnCursor++];createEnemy(s,p.defId,p.x,20,p.xp,p.wave);}
    if(!usesRangeRules(s)&&!s.bossSpawned&&s.tick>=ticks(360)){s.bossSpawned=true;createEnemy(s,STAGE_MAP[s.config.stageId].bossId,195,150,0,9);}
    s.shields=s.shields.filter(x=>x.value>0&&x.expires>s.tick);
    stepEffects(s);stepWeapons(s);stepProjectiles(s);stepFields(s);
    for(const h of s.scheduled.filter(h=>h.at<=s.tick)){
      if(h.packet){const targets=area(s,h.x,h.y,h.radius);for(const e of targets)hitEnemy(s,e,h.packet);if(usesFreeSkills(s)&&h.packet.skill==='cluster-burst')emit(s,{kind:'explosion',x:h.x,y:h.y,radius:h.radius,affectedIds:targets.map(t=>t.id),source:h.packet.source,skill:h.packet.skill});}
      else if(h.enemySource)hitWall(s,h.enemyDamage,h.enemySource);
    }s.scheduled=s.scheduled.filter(h=>h.at>s.tick);
    if(usesFreeSkills(s))stepSupport(s);
    stepEnemies(s);s.enemies=s.enemies.filter(e=>e.hp>0);
    if(usesRangeRules(s)&&!s.bossSpawned&&s.tick>=ticks(360)&&s.wallHp>0){s.bossSpawned=true;const entering=createEnemy(s,STAGE_MAP[s.config.stageId].bossId,195,150,0,9);s.bossIntro={enemyId:entering.id,remainingMs:BOSS_INTRO_MS};s.pauseReasons.push('boss-intro');}
    if(s.wallHp<=0)s.outcome='wall';
    else if(s.bossKilled&&s.spawnCursor===s.spawnPlan.length&&!s.enemies.length&&(!usesFreeSkills(s)||s.choicesSpent>=s.choicesEarned))s.outcome='victory';
    else if(s.tick>=ticks(480))s.outcome='timeout';
    if(!s.outcome)openDraft(s);s.phase=getPhase(s);
  }
}
export function snapshotRun(s:RunState):RunState{return structuredClone(s);}
export function restoreRun(raw:unknown):RunState{
  if(!raw||typeof raw!=='object')throw new Error('戰局快照損壞');const s=raw as RunState;
  if(s.schemaVersion!==SCHEMA_VERSION||!supportedContent(s.contentVersion))throw new Error('戰局版本不相容，請保留進度並重開本局');
  const template=createRun(s.config,s.contentVersion);
  const finite=(v:unknown):boolean=>typeof v==='number'?Number.isFinite(v):Array.isArray(v)?v.every(finite):v&&typeof v==='object'?Object.values(v).every(finite):true;
  if(!finite(s)||!Number.isInteger(s.tick)||s.tick<0||s.tick>ticks(480)||!Array.isArray(s.enemies)||!Array.isArray(s.projectiles)||!Array.isArray(s.fields)||!Array.isArray(s.spawnPlan)||!Array.isArray(s.pauseReasons)||!Array.isArray(s.actions)||!s.rng||!s.stats||s.wallHp<0||s.wallHp>s.wallMaxHp||s.choicesSpent>s.choicesEarned||s.evolvedCount>s.evolutionLimit||s.weapons.length!==s.config.squadIds.length)throw new Error('戰局快照損壞');
  if(!!s.bossIntro!==s.pauseReasons.includes('boss-intro')||s.bossIntro&&(!usesRangeRules(s)||!s.bossSpawned||!Number.isSafeInteger(s.bossIntro.enemyId)||!Number.isFinite(s.bossIntro.remainingMs)||s.bossIntro.remainingMs<0||s.bossIntro.remainingMs>BOSS_INTRO_MS||!s.enemies.some(e=>e.id===s.bossIntro!.enemyId&&e.defId===STAGE_MAP[s.config.stageId].bossId)))throw new Error('首領登場紀錄損壞');
  if(s.projectiles.some(p=>p.travelRemaining!==undefined&&(!Number.isFinite(p.travelRemaining)||p.travelRemaining<0)))throw new Error('彈體射程紀錄損壞');
  const validInteger=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
  const required=['weapons','shields','scheduled','events','actions','spawnPlan'] as const;
  if(required.some(key=>!Array.isArray(s[key]))||s.enemies.length>2000||s.projectiles.length>2000||s.fields.length>20||!s.runId||!['running','choosing','paused','ended'].includes(s.phase)||s.pauseReasons.some(p=>!['user','upgrade','hidden','orientation','tutorial','error','boss-intro','tree'].includes(p))||new Set(s.pauseReasons).size!==s.pauseReasons.length||s.phase!==getPhase(s))throw new Error('戰局狀態損壞');
  if(!validInteger(s.choicesSpent,0,usesFreeSkills(s)?24:18)||!validInteger(s.choicesEarned,0,usesFreeSkills(s)?24:18)||!validInteger(s.rerollsRemaining,0,3)||!validInteger(s.spawnCursor,0,s.spawnPlan.length)||!validInteger(s.nextEntityId,1)||!Object.values(s.rng).every(n=>validInteger(n,1,0xffffffff)))throw new Error('戰局計數損壞');
  if(new Set(s.weapons.map(w=>w.id)).size!==s.weapons.length||s.weapons.some(w=>!s.config.squadIds.includes(w.id)||!validInteger(w.rank,0,3)||(w.rank===0?w.branch!==null:!['A','B'].includes(w.branch??''))||!validInteger(w.nextAttack)||!validInteger(w.attacks)||!Array.isArray(w.droneAttacks)||w.droneAttacks.length!==2||!w.droneAttacks.every(n=>validInteger(n)))||Object.entries(s.commonRanks).some(([id,rank])=>!/^G0[1-6]$/.test(id)||!validInteger(rank,0,2)))throw new Error('武器改造紀錄損壞');
  if(s.enemies.some(e=>!ENEMY_MAP[e.defId]||!validInteger(e.id,1)||e.hp<0||e.hp>e.maxHp||e.shield<0||!Array.isArray(e.effects)||e.effects.some(f=>!['slow','stun','exposure','burn'].includes(f.kind)||!CHARACTER_IDS.includes(f.source as CharacterId)&&f.source!=='boss'||!validInteger(f.expires)||!validInteger(f.nextTick)))||s.spawnPlan.some(p=>!ENEMY_MAP[p.defId]||!validInteger(p.at)||!validInteger(p.xp)))throw new Error('敵人或波次紀錄損壞');
  const hasNumbers=(row:unknown,keys:string[])=>!!row&&typeof row==='object'&&keys.every(k=>typeof (row as Record<string,unknown>)[k]==='number'&&Number.isFinite((row as Record<string,number>)[k]));
  const ids=usesCollection(s)?CHARACTER_IDS:STARTER_IDS;
  if(!hasNumbers(s,['wallMaxHp','xp','evolvedCount','evolutionLimit','tacticalReadyAt','nextOfferId','eventSeq','actionSeq'])||ids.some(id=>!['A','B'].includes(s.preferredBranches?.[id]))||!hasNumbers(s.stats.damageByCharacter,ids)||!hasNumbers(s.stats.shieldDamageByCharacter,ids)||!hasNumbers(s.stats.controlTicks,ids))throw new Error('戰局欄位不完整');
  if(usesCollection(s)&&(!Array.isArray(s.mines)||s.mines.length>12||s.mines.some(m=>!hasNumbers(m,['id','x','y','plantedAt','armedAt','expires','radius','triggerRadius','chargeRate','chargeCap'])||m.source!=='C07'||m.packet.source!==m.source)||s.weapons.some(w=>w.id==='C08'&&(!hasNumbers(w,['heat','ventUntil'])||w.heat!<0||w.heat!>100||typeof w.cooling!=='boolean'))))throw new Error('地雷或熱量紀錄損壞');
  if(s.enemies.some(e=>!hasNumbers(e,['id','x','y','hp','maxHp','shield','armor','speed','radius','xp','wave','spawnedAt','attackAt','abilityAt','summonAt','chargeUntil','rushUntil','stunImmuneUntil','moveImmuneUntil','exposureUntil','summonCount','arcCharges']))||s.projectiles.some(p=>!hasNumbers(p,['id','x','y','tx','ty','vx','vy','expires','remaining','radius','blastRadius','enemyDamage','impactAt'])||!Array.isArray(p.hitIds)||!Array.isArray(p.falloff))||s.fields.some(f=>!hasNumbers(f,['id','x','y','radius','expires','nextTick','dps','slow','slowDuration','pull','burnDuration','armorIgnore'])||!CHARACTER_IDS.includes(f.source))||s.scheduled.some(h=>!hasNumbers(h,['at','x','y','radius','enemyDamage'])))throw new Error('戰局物件資料不完整');
  const entityIds=[...s.enemies,...s.projectiles,...s.fields,...s.mines??[]].map(e=>e.id);if(new Set(entityIds).size!==entityIds.length)throw new Error('戰局物件重複');
  if(!usesFreeSkills(s)&&s.draft&&(!validInteger(s.draft.id,1)||!Array.isArray(s.draft.cards)||s.draft.cards.length<1||s.draft.cards.length>3||new Set(s.draft.cards.map(c=>c.nodeId)).size!==s.draft.cards.length||s.draft.cards.some(c=>c.nodeId!=='EMPTY'&&!getLegalNodeIds(s).includes(c.nodeId))))throw new Error('改造候選紀錄損壞');
  if(usesSkillTrees(s)){validateTreeState(s);if(!usesFreeSkills(s)&&s.draft&&(s.draft.choice!==s.choicesSpent+1||(getLegalNodeIds(s).length===0 ? s.draft.cards.length!==1||s.draft.cards[0].nodeId!=='EMPTY'||s.draft.cards[0].kind!=='empty' : s.draft.cards.length!==Math.min(3,getLegalNodeIds(s).length)||s.draft.cards.filter(c=>c.kind==='focus').length!==1||s.draft.cards[0].nodeId!==s.draft.customNodeId||s.draft.cards.slice(1).some(c=>c.kind!=='random'))))throw new Error('技能樹候選紀錄損壞');}
  if(usesFreeSkills(s)&&(JSON.stringify(s.wavePlan)!==JSON.stringify(template.wavePlan)||JSON.stringify(s.spawnPlan)!==JSON.stringify(template.spawnPlan)))throw new Error('戰場預告紀錄損壞');
  return structuredClone(s);
}

/** Only the entrance clock advances while combat is frozen; other pause reasons take precedence. */
export function advanceBossIntro(s: RunState, elapsedMs: number) {
  if (!s.bossIntro || s.outcome || s.pauseReasons.some(r => r !== 'boss-intro') || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 500) return false;
  s.bossIntro.remainingMs = Math.max(0, s.bossIntro.remainingMs - elapsedMs);
  return s.bossIntro.remainingMs === 0 && command(s, { type: 'finish-boss-intro' });
}
