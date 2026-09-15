import type { RunConfig, StageId, WaveBrief } from '../sim/types';

export type EncounterKind = 'advance' | 'rush' | 'armor' | 'shield' | 'artillery' | 'repair' | 'elite' | 'mixed' | 'respite';
export interface EncounterPattern {
  name: string; hint: string; weights: Record<string, number>; groupInterval: number;
  variant: WaveBrief['variant']; event: WaveBrief['event'];
}
/** Authored threat packages reuse existing enemies and their existing counterplay. */
export const ENCOUNTER_PATTERNS: Record<EncounterKind, EncounterPattern> = {
  advance: { name: '前哨推進', hint: '先建立清場火力，保留應對快敵的手段。', weights: { C: 12, R: 3, P: 2 }, groupInterval: 2.2, variant: 'standard', event: 'none' },
  rush: { name: '迅刃側襲', hint: '快敵集中抵達；緩速、擊退或連鎖能減少漏怪。', weights: { C: 6, R: 12, S: 2, D: 1 }, groupInterval: 1.4, variant: 'fast', event: 'gravity' },
  armor: { name: '重裝縱隊', hint: '高裝甲單位成群推進；準備穿甲、燃燒與集中火力。', weights: { C: 5, P: 10, M: 2, A: 2, H: 1 }, groupInterval: 2, variant: 'armored', event: 'heat' },
  shield: { name: '棱盾掩護', hint: '護盾掩護後排；破盾與範圍輸出需要一起建立。', weights: { C: 6, S: 9, A: 2, R: 3, M: 1 }, groupInterval: 1.8, variant: 'shielded', event: 'ion' },
  artillery: { name: '砲手交叉火力', hint: '遠程砲手集中蓄力；穿透、打斷或護盾能降低傷害。', weights: { C: 5, A: 7, P: 4, S: 3, M: 1 }, groupInterval: 1.5, variant: 'standard', event: 'none' },
  repair: { name: '修復護送', hint: '工蜂跟隨重裝；持續單點容易被修回，範圍打擊更有效。', weights: { C: 5, P: 6, S: 4, M: 4, A: 1 }, groupInterval: 1.8, variant: 'armored', event: 'heat' },
  elite: { name: '精英突破', hint: '保留控場處理半血衝刺，並準備拆除精英護盾。', weights: { C: 6, P: 4, S: 3, R: 3, H: 2, D: 2 }, groupInterval: 1.3, variant: 'standard', event: 'gravity' },
  mixed: { name: '協同壓境', hint: '快敵、重裝與後排交錯進場；清場和單體火力都不可缺。', weights: { C: 4, R: 5, P: 5, S: 4, A: 3, M: 2, H: 1, D: 1 }, groupInterval: 1.6, variant: 'standard', event: 'none' },
  respite: { name: '補給間隙', hint: '敵群較疏，趁這段時間補齊下一輪威脅所需的技能。', weights: { C: 14, R: 2, A: 1 }, groupInterval: 3, variant: 'standard', event: 'none' },
};

interface StageEncounter { focus: string; plan: readonly EncounterKind[] }
export const STAGE_ENCOUNTERS: Record<StageId, StageEncounter> = {
  S01: { focus: '先清群怪，再應對迅刃與重裝。', plan: ['advance','rush','armor','mixed'] },
  S02: { focus: '破盾與清後排並重，避免棱盾拖住全部火力。', plan: ['advance','shield','artillery','respite','shield'] },
  S03: { focus: '交替處理快攻、重裝，最後保留核心爆發。', plan: ['advance','rush','armor','respite','elite','mixed'] },
  S04: { focus: '快速敵群掩護砲手，留一輪控場處理交叉火力。', plan: ['advance','rush','artillery','respite','shield','rush','mixed'] },
  S05: { focus: '重裝與修復交錯，穿甲之外也需要範圍壓制。', plan: ['advance','armor','repair','respite','shield','armor','artillery','elite'] },
  S06: { focus: '多路快攻牽制火力，別把所有技能用在第一批迅刃。', plan: ['advance','rush','shield','respite','artillery','elite','armor','respite','mixed'] },
  S07: { focus: '拆開護盾、重裝與修復的保護鏈。', plan: ['advance','shield','repair','respite','armor','artillery','shield','respite','repair','elite'] },
  S08: { focus: '重甲正面推進後接迅刃側襲，控場需要涵蓋兩輪。', plan: ['advance','armor','rush','respite','artillery','repair','elite','respite','armor','rush','mixed'] },
  S09: { focus: '精英混在不同編成中，準備跨波次的清場與收尾火力。', plan: ['advance','shield','rush','respite','armor','elite','artillery','respite','repair','shield','elite','mixed'] },
  S10: { focus: '補給重裝反覆壓進，必須在工蜂修復前擊破核心目標。', plan: ['advance','armor','artillery','respite','repair','shield','elite','respite','armor','repair','artillery','respite','mixed'] },
  S11: { focus: '棱盾後方藏著砲手與快敵，破盾路線不能犧牲全部清場能力。', plan: ['advance','shield','artillery','respite','rush','armor','shield','respite','repair','elite','artillery','respite','shield','mixed'] },
  S12: { focus: '整合各種反制；危險波次後仍有調整構築的窗口。', plan: ['advance','rush','armor','respite','shield','repair','elite','respite','artillery','armor','rush','respite','shield','elite','mixed'] },
  X01: { focus: '補給路線以快攻與砲手為主，保持機動清場。', plan: ['advance','rush','artillery','respite','repair','mixed'] },
  X02: { focus: '潮汐試裝考驗護盾與重裝反制，無須夏日形態。', plan: ['advance','shield','armor','respite','rush','artillery','mixed'] },
  X03: { focus: '輪番應對海岸敵群，最後一輪需同時清場與集火。', plan: ['advance','rush','repair','respite','shield','armor','artillery','mixed'] },
};

export function encounterPattern(stage: StageId, wave: number) {
  return ENCOUNTER_PATTERNS[STAGE_ENCOUNTERS[stage].plan[wave - 1] ?? 'mixed'];
}

export function encounterWeights(stage: StageId, wave: number, difficulty: NonNullable<RunConfig['difficulty']> = 'easy') {
  const weights = { ...encounterPattern(stage, wave).weights };
  // Stronger compositions replace crawlers; no extra XP, enemy cap or forced rare form.
  if (difficulty === 'hard' && wave > 1 && STAGE_ENCOUNTERS[stage].plan[wave - 1] !== 'respite') {
    weights.C = Math.max(2, (weights.C ?? 0) - 2);
    for (const code of ['P','S','A']) if (weights[code]) weights[code] += 1;
  }
  // Keep elites sparse and teach regular units before their elite counterparts.
  if (wave < 4) { delete weights.H; delete weights.D; }
  if (wave <= 3) for (const code of ['P','S','M']) if (weights[code]) weights[code] *= .6;
  return weights;
}
