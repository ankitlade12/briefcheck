import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { analyze } from '../server/analysis.mjs';
import { diffReviews } from '../src/engine.mjs';
const suite = JSON.parse(await readFile(new URL('./independent-agent.cases.json', import.meta.url), 'utf8'));
const results = [];
for (const c of suite.cases) {
  const docs = c.texts.map((text, i) => ({id:`doc-${i}`,title:`Synthetic source ${i+1}`,role:'official rules',coverage:{criteria:false,deliverables:false},text,inputMethod:'synthetic'}));
  const review = await analyze(docs, 'deterministic');
  let revision;
  if (c.revision) {
    const next = await analyze(docs.map((d,i)=>i===1?{...d,text:c.revision}:d),'deterministic');
    revision={review:next,changes:diffReviews(review,next)};
  }
  results.push({id:c.id,expect:c.expect,review,revision});
}
const report={provenance:suite.provenance,createdAt:new Date().toISOString(),engineSha256:createHash('sha256').update(await readFile(new URL('../src/engine.mjs',import.meta.url))).digest('hex'),casesSha256:createHash('sha256').update(await readFile(new URL('./independent-agent.cases.json',import.meta.url))).digest('hex'),results};
await writeFile(new URL('./independent-agent.retest-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for (const r of results) console.log(JSON.stringify({id:r.id,requirements:r.review.requirements.map(x=>({topic:x.topic,modality:x.modality,scope:x.scope,predicate:x.predicate,status:x.status})),findings:r.review.findings.map(x=>({type:x.type,title:x.title})),errors:r.review.errors.map(x=>x.message),changes:r.revision?.changes.map(x=>x.state)}));
