import { assetUrl } from '../assets';
import type { StageDef, StageId } from '../sim/types';

export const CHAPTERS=[
  {name:'晨星反攻',ids:['S01','S02','S03']},
  {name:'海岸失聯',ids:['S04','S05','S06']},
  {name:'共鳴真相',ids:['S07','S08','S09']},
  {name:'群巢決戰',ids:['S10','S11','S12']},
  {name:'星際夏日・海岸休整',ids:['X01','X02','X03']},
] as const;
export const MAIN_IDS=CHAPTERS.slice(0,4).flatMap(c=>[...c.ids]) as StageId[];
export const SIDE_IDS:StageId[]=['X01','X02','X03'];
export const CHALLENGES=['four','no-skill','two-evolutions'] as const;
export function stageUnlocked(id:StageId,cleared:StageId[]){
  if(SIDE_IDS.includes(id))return cleared.includes('S03')&&(id==='X01'||cleared.includes(SIDE_IDS[SIDE_IDS.indexOf(id)-1]));
  const index=MAIN_IDS.indexOf(id);return index===0||index>0&&cleared.includes(MAIN_IDS[index-1]);
}
export function nextStage(id:StageId){const ids=SIDE_IDS.includes(id)?SIDE_IDS:MAIN_IDS;return ids[ids.indexOf(id)+1]??null;}
export function chapterName(id:StageId){return CHAPTERS.find(c=>(c.ids as readonly string[]).includes(id))!.name;}
/** Chapters share locations, not a falsely unique copy of the same image per stage. */
export function stageArt(id:StageId){return ['S01','S02','S03'].includes(id)?assetUrl(`stages/${id}.webp`):assetUrl(`campaign/${SIDE_IDS.includes(id)?'summer':MAIN_IDS.indexOf(id)<6?'coast':MAIN_IDS.indexOf(id)<9?'resonance':'hive'}.webp`);}
export const CAMPAIGN_STAGES:StageDef[]=[
  {id:'S04',name:'靜默潮站',subtitle:'COAST · 04',description:'海岸浮標突然失聯。守住接收天線，找回海上撤離隊的訊號。',hpMultiplier:1.2,bossId:'B01',color:'#71bcc5',enemyIds:['E01','E02','E04','E05','E06','B01'],waves:['C22 R8','C20 R10 A2','C20 S4 R6','C22 R8 M2','C22 S6 A3','C22 R10 S4','C24 A4 M2','C24 R10 S6 A4'],intro:['希雅：浮標沒有損毀，是有人把訊號整段切斷。','雷娜：岸邊的電磁噪音正在變強。先讓天線活下來。','璃音：對岸還有人在等回覆。我們接上這條線。'],outro:['陌生聲音：這裡是海岸工兵隊……還有人收到嗎？','希雅：收到了。請保持頻道，我們正在過去。','凜月：訊號來自防波堤，也有敵人的補給軌跡。']},
  {id:'S05',name:'防波堤伏線',subtitle:'BREAKWATER · 05',description:'清除盤踞防波堤的重裝群，掩護工兵隊修復潮汐閘門。',hpMultiplier:1.22,bossId:'B02',color:'#6fc9ce',enemyIds:['E01','E03','E04','E05','E06','E07','B02'],waves:['C20 P5','C20 P6 S2','C20 S4 A3','C22 P6 M2','C22 P8 S3','C22 S6 A3 H1','C24 P8 M2','C24 P8 S4 A4 H1'],intro:['汐音：別走黃色標線。那裡是我留給它們的歡迎禮。','米菈：妳把共鳴核心做成地雷了？','汐音：提前準備，比臨時祈禱可靠。先守住閘門！'],outro:['汐音：工兵全員撤出。這條路現在歸妳們。','璃音：不是歸我們，是一起守住的。','汐音：那我就把剩下的佈雷圖，交給晨星頻道。']},
  {id:'S06',name:'藍潮中繼塔',subtitle:'RELAY · 06',description:'奪回海岸中繼塔，揭開誘導敵群的偽裝訊號。',hpMultiplier:1.24,bossId:'B03',color:'#72abbf',enemyIds:['E01','E02','E03','E04','E05','E06','E08','B03'],waves:['C22 R8 S2','C20 R10 A3','C22 P6 S4','C22 R10 M2 D1','C22 S6 A4','C22 P8 M2','C24 R10 S4 D1','C24 P8 S4 A4 M2'],intro:['雷娜：中繼塔在模仿人類的求救頻率，把敵人引到避難所。','芙蕾：把它轉過來，讓它們自己聽見。','璃音：先守住控制台。這一次，我們來選擇訊號的方向。'],outro:['希雅：沿岸所有避難所，通訊恢復。','雷娜：塔裡有一段地球實驗室的識別碼。','凜月：敵人的核心，為什麼認得我們？']},
  {id:'S07',name:'沉眠實驗庫',subtitle:'ARCHIVE · 07',description:'保護資料抽取器，找回共鳴計畫被封存的原始紀錄。',hpMultiplier:1.25,bossId:'B02',color:'#9cb9dd',enemyIds:['E01','E03','E04','E05','E06','E07','B02'],waves:['C20 S4 P4','C20 P6 A2','C20 S6 M2','C22 P6 S4','C22 A4 M2 H1','C22 S6 P6','C24 P8 S4','C24 S6 A4 M2 H1'],intro:['米菈：這裡的核心接口，和我們的武器完全一樣。','熾夏：因為那是測試型。別碰紅色冷卻管，它還在運作。','璃音：先把資料帶出去，再聽妳的故事。'],outro:['熾夏：我們以為只是破解外星能源，沒想到也打開了回傳通道。','希雅：現在知道了，就有機會把通道關上。','熾夏：我的砲還能用。這次不做測試，做真正的反擊。']},
  {id:'S08',name:'逆相共鳴室',subtitle:'RESONANCE · 08',description:'掩護逆相調校，分離武器能源與群巢指令。',hpMultiplier:1.26,bossId:'B01',color:'#afbddb',enemyIds:['E01','E02','E03','E05','E06','E08','B01'],waves:['C22 R8','C22 P6 A3','C20 R10 M2','C22 P8 A3','C24 R10 D1','C22 P8 M3','C24 R10 A4','C24 P8 A4 M2 D1'],intro:['汐音：我會把每個入口都設好延遲雷。妳們專心調頻。','雷娜：不只是切斷，我要讓它們認不出我們的武器。','熾夏：爭取冷卻時間這件事，我最熟。'],outro:['米菈：逆相成功！核心還有能源，但不再向群巢回報。','璃音：科技不決定我們站在哪一邊，選擇才是。','雷娜：而我剛才順手追到了它們供能中樞的位置。']},
  {id:'S09',name:'回聲斷點',subtitle:'ECHO · 09',description:'關閉最後的回傳節點，截斷降臨核心與母巢的同步。',hpMultiplier:1.28,bossId:'B03',color:'#aaa4d1',enemyIds:['E01','E02','E03','E04','E05','E06','E07','E08','B03'],waves:['C22 R8 S3','C20 P6 A3','C22 S6 M2','C22 R10 P6 D1','C22 P8 A4','C22 S6 M3 H1','C24 R10 P6','C24 P8 S4 A4 M2 H1 D1'],intro:['凜月：核心正在呼叫增援。給我一個安靜的瞄準窗口。','希雅：防幕展開，妳的窗口就在這裡。','璃音：所有路線都接上了。現在，切斷它。'],outro:['熾夏：耳機裡的雜音……消失了。','汐音：不是撤退訊號。是我們終於有自己的頻道。','璃音：下一站，群巢。結束這場漫長的防守。']},
  {id:'S10',name:'群巢輸送脈',subtitle:'SUPPLY · 10',description:'封住群巢補給隧道，阻止裝甲與護盾單位回流前線。',hpMultiplier:1.3,bossId:'B01',color:'#b9b482',enemyIds:['E01','E03','E04','E05','E06','E07','B01'],waves:['C22 P6','C22 P6 S4','C20 A4 M2','C24 P8 S3','C22 P8 M2 H1','C22 S6 A4','C24 P8 S4','C24 P8 S6 A4 M2 H1'],intro:['汐音：隧道的支架有弱點，但要等補給群全進來。','芙蕾：這頓大餐，我負責最後一道。','璃音：穩住防線，讓它們沒有回頭路。'],outro:['芙蕾：輸送脈停止，沒有漏網的補給。','希雅：地面各隊回報，敵方增援速度開始下降。','凜月：前面還有供能環。切開它，核心才會露出來。']},
  {id:'S11',name:'棱環熄燈',subtitle:'POWER · 11',description:'守住逆相裝置，逐段關閉包圍母巢的巨大護盾環。',hpMultiplier:1.32,bossId:'B02',color:'#79bdb7',enemyIds:['E01','E02','E03','E04','E05','E06','E07','B02'],waves:['C20 S6 R6','C22 P6 S4','C22 S6 A3','C22 R10 M3','C22 P8 S4 H1','C22 S6 A4 M2','C24 R10 S4','C24 P8 S6 A4 H1'],intro:['雷娜：它在替整座巢充電。只拆一塊盾是沒用的。','米菈：那就讓電流繞進我準備好的路。','熾夏：等燈熄了，我會替妳們照亮入口。'],outro:['希雅：護盾環全數離線。核心入口已開啟。','雷娜：沒有重啟訊號，我把它的開關拆下來了。','璃音：所有人檢查裝備。最後一道防線，就在前方。']},
  {id:'S12',name:'黎明歸航',subtitle:'DAWN · 12',description:'保護封鎖信標直到母巢核心停止，替地球奪回安靜的天空。',hpMultiplier:1.35,bossId:'B03',color:'#e7bc91',enemyIds:['E01','E02','E03','E04','E05','E06','E07','E08','B03'],waves:['C22 R8 P4','C22 P6 S4 A2','C22 R10 M2','C22 P8 S4 D1','C24 S6 A4','C24 P8 M3 H1','C24 R10 S6 A3','C24 R10 P8 S4 A4 M2 H1 D1'],intro:['凜月：這是最後一個座標。','希雅：所有人的訊號都在。像第一天一樣。','璃音：晨星全員，守住這裡。這次，讓黎明真正到來。'],outro:['米菈：封鎖完成。天空的噪音停了。','芙蕾：回去吧，還欠大家一頓烤宴。','汐音：海岸那條路，我已經清好了。','熾夏：那就慢慢走，讓砲管也吹吹海風。','璃音：我們一起回家。明天，不再只是戰場。']},
  {id:'X01',name:'晴海補給日',subtitle:'SUMMER · 01',description:'海岸休整的第一天。護送補給車穿過潮間帶，替大家準備夏日裝備。',hpMultiplier:1.1,bossId:'B01',color:'#6ccdd5',enemyIds:['E01','E02','E05','E06','B01'],waves:['C24','C22 R6','C24 R6','C22 R8 A2','C24 M2','C24 R8 A3','C24 R10 M2','C24 R10 A4'],intro:['芙蕾：補給清單上怎麼有泳圈？','米菈：浮力測試裝置！寫成泳圈比較省字。','璃音：先把車護送到海邊。今天的目的地，是休息。'],outro:['希雅：補給安全到達，遮陽棚也架好了。','雷娜：我的音響就當通訊測試設備吧。','璃音：准許。今天可以大聲一點。']},
  {id:'X02',name:'潮汐試裝場',subtitle:'SUMMER · 02',description:'在淺海測試夏日武裝，守住環境監測站；不需要持有任何夏日造型。',hpMultiplier:1.15,bossId:'B02',color:'#67bccb',enemyIds:['E01','E02','E03','E04','E05','B02'],waves:['C22 R6','C22 S3','C22 P4 R6','C22 S4 A2','C24 R8 P4','C22 S6 A3','C24 R10 P4','C24 S6 A4'],intro:['汐音：潮水會把未固定的雷帶走。這次得多留幾個錨點。','凜月：海風很舒服。瞄準時，還得留意海面的反光。','米菈：新裝備不是比較強，是多一種解題方式嘛。'],outro:['雷娜：海岸 DJ 測試完成，附近的盾也跟著跳舞了。','希雅：數據收好。剩下的時間，換我們下水。','熾夏：散熱效率合格。我的意思是，海風真的很好。']},
  {id:'X03',name:'星光烤宴',subtitle:'SUMMER · 03',description:'暮色降臨前完成最後一班守望，保住海岸營地與準備已久的晚餐。',hpMultiplier:1.2,bossId:'B03',color:'#edb5a0',enemyIds:['E01','E02','E03','E04','E05','E06','B03'],waves:['C22 R6 P3','C22 S4 A2','C22 P6 M2','C22 R10 A3','C22 P6 S4','C24 R10 M2','C24 S6 A3','C24 P8 S4 A4'],intro:['芙蕾：誰把烤爐溫度設成迫擊砲模式的？','米菈：我只是想縮短預熱……','璃音：先處理靠近營地的敵人。晚餐一個人也不能少。'],outro:['凜月：最後一個目標確認清除。現在可以收起瞄準鏡了。','希雅：一、二……八個杯子，剛剛好。','芙蕾：敬今天的海風，也敬明天的平安。','璃音：星光很好。這一晚，我們只看星星。']},
];
