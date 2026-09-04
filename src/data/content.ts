import type { CharacterDef, CharacterId, CommonDef, EnemyDef, EnemyId, RouteDef, StageDef, StageId } from '../sim/types';

export const CONTENT_VERSION = '0.1.0-dev.3';
export const LEGACY_CONTENT_VERSION = '0.1.0-dev.2';
export const BOSS_INTRO_MS = 1500;
export const supportedContent = (version: string) => version === CONTENT_VERSION || version === LEGACY_CONTENT_VERSION;
export const SCHEMA_VERSION = 1;
export const TICKS_PER_SECOND = 30;
export const ticks = (seconds: number) => Math.ceil(seconds * TICKS_PER_SECOND);
export const WORLD = { width: 390, height: 520, wallY: 450, spawnY: 20, originX: 195, originY: 490 } as const;
export const CHARACTER_IDS: CharacterId[] = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06'];

export const CHARACTERS: CharacterDef[] = [
  { id: 'C01', name: '璃音', english: 'RION', age: 22, role: '脈衝突擊', color: '#fa765e', description: '晨星防衛隊的行動隊長。相信每一次反擊，都能替明天多留下一點希望。', weaponName: '脈衝卡賓槍', damage: 24, interval: .55, damageType: 'plasma', passive: '對曝露目標的武器傷害 +15%。', tacticalName: '天際掃射', tacticalDescription: '威脅最高位置，半徑90連續四次35電漿傷害。', cooldown: 45 },
  { id: 'C02', name: '雷娜', english: 'RENA', age: 24, role: '弧鏈清場', color: '#b08ced', description: '把外星電磁技術改造成自己的玩具。嘴上不饒人，危急時總是第一個出手。', weaponName: '弧鏈發射器', damage: 26, interval: .9, damageType: 'arc', passive: '跳至另一目標造成60%傷害，電弧對護盾倍率1.25。', tacticalName: '電磁靜默', tacticalDescription: '全場60電弧傷害、暈眩1.5秒；Boss受控場抗性限制。', cooldown: 50 },
  { id: 'C03', name: '凜月', english: 'RITSUKI', age: 23, role: '核心狙殺', color: '#93bcdc', description: '沉默的精準射手。她說的每一句話，就像扣下扳機一樣經過計算。', weaponName: '質量加速狙擊槍', damage: 68, interval: 1.8, damageType: 'kinetic', passive: '忽略35%裝甲；直線命中2人，次目標70%傷害。', tacticalName: '核心貫擊', tacticalDescription: '最大生命目標受到420動能傷害，該擊忽略全部裝甲。', cooldown: 45 },
  { id: 'C04', name: '米菈', english: 'MIRA', age: 21, role: '引力控場', color: '#60d5b9', description: '對任何「不能拆」的裝置都有興趣。她讓重力成為隊伍最可靠的朋友。', weaponName: '重力投射器', damage: 31, interval: 1.2, damageType: 'gravity', passive: '半徑45的重力衝擊，附加20%緩速1.5秒。', tacticalName: '時差力場', tacticalDescription: '全場緩速50%共5秒，立即擊退60。Boss效果折減。', cooldown: 50 },
  { id: 'C05', name: '芙蕾', english: 'FLARE', age: 25, role: '熔核爆破', color: '#ffb758', description: '擅長爆破，也擅長把所有人平安帶回家。笑聲比迫擊砲還要響亮。', weaponName: '熔核迫擊砲', damage: 44, interval: 1.5, damageType: 'thermal', passive: '半徑48爆炸，附加4 DPS燃燒3秒，燃燒忽略50%裝甲。', tacticalName: '熔星空投', tacticalDescription: '半徑100爆炸160傷害，附加12 DPS燃燒5秒。', cooldown: 50 },
  { id: 'C06', name: '希雅', english: 'SIA', age: 24, role: '棱鏡支援', color: '#e9ce91', description: '在最混亂的戰場上，仍能聽見她溫柔而清晰的指令。無人機從不離隊友太遠。', weaponName: '棱鏡無人機', damage: 16, interval: .5, damageType: 'plasma', passive: '每4次主攻擊施加10%曝露4秒，協助全隊集火。', tacticalName: '棱鏡防幕', tacticalDescription: '為防線提供220護盾8秒，不回復生命。', cooldown: 50 },
];
export const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map(c => [c.id, c])) as Record<CharacterId, CharacterDef>;

const route = (id: string, name: string, tags: string[], nodes: [string,string,string], tradeoff: string): RouteDef => ({ id, ownerId: id.slice(0,3) as CharacterId, branch: id.at(-1) as 'A' | 'B', name, tags, nodes, tradeoff });
export const ROUTES: RouteDef[] = [
  route('C01-A','蜂巢脈衝',['群怪','多重彈道'],['武器傷害 +15%','武器攻速 +15%','同時向最多3個不同目標射擊，每發65%傷害。'], '清場更廣；只有一名敵人時不會重複集火。'),
  route('C01-B','破盾日冕',['護盾','穿透'],['武器傷害 +20%','對護盾倍率提升至1.50','傷害×1.80、間隔×1.25，穿透3人；對護盾倍率2.00。'], '用射速換取破盾與縱深穿透。'),
  route('C02-A','連鎖天幕',['群怪','連鎖'],['跳躍距離 +20%','次生電弧係數提升至75%','最多跳躍4次，每次為上一跳的75%傷害。'], '敵人聚集時很強，孤立Boss時收益較低。'),
  route('C02-B','磁暴囚籠',['打斷','爆破'],['主目標傷害 +20%','武器攻速 +15%','同目標每3次主命中引爆70電弧區域傷害並暈眩1秒。'], '取消基礎跳躍，集中火力累積磁暴。'),
  route('C03-A','星穿長槍',['重甲','穿透'],['武器傷害 +15%','武器攻速 +12%','直線命中6人，傷害依序100/90/80/70/60/50%。'], '擅長排列整齊的敵群，保留35%裝甲忽略。'),
  route('C03-B','事件視界',['Boss','單體'],['對精英及Boss傷害 +20%','武器傷害 +15%','單體傷害×2.20、間隔×1.40，取消穿透。'], '重型目標殺手，需隊友處理群怪。'),
  route('C04-A','引力漩渦',['控場','場域'],['區域半徑 +15%','控場持續時間 +20%','每4秒建立3秒引力場，14 DPS、30%緩速並向中心拉扯。'], '取消直接射擊，讓隊友有更長的輸出時間。'),
  route('C04-B','重力反轉',['突進','擊退'],['武器傷害 +15%','武器攻速 +15%','每5次主攻擊，把命中區域敵人向後推70。'], '間歇性強控場，Boss位移效果有限。'),
  route('C05-A','赤潮燃燒',['燃燒','重甲'],['燃燒傷害 +25%','區域半徑 +15%','爆炸傷害×0.80，留下4秒火區，施加8 DPS燃燒。'], '持續消耗甲殼敵人，最多維持兩片火區。'),
  route('C05-B','超新星彈',['群怪','爆破'],['爆炸傷害 +20%','區域半徑 +15%','爆炸傷害×2.20、半徑×1.40、間隔×1.60。'], '取消武器燃燒，用較慢射速換取大爆炸。'),
  route('C06-A','蜂群校準',['曝露','協同'],['武器傷害 +15%','曝露時間 +2秒','雙無人機各65%傷害，曝露提升至20%，不疊加。'], '提升全隊集火收益，沒有自動防線護盾。'),
  route('C06-B','棱鏡壁壘',['護盾','防守'],['武器傷害 +15%','武器攻速 +15%','單機傷害×1.30，每15秒提供100護盾6秒。'], '以防護取代強曝露，不會回復防線生命。'),
];
export const ROUTE_MAP = Object.fromEntries(ROUTES.map(r => [r.id, r])) as Record<string, RouteDef>;
export const COMMON_UPGRADES: CommonDef[] = [
  {id:'G01',name:'共鳴增幅',description:'全隊武器與隊長技能傷害 +8%',max:2},
  {id:'G02',name:'加速迴路',description:'全隊武器攻速 +6%',max:2},
  {id:'G03',name:'廣域透鏡',description:'有限區域半徑 +10%',max:2},
  {id:'G04',name:'快速同步',description:'隊長技能冷卻 -6%',max:2},
  {id:'G05',name:'緊急補強',description:'本局最大與目前防線生命 +100',max:2},
  {id:'G06',name:'狀態延展',description:'緩速、暈眩、曝露與燃燒時間 +10%',max:2},
];
export const ENEMIES: EnemyDef[] = [
  {id:'E01',name:'裂殼爬行者',hp:140,shield:0,armor:0,speed:16,damage:8,interval:1,radius:12,color:'#9bbaa0',mechanic:'集群逼近防線。',counter:'連鎖、散射、爆炸'},
  {id:'E02',name:'迅刃獵犬',hp:90,shield:0,armor:0,speed:35,damage:14,interval:1,radius:11,color:'#d4aa78',mechanic:'快速突入防線。',counter:'緩速、擊退、快速射擊'},
  {id:'E03',name:'鐵脊重裝體',hp:460,shield:0,armor:.55,speed:10,damage:22,interval:1.2,radius:17,color:'#a9a6af',mechanic:'55%裝甲減傷。',counter:'忽略裝甲、燃燒、集中火力'},
  {id:'E04',name:'棱盾哨兵',hp:220,shield:300,armor:.1,speed:12,damage:16,interval:1.2,radius:15,color:'#65ced6',mechanic:'300點護盾，不自動回復。',counter:'電弧、破盾武器'},
  {id:'E05',name:'孢子砲手',hp:140,shield:0,armor:0,speed:10,damage:35,interval:8,radius:14,color:'#c890d0',mechanic:'停在後排，蓄力1.5秒後發射防線砲彈。',counter:'穿透、蓄力時打斷、護盾'},
  {id:'E06',name:'縫合工蜂',hp:190,shield:0,armor:.1,speed:12,damage:8,interval:1,radius:13,color:'#8acda8',mechanic:'每8秒修復附近受損友軍5%生命。',counter:'範圍清除、穿透'},
  {id:'E07',name:'精英鐵脊',hp:1000,shield:0,armor:.55,speed:10,damage:35,interval:1.2,radius:21,color:'#c79d82',mechanic:'生命降至50%時，首次產生300護盾。',counter:'破盾、單體戰術技能'},
  {id:'E08',name:'精英迅刃',hp:400,shield:0,armor:.1,speed:28,damage:30,interval:1,radius:17,color:'#e09383',mechanic:'半血後蓄力衝刺，能被打斷。',counter:'保留控場，觀察蓄力'},
  {id:'B01',name:'群巢播種者',hp:6500,shield:0,armor:.1,speed:0,damage:70,interval:14,radius:37,color:'#babe87',mechanic:'召喚爬行者，蓄力轟擊防線。',counter:'清召喚物、打斷蓄力'},
  {id:'B02',name:'棱盾監工',hp:10000,shield:1800,armor:.25,speed:0,damage:25,interval:12,radius:39,color:'#70cad5',mechanic:'定時補盾；破盾後取消蓄力並曝露6秒。',counter:'破盾與爆發配合'},
  {id:'B03',name:'降臨核心',hp:13000,shield:0,armor:.2,speed:0,damage:120,interval:18,radius:43,color:'#dc998e',mechanic:'蓄力後重擊防線，接著曝露6秒；半血產生護盾。',counter:'保留戰術技能、利用曝露窗口'},
];
export const ENEMY_MAP = Object.fromEntries(ENEMIES.map(e => [e.id,e])) as Record<EnemyId, EnemyDef>;
export const ENEMY_CODE: Record<string, EnemyId> = {C:'E01',R:'E02',P:'E03',S:'E04',A:'E05',M:'E06',H:'E07',D:'E08'};
export const STAGES: StageDef[] = [
  {id:'S01',name:'晨曦撤離線',subtitle:'CITY · 01',description:'守住車站的能源閘門，讓最後一班撤離列車平安離開。',hpMultiplier:1,bossId:'B01',color:'#d7b693',enemyIds:['E01','E02','E03','E05','B01'],waves:['C24','C22 R6','C22 P4','C22 R8 A2','C22 P6 A2','C22 R10 A3','C24 P6 R8','C24 P8 A4'],intro:['璃音：列車還需要八分鐘。這道門，一步也不能退。','雷娜：共鳴核心就緒。試試看它們自己的科技！','希雅：撤離通道已開啟。各位，我們一起守住黎明。'],outro:['米菈：最後一班列車通過了！','璃音：大家做到了。下一站，零點研究所。','凜月：趁它們還沒反應過來，輪到我們前進。']},
  {id:'S02',name:'零點研究所',subtitle:'LAB · 02',description:'保護轉譯主機。破解棱盾的共振訊號，找出敵艦核心。',hpMultiplier:1.1,bossId:'B02',color:'#80bcca',enemyIds:['E01','E02','E03','E04','E05','E06','E07','E08','B02'],waves:['C20 P4 S2','C18 R8 S4','C18 P6 A2','C20 S6 M2 A2','C20 P6 A4 M2','C20 R10 S4 D1','C20 P8 S4 A4 H1','C22 P6 R8 S4 A4'],intro:['雷娜：它們的護盾不是無敵，只是頻率藏得很好。','芙蕾：妳負責解碼，我們負責讓這裡不要爆炸。','米菈：那我可以拆一小塊嗎？就一小塊！'],outro:['雷娜：找到了，核心就在墜毀的降落艦裡。','希雅：轉譯主機安全，撤離訊號也傳出去了。','璃音：不只防守了。這一次，我們主動出擊。']},
  {id:'S03',name:'墜星反攻',subtitle:'IMPACT · 03',description:'守住核心封鎖裝置，切斷艦群再啟動。地球的第一次反攻。',hpMultiplier:1.2,bossId:'B03',color:'#e7a582',enemyIds:['E01','E02','E03','E04','E05','E06','E07','E08','B03'],waves:['C22 R6 P4','C20 R8 S4 A2','C20 P6 S4 M2','C20 R10 A4 D1','C22 P8 S4 A4','C22 R10 S6 M3','C24 P8 A4 M2 H1','C24 R10 P8 S4 A4 M2 H1 D1'],intro:['凜月：核心正在醒來。每一發，都要打在對的地方。','芙蕾：那就把它的起床氣轟回去！','璃音：晨星全員，開始反攻。讓它們知道，地球還在。'],outro:['米菈：核心停止了。這次真的停止了！','希雅：所有人的訊號都在。我們一起回家。','璃音：這只是第一場勝利。明天，我們還會站在這裡。']},
];
export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id,s])) as Record<StageId, StageDef>;
export const BUILDS: {id:string;name:string;squadIds:CharacterId[];captainId:CharacterId;routes:string[]}[] = [
  {id:'T01',name:'連鎖清場',squadIds:['C01','C02','C04','C05','C06'],captainId:'C02',routes:['C02-A','C01-A','C05-A']},
  {id:'T02',name:'核心狙殺',squadIds:['C01','C02','C03','C04','C06'],captainId:'C03',routes:['C01-B','C03-B','C06-A']},
  {id:'T03',name:'控場灼燒',squadIds:['C02','C03','C04','C05','C06'],captainId:'C04',routes:['C04-A','C05-A','C06-B']},
];
export function getCardInfo(nodeId: string) {
  if(nodeId==='EMPTY') return {name:'完成本次校準',description:'目前沒有可用的改造，繼續防守。',ownerId:null,rank:0,tags:[] as string[],tradeoff:''};
  const match=nodeId.match(/^(C\d{2}-[AB])-(\d)$/);
  if(match){const def=ROUTE_MAP[match[1]];const rank=Number(match[2]);return {name:def.name,description:def.nodes[rank-1],ownerId:def.ownerId,rank,tags:def.tags,tradeoff:def.tradeoff};}
  const def=COMMON_UPGRADES.find(x=>x.id===nodeId.split('-')[0]);
  return {name:def?.name??nodeId,description:def?.description??'',ownerId:null,rank:Number(nodeId.at(-1)),tags:['全隊'],tradeoff:'只在本局生效'};
}
