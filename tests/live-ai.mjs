import {analyze} from '../server/analysis.mjs';
import {outcome,verifyEvidence,evaluate} from '../src/engine.mjs';
import {writeFile} from 'node:fs/promises';
const cases=[
 {language:'English',a:'Demo video must be at most 3 minutes.\nJudging criteria: Design, Innovation.',b:'Demo video must be under 3 minutes.\nJudging criteria: Design, Innovation, Impact.'},

];
const results=[];
for(const c of cases){try{const r=await analyze([{id:'overview',title:'Overview',role:'overview',text:c.a,coverage:{criteria:true}},{id:'rules',title:'Rules',role:'official rules',text:c.b,coverage:{criteria:true}}],'ai');const numeric=r.requirements.filter(x=>x.topic==='duration');const result={language:c.language,status:r.status,model:r.model,timingMs:r.timingMs,usage:r.usage,findings:r.findings.map(f=>({type:f.type,topic:f.topic})),validEvidence:r.findings.every(f=>f.evidence.every(e=>verifyEvidence(e,r.versions))),durationOutcomes:numeric.map(x=>({scope:x.scope,modality:x.modality,predicate:x.predicate,result:outcome(x,{duration:180,track:'general'})})),requirements:r.requirements,errors:r.errors,passed:r.findings.some(f=>f.topic==='duration')&&r.findings.some(f=>f.type==='omission'&&f.topic==='criteria')&&numeric.length===2&&evaluate(numeric[0].predicate,{duration:180})===true&&evaluate(numeric[1].predicate,{duration:180})===false};results.push(result);console.log(JSON.stringify(result));}catch(e){results.push({language:c.language,passed:false,error:e.message});console.log(JSON.stringify(results.at(-1)));}}
await writeFile('evaluation/live-ai-english-results.json',JSON.stringify({runAt:new Date().toISOString(),note:'English-only release smoke test using the real configured provider.',results},null,2));
process.exitCode=results.every(r=>r.passed)?0:1;
