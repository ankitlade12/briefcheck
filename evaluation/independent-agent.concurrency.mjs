import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:5174';
async function call(path,body,cookie='',method=body?'POST':'GET'){
 const r=await fetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
async function delayed(path,body,cookie,method='PUT'){
 const text=JSON.stringify(body);let finish;
 const result=new Promise((resolve,reject)=>{
 const req=http.request(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie,'Content-Length':Buffer.byteLength(text)}},res=>{let data='';res.on('data',x=>data+=x);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(data)}));});
 req.on('error',reject);req.write(text.slice(0,-1));finish=()=>req.end(text.slice(-1));
 });
 await new Promise(r=>setTimeout(r,100));return {finish,result};
}
const owner=await call('/auth',{action:'register',name:'retest_owner',password:'Test-only-password-123!'});
const editor=await call('/auth',{action:'register',name:'retest_editor',password:'Test-only-password-123!'});
assert.equal(owner.status,200);assert.equal(editor.status,200);
const raw=JSON.parse(await readFile(new URL('./independent-agent.retest-results.json',import.meta.url)));
const review=raw.results.find(r=>r.id==='disjoint-team-bounds').review;
const workspace={title:'original',documents:review.versions,runs:[review],revisions:[]};
const saved=await call('/workspaces',workspace,owner.cookie);assert.equal(saved.status,200);
const path='/workspaces/'+saved.data.id;
const checks=[];
const slow=await delayed(path,{...workspace,title:'stale overwrite',revision:1},owner.cookie);
const fast=await call(path,{...workspace,title:'newer saved',revision:1},owner.cookie,'PUT');assert.equal(fast.status,200);
slow.finish();const stale=await slow.result;assert.equal(stale.status,409);
let current=await call(path,undefined,owner.cookie);assert.equal(current.data.title,'newer saved');assert.equal(current.data.revision,2);
checks.push({name:'delayed PUT cannot overwrite newer save',pass:true,slowStatus:stale.status,fastStatus:fast.status,revision:current.data.revision});
assert.equal((await call(path+'/access',{name:'retest_editor',role:'editor'},owner.cookie)).status,200);
const revoked=await delayed(path,{...workspace,title:'revoked overwrite',revision:2},editor.cookie);
assert.equal((await call(path+'/access',{name:'retest_editor',role:'remove'},owner.cookie)).status,200);
revoked.finish();const denial=await revoked.result;assert.equal(denial.status,403);
current=await call(path,undefined,owner.cookie);assert.equal(current.data.title,'newer saved');assert.equal(current.data.revision,2);
checks.push({name:'delayed editor PUT denied after revocation',pass:true,status:denial.status,revision:current.data.revision});
const decision={runId:review.id,findingId:review.findings[0].id,status:'accepted',reason:'Synthetic test'};
const delayedDecision=await delayed(path+'/decisions',decision,owner.cookie,'POST');
assert.equal((await call(path,{...workspace,title:'newest saved',revision:2},owner.cookie,'PUT')).status,200);
delayedDecision.finish();const decisionResult=await delayedDecision.result;assert.equal(decisionResult.status,200);
current=await call(path,undefined,owner.cookie);assert.equal(current.data.title,'newest saved');assert.equal(current.data.revision,4);assert.equal(current.data.runs[0].decisions[decision.findingId].status,'accepted');
checks.push({name:'delayed decision preserves intervening workspace save',pass:true,status:decisionResult.status,revision:current.data.revision});
assert.equal((await call(path+'/access',{name:'retest_editor',role:'reviewer'},owner.cookie)).status,200);
const revokedDecision=await delayed(path+'/decisions',{...decision,status:'deferred'},editor.cookie,'POST');
assert.equal((await call(path+'/access',{name:'retest_editor',role:'remove'},owner.cookie)).status,200);
revokedDecision.finish();const decisionDenial=await revokedDecision.result;assert.equal(decisionDenial.status,403);
current=await call(path,undefined,owner.cookie);assert.equal(current.data.revision,4);assert.equal(current.data.runs[0].decisions[decision.findingId].status,'accepted');
checks.push({name:'delayed reviewer decision denied after revocation',pass:true,status:decisionDenial.status,revision:current.data.revision});
const report={provenance:'Independent AI-agent executed retest, not human validation',createdAt:new Date().toISOString(),server:'Fresh port 5174 server; NODE_ENV=production; BRIEFCHECK_DB=:memory:',checks};
await writeFile(new URL('./independent-agent.concurrency-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
