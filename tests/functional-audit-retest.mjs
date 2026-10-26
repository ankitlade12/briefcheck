// Independent AI-agent functional probe, no provider calls. Fresh in-memory server on port 5174.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {analyze} from '../server/analysis.mjs';
import {assembleReview} from '../src/engine.mjs';
import {carryReviewState} from '../src/review-state.mjs';
import {exportData,htmlReport} from '../src/export.mjs';
const base='http://127.0.0.1:5174', results=[];
async function call(path,body,cookie='',method=body?'POST':'GET'){
 const r=await fetch(base+'/api'+path,{method,headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const suffix=Date.now();
const users=[];
for(const prefix of ['owner','editor','reviewer']){
 const name=prefix+'_'+suffix; const u=await call('/auth',{action:'register',name,password:'Synthetic-password-123!'});assert.equal(u.status,200);users.push({...u,name});
}
const [owner,editor,reviewer]=users;
const docs=['Demo video must be at most 2 minutes.','Demo video must be at least 3 minutes.'].map((text,i)=>({id:'s'+i,title:'Source '+i,role:'official rules',coverage:{},text}));
const run=await analyze(docs,'deterministic');
const workspace={title:'original',documents:docs,runs:[run],revisions:[],clarifications:[]};
const saved=await call('/workspaces',workspace,owner.cookie);assert.equal(saved.status,200);const path='/workspaces/'+saved.data.id;
for(const [u,role] of [[editor,'editor'],[reviewer,'reviewer']])assert.equal((await call(path+'/access',{name:u.name,role},owner.cookie)).status,200);
const opened=await call(path,undefined,owner.cookie);assert.deepEqual(opened.data.runs[0],run);results.push({check:'save and reopen immutable run',pass:true});
const rerun=await analyze(docs,'deterministic');
const rejected=await call(path+'/decisions',{runId:rerun.id,findingId:rerun.findings[0].id,status:'accepted',reason:''},owner.cookie);
results.push({check:'API rejects unpersisted run; browser handles decision locally',pass:rejected.status===400,actual:rejected});
const editorSave=await call(path,{...workspace,title:'editor latest',revision:1},editor.cookie,'PUT');assert.equal(editorSave.status,200);
const decision=await call(path+'/decisions',{revision:1,runId:run.id,findingId:run.findings[0].id,status:'accepted',reason:'Owner decision on stale local copy'},owner.cookie);assert.equal(decision.status,409);
const local=structuredClone(workspace);// Stale decision is rejected, so UI retains its old revision.
const staleSave=await call(path,{...local,revision:1},owner.cookie,'PUT');
const after=await call(path,undefined,owner.cookie);
results.push({check:'decision revision must not enable stale whole-workspace overwrite',pass:after.data.title==='editor latest',actual:{decisionStatus:decision.status,staleSaveStatus:staleSave.status,finalTitle:after.data.title}});
const denied=await call(path,{...workspace,revision:after.data.revision},reviewer.cookie,'PUT');assert.equal(denied.status,403);
const reviewerDecision=await call(path+'/decisions',{runId:run.id,findingId:run.findings[0].id,status:'deferred',reason:''},reviewer.cookie);assert.equal(reviewerDecision.status,200);results.push({check:'reviewer cannot edit workspace but can decide persisted findings',pass:true});
const template=await call('/templates',{title:'Synthetic template',documents:docs},owner.cookie);assert.equal(template.status,200);
const templates=await call('/templates',undefined,owner.cookie);assert.deepEqual(templates.data.find(t=>t.id===template.data.id).data,docs);results.push({check:'private template source round trip',pass:true});
run.decisions[run.findings[0].id]={status:'accepted',reason:'Original interpretation'};
const changed=run.requirements.map((r,i)=>i===0?{...r,predicate:{...r.predicate,value:60},correction:{reason:'New interpretation'}}:r);
const corrected=assembleReview(run.versions,{requirements:changed,errors:[]});carryReviewState(run,corrected);
results.push({check:'predicate correction must flag carried decision for reconfirmation',pass:corrected.decisions[run.findings[0].id]?.needsReview===true,actual:corrected.decisions[run.findings[0].id]});
const all=exportData({...workspace,runs:[run,corrected]},true),redacted=exportData({...workspace,runs:[run,corrected]},false);
assert.equal(all.runs[0].versions[0].text,docs[0].text);assert.equal(redacted.runs[0].versions[0].text,undefined);assert.equal(redacted.runs[0].versions[0].contentHash,run.versions[0].contentHash);assert.ok(htmlReport(all).includes(run.versions[0].contentHash));results.push({check:'export retains version hashes and includes raw text only on opt-in',pass:true});
const result={provenance:'Independent AI-agent functional probe, not human validation',createdAt:new Date().toISOString(),results};
await writeFile(new URL('../evaluation/independent-agent.functional-retest-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
