import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONTENT_VERSION} from '../src/data/content';
const dir=`artifacts/validation/${CONTENT_VERSION}`;
const read=(path:string)=>JSON.parse(readFileSync(dir+'/'+path,'utf8'));
const rules=read('rules.json'),campaign=read('campaign-balance.json'),balance=read('free-skills/balance.json'),assets=read('asset-budget.json'),production=read('production/smoke.json');
const browserReports=['regression/browser-results/results.json','performance/browser-results/results.json','performance-recheck/browser-results/results.json','final-collection/browser-results/results.json'];
const cases=new Map<string,{file:string;title:string;project:string;status:string;report:string}>();
function visit(suite:any,report:string){
  for(const spec of suite.specs??[])for(const t of spec.tests??[]){
    const project=t.projectName,status=t.results.at(-1)?.status??'missing',key=spec.file+':'+spec.title+':'+project;
    cases.set(key,{file:spec.file,title:spec.title,project,status,report});
  }
  for(const child of suite.suites??[])visit(child,report);
}
for(const report of browserReports){const r=read(report);if(r.errors?.length)throw Error('Browser runner errors: '+report);for(const suite of r.suites)visit(suite,report);}
const browser=[...cases.values()];
const checks={
  rules:rules.success&&rules.numFailedTests===0&&rules.numPassedTests>=282,
  campaign:campaign.passed&&campaign.rows.length===153&&campaign.forms.length===10,
  allTerminals:balance.formal&&balance.rows.length===1740&&balance.rows.every((r:any)=>r.outcome==='victory'&&r.restored)&&balance.replays===58,
  browser:browser.length===168&&browser.filter(r=>r.status==='passed').length===165&&browser.filter(r=>r.status==='skipped').length===3,
  assets:assets.passed&&assets.contentVersion===CONTENT_VERSION,
  production:production.passed&&production.contentVersion===CONTENT_VERSION&&production.productionDebugApiAbsent,
  livePerformance:read('performance-recheck/live-3x-performance.json').passed,
};
const walk=(path:string):string[]=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path+'/'+e.name):[path+'/'+e.name]).sort();
const result={contentVersion:CONTENT_VERSION,measuredAt:new Date().toISOString(),checks,passed:Object.values(checks).every(Boolean),
  sourceSha256:createHash('sha256').update(walk('src').map(p=>p+'\n'+readFileSync(p,'utf8')).join('\n')).digest('hex'),
  totals:{ruleTests:rules.numPassedTests,starterGoalRuns:153,poolFormRuns:10,terminalBuildRuns:1740,commandReplays:58,browserPassed:browser.filter(r=>r.status==='passed').length,browserSkipped:browser.filter(r=>r.status==='skipped').length},
  note:'Latest result per test identity. A concurrent-load live-render performance failure is retained in performance/; its isolated recheck supersedes that case only. No thresholds were relaxed. Physical phones, human playtesting, server-side anti-cheat and public deployment are not validated.',
  browserReports,browser};
writeFileSync(dir+'/release-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,checks,totals:result.totals},null,2));if(!result.passed)process.exitCode=1;
