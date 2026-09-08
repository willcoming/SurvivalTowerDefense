import { ELEMENTS, FORMS, FORM_MAP } from '../data/forms';
import { isPlayable, ownedForm } from '../storage/collection';
import type { GameSave } from '../storage/repository';
import type { CharacterId, DamageType } from '../sim/types';
import { esc } from './format';

export function elementBadge(type:DamageType,weakness=false){const e=ELEMENTS[type];return `<span class="element-badge" style="--element:${e.color}">${e.icon} ${weakness?'弱點・':''}${e.name}${weakness?' ×1.5':''}</span>`;}
export function formControls(save:GameSave,id:CharacterId){
  const selected=ownedForm(save.collection,id),playable=isPlayable(save.collection,id);
  return `<div class="form-controls"><label for="form-${id}">出戰形態 ${playable?'':'・尚未招募'}</label><select id="form-${id}" data-change="form" ${save.activeRun?'disabled':''}>${!playable?'<option value="">取得任一形態即可出戰</option>':''}${FORMS.filter(f=>f.ownerId===id).map(f=>`<option value="${f.id}" ${selected===f.id?'selected':''} ${save.collection.owned.includes(f.id)?'':'disabled'}>${esc(f.name)}${save.collection.owned.includes(f.id)?'':'・未取得'}</option>`).join('')}</select>${selected?elementBadge(FORM_MAP[selected].damageType)+`<small>${esc(FORM_MAP[selected].passive)}</small>`:''}</div>`;
}
