import { usesFreeSkills } from './deep-trees';
import type { CharacterId, RunState } from '../sim/types';

export const TREE_CONTENT_VERSION = '0.2.0-dev.1';
export const usesSkillTrees = (s: Pick<RunState, 'contentVersion'>) => s.contentVersion === TREE_CONTENT_VERSION || usesFreeSkills(s);
export interface TreeMods {
  damage?: number; haste?: number; range?: number; radius?: number; duration?: number; burn?: number;
  armor?: number; shield?: number; exposureDamage?: number; eliteDamage?: number;
  targets?: number; pierce?: number; jumps?: number; jumpRange?: number; jumpPower?: number;
  burstDamage?: number; burstRadius?: number; stunEvery?: number; stunSeconds?: number;
  fieldDamage?: number; fieldRadius?: number; fieldDuration?: number; pull?: number; slow?: number;
  knockEvery?: number; knockback?: number; fireDamage?: number; fireDuration?: number;
  drones?: number; exposureValue?: number; exposureEvery?: number; exposureSeconds?: number;
  autoShield?: number; shieldInterval?: number; shieldDuration?: number;
  skillDamage?: number; skillCooldown?: number; skillDuration?: number; skillRadius?: number; skillShield?: number;
}
export interface SkillNode { id: string; treeId: string; ownerId: CharacterId; kind: 'entry' | 'branch' | 'ultimate'; name: string; description: string; mods: TreeMods }
export interface SkillTree { id: string; ownerId: CharacterId; name: string; purpose: string; visualBranch: 'A' | 'B'; nodes: SkillNode[] }
type NodeInput = [string, string, TreeMods];
function tree(ownerId: CharacterId, code: string, name: string, purpose: string, nodes: [NodeInput, NodeInput, NodeInput, NodeInput, NodeInput], visualBranch: 'A'|'B' = code === 'B' ? 'B' : 'A'): SkillTree {
  const id = `${ownerId}-${code}`;
  return { id, ownerId, name, purpose, visualBranch, nodes: nodes.map(([name, description, mods], index) => ({ id: `${id}:${index}`, treeId: id, ownerId, kind: index === 0 ? 'entry' : index === 4 ? 'ultimate' : 'branch', name, description, mods })) };
}
export const SKILL_TREES: SkillTree[] = [
  tree('C01','A','多重掃射','分散火力，處理多路群怪。',[
    ['火力校準','武器傷害 +12%。',{damage:.12}],
    ['急速供彈','武器攻速 +15%。',{haste:.15}],
    ['延伸槍管','射程 +45；隊長技能範圍 +15%。',{range:45,skillRadius:.15}],
    ['側翼彈道','增加 1 個不同目標，額外彈道為主彈 55% 傷害。',{targets:1}],
    ['蜂巢齊射','再增加 1 個不同目標；武器傷害 +15%，隊長技能傷害 +25%。',{targets:1,damage:.15,skillDamage:.25}],
  ]),
  tree('C01','B','破盾穿透','穿過敵陣，拆解護盾。',[
    ['共振彈芯','對護盾倍率 +0.30。',{shield:.3}],
    ['貫穿彈','主彈多穿透 1 人，後續目標為主彈 80% 傷害。',{pierce:1}],
    ['聚能膛室','武器傷害 +18%。',{damage:.18}],
    ['共振加壓','對護盾倍率 +0.35；隊長技能傷害 +15%。',{shield:.35,skillDamage:.15}],
    ['破盾日冕','武器傷害 +65%，主彈再多穿透 1 人；隊長技能傷害 +25%。',{damage:.65,pierce:1,skillDamage:.25}],
  ]),
  tree('C01','C','弱點追擊','自行標記弱點，與曝露隊友連動。',[
    ['弱點標記','每 3 次攻擊對主目標施加 10% 曝露 3 秒。',{exposureEvery:3,exposureValue:.1,exposureSeconds:3}],
    ['追擊演算','對曝露目標追加 20% 武器傷害。',{exposureDamage:.2}],
    ['快速鎖定','武器攻速 +15%，隊長技能冷卻 -6%。',{haste:.15,skillCooldown:.06}],
    ['狩獵鏡片','武器傷害 +10%，射程 +40。',{damage:.1,range:40}],
    ['日光獵手','武器傷害 +25%，對曝露目標再追加 35% 傷害；隊長技能傷害 +30%。',{damage:.25,exposureDamage:.35,skillDamage:.3}],
  ]),
  tree('C02','A','連鎖清場','電弧在密集敵群之間接力。',[
    ['遠距導電','電弧跳躍距離 +25。',{jumpRange:25}],
    ['接力放電','增加 1 次電弧跳躍。',{jumps:1}],
    ['低耗傳導','每跳保留傷害 +0.15（上限 90%）。',{jumpPower:.15}],
    ['高頻充能','武器攻速 +15%，隊長技能冷卻 -6%。',{haste:.15,skillCooldown:.06}],
    ['連鎖天幕','再增加 2 次電弧跳躍，武器傷害 +20%；隊長技能傷害 +25%。',{jumps:2,damage:.2,skillDamage:.25}],
  ]),
  tree('C02','B','磁暴引爆','持續命中累積磁暴，打斷敵人。',[
    ['磁核增幅','武器傷害 +15%。',{damage:.15}],
    ['磁暴印記','同一主目標每 3 次命中引爆 35 電弧傷害，半徑 65。',{burstDamage:35,burstRadius:65}],
    ['靜默脈衝','每 5 次主攻擊暈眩主目標 0.4 秒。Boss 適用控場抗性。',{stunEvery:5,stunSeconds:.4}],
    ['過載循環','武器攻速 +15%，隊長技能控場時間 +15%。',{haste:.15,skillDuration:.15}],
    ['磁暴囚籠','磁暴傷害追加 65，半徑 +15，爆炸附帶 0.7 秒暈眩；隊長技能傷害 +25%。',{burstDamage:65,burstRadius:80,stunSeconds:.7,skillDamage:.25}],
  ]),
  tree('C03','A','長線貫穿','以直線射擊清除縱深重甲。',[
    ['加速軌道','武器傷害 +15%。',{damage:.15}],
    ['延長貫穿','直線多命中 2 人，傷害依序遞減，最低 50%。',{pierce:2}],
    ['高速復進','武器攻速 +15%。',{haste:.15}],
    ['反甲彈芯','裝甲忽略 +15 個百分點；隊長技能冷卻 -6%。',{armor:.15,skillCooldown:.06}],
    ['星穿長槍','直線再多命中 2 人，武器傷害 +45%；隊長技能傷害 +25%。',{pierce:2,damage:.45,skillDamage:.25}],
  ]),
  tree('C03','B','核心狙殺','集中主目標傷害，狙殺精英與 Boss。',[
    ['重型獵手','對精英與 Boss 武器傷害 +25%。',{eliteDamage:.25}],
    ['凝縮彈芯','武器傷害 +18%。',{damage:.18}],
    ['穿甲聚焦','裝甲忽略 +15 個百分點。',{armor:.15}],
    ['再裝填演算','武器攻速 +12%，隊長技能冷卻 -8%。',{haste:.12,skillCooldown:.08}],
    ['事件視界','主目標追加 85% 武器傷害，對精英與 Boss 傷害再 +25%；隊長技能傷害 +40%。',{eliteDamage:.25,skillDamage:.4}],
  ]),
  tree('C04','A','引力聚怪','將敵人聚集在隊友的範圍火力內。',[
    ['廣域重力','武器範圍半徑 +15%。',{radius:.15}],
    ['吸積場','每次射擊留下 1.2 秒引力場：半徑 65、6 DPS、拉力 12；最多一片。',{fieldDamage:6,fieldRadius:65,fieldDuration:1.2,pull:12}],
    ['時差延展','武器狀態時間 +25%，隊長技能控場時間 +15%。',{duration:.25,skillDuration:.15}],
    ['壓縮衝擊','武器傷害 +20%，緩速強度 +5 個百分點。',{damage:.2,slow:.05}],
    ['引力漩渦','引力場追加 12 DPS、半徑 +20、持續 +1.8 秒、拉力 +12；隊長技能冷卻 -10%。',{fieldDamage:12,fieldRadius:85,fieldDuration:1.8,pull:12,skillCooldown:.1}],
  ]),
  tree('C04','B','反轉擊退','推回突進敵人，爭取防守時間。',[
    ['反衝增幅','武器傷害 +15%。',{damage:.15}],
    ['斥力脈衝','每 5 次主攻擊將命中區域敵人擊退 35。',{knockEvery:5,knockback:35}],
    ['快速反轉','武器攻速 +18%。',{haste:.18}],
    ['擴散斥力','武器範圍半徑 +20%，隊長技能控場時間 +15%。',{radius:.2,skillDuration:.15}],
    ['重力反轉','每 5 次主攻擊的擊退追加 55，武器傷害 +30%；隊長技能冷卻 -10%。',{knockEvery:5,knockback:55,damage:.3,skillCooldown:.1}],
  ]),
  tree('C05','A','持續燃燒','以附著燃燒與火區消耗重甲。',[
    ['灼熱彈藥','武器燃燒傷害 +30%。',{burn:.3}],
    ['延燒凝膠','武器狀態時間 +30%。',{duration:.3}],
    ['燃燒封鎖','砲彈落地留下 2 秒火區：半徑 70、5 DPS；最多兩片。',{fireDamage:5,fireDuration:2}],
    ['擴散火種','武器範圍半徑 +18%，隊長技能範圍 +15%。',{radius:.18,skillRadius:.15}],
    ['赤潮火海','火區追加 15 DPS、持續 +2 秒，武器燃燒傷害再 +50%；隊長技能傷害 +25%。',{fireDamage:15,fireDuration:2,burn:.5,skillDamage:.25}],
  ]),
  tree('C05','B','大範圍爆破','以大範圍瞬間爆炸處理密集敵群。',[
    ['高爆彈芯','武器爆炸傷害 +18%。',{damage:.18}],
    ['廣域震波','武器範圍半徑 +20%。',{radius:.2}],
    ['快速輸彈','武器攻速 +15%。',{haste:.15}],
    ['反甲爆破','爆炸忽略 20% 裝甲，隊長技能傷害 +15%。',{armor:.2,skillDamage:.15}],
    ['超新星彈','武器爆炸傷害 +70%，半徑再 +20%；隊長技能傷害 +25%。燃燒仍保留。',{damage:.7,radius:.2,skillDamage:.25}],
  ]),
  tree('C06','A','蜂群輸出','增加無人機火力，仍能標記弱點。',[
    ['蜂群校準','武器傷害 +15%。',{damage:.15}],
    ['伴飛無人機','增加一架副機，造成主機 50% 傷害。',{drones:1}],
    ['高速指令','武器攻速 +18%。',{haste:.18}],
    ['遠端同步','射程 +50，隊長技能冷卻 -8%。',{range:50,skillCooldown:.08}],
    ['蜂群齊射','武器傷害 +40%，副機傷害提升至主機 80%；隊長技能護盾 +40。',{damage:.4,skillShield:40}],
  ]),
  tree('C06','B','曝露協同','標記敵人弱點，支援全隊集火。',[
    ['持續標記','曝露持續時間 +2 秒。',{exposureSeconds:2}],
    ['弱點放大','曝露強度 +5 個百分點（所有曝露取最高值，上限 25%）。',{exposureValue:.05}],
    ['快速校準','武器攻速 +18%，隊長技能冷卻 -6%。',{haste:.18,skillCooldown:.06}],
    ['精準火控','對曝露目標追加 25% 武器傷害。',{exposureDamage:.25}],
    ['棱鏡共鳴','每 2 次主攻擊施加曝露，強度再 +10 個百分點；武器傷害 +25%，隊長技能護盾 +40。',{exposureEvery:2,exposureValue:.1,damage:.25,skillShield:40}],
  ],'A'),
  tree('C06','C','防線護盾','規律提供護盾，承接敵方轟擊。',[
    ['防衛校準','武器傷害 +12%，隊長技能護盾 +20。',{damage:.12,skillShield:20}],
    ['護盾節點','每 15 秒提供 60 防線護盾，持續 6 秒。',{autoShield:60,shieldInterval:15,shieldDuration:6}],
    ['快速維護','武器攻速 +15%，隊長技能冷卻 -8%。',{haste:.15,skillCooldown:.08}],
    ['持續防幕','武器傷害 +10%，自動護盾持續時間 +3 秒。',{damage:.1,shieldDuration:3}],
    ['棱鏡壁壘','自動護盾追加 80，武器傷害 +25%；隊長技能護盾 +40。不回復生命。',{autoShield:80,shieldInterval:15,shieldDuration:6,damage:.25,skillShield:40}],
  ],'B'),
];
export const TREE_MAP = Object.fromEntries(SKILL_TREES.map(t => [t.id,t])) as Record<string, SkillTree>;
export const SKILL_NODES = SKILL_TREES.flatMap(t => t.nodes);
export const NODE_MAP = Object.fromEntries(SKILL_NODES.map(n => [n.id,n])) as Record<string, SkillNode>;
export const treesFor = (id: CharacterId) => SKILL_TREES.filter(t => t.ownerId === id);
