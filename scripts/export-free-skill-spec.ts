import { writeFileSync } from 'node:fs';
import { CHARACTER_MAP } from '../src/data/content';
import { DEEP_TREES, DEEP_NODE_MAP, FREE_CONTENT_VERSION } from '../src/data/deep-trees';
const lines=[`# 自由技能樹完整節點表\n\n內容版本 ${FREE_CONTENT_VERSION}。所有節點均為本局一次性購入、每項 1 點。以下直接由遊戲內容資料產生。\n\n前置列為「或」時任一父節點即可；終極另外要求本樹已投入 4 點、角色尚無終極且全隊名額未滿。名稱後的「終極」是互斥選擇，普通節點可继续混搭。`];
for(const tree of DEEP_TREES){
  const owner=tree.ownerId==='common'?'全隊共用':CHARACTER_MAP[tree.ownerId].name;
  lines.push(`\n## ${owner} · ${tree.name}（${tree.nodes.length} 節點）\n\n${tree.purpose}\n\n| ID | 節點 | 前置 | 實際效果 |\n| --- | --- | --- | --- |`);
  for(const n of tree.nodes)lines.push(`| ${n.id} | ${n.name}${n.kind==='ultimate'?' ✦ 終極':''} | ${n.parents.map(id=>DEEP_NODE_MAP[id].name).join(n.requires==='any'?' 或 ':'＋')||'入口'}${n.kind==='ultimate'?'；本樹先投入 4 點':''} | ${n.description} |`);
}
writeFileSync('docs/FREE_SKILL_NODES.md',lines.join('\n').replace('继续','繼續')+'\n');
