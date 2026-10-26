import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root='artifacts/submission';
await mkdir(`${root}/gallery`,{recursive:true});await mkdir(`${root}/audio`,{recursive:true});
const scenes=[
 ['Review instructions before participants see them','BriefCheck helps hackathon organizers catch conflicting instructions and missing requirements before publishing. This walkthrough uses the running app and a clearly labeled synthetic event. We will review a problem, test it, and verify a correction.'],
 ['Bring the overview and official rules into one workspace','Here are two event documents: an overview and official rules. BriefCheck preserves their source text and document roles. This demonstration uses deterministic English analysis. Optional AI assisted extraction is also available, but is not used in this recording.'],
 ['Two findings, each tied to source evidence','The review finds two issues: different video duration boundaries, and a judging criterion missing from one document. These are review findings for an organizer to inspect, not an automatic eligibility verdict or a claim that every possible issue was found.'],
 ['Test the exact boundary: 180 seconds','At most three minutes includes exactly one hundred and eighty seconds. Under three minutes excludes it. Testing the same duration against both instructions makes the practical difference visible. We save this scenario so we can test it again after editing.'],
 ['Check the original passage before making a decision','Every finding links back to its source. Here, the exact passage is highlighted in the stored document version. Evidence makes the review inspectable. The organizer can check the wording instead of relying on an unexplained AI conclusion.'],
 ['Choose the intended meaning and edit a local draft','Now we choose to exclude the exact boundary and apply suggested wording to the overview. The draft shows the original alongside the proposed change. This changes only the local draft. BriefCheck does not publish edits to the event website.'],
 ['Save the correction, then rerun the review','Saving a draft does not immediately mean the problem is solved. BriefCheck marks the changes as unchecked. We rerun the analysis against the revised instructions, keeping the previous review and document history available for comparison.'],
 ['The duration issue resolves; the unrelated omission stays','The duration issue is now resolved. Both instructions exclude exactly one hundred and eighty seconds. The separate judging criterion omission remains, because we did not fix it. A useful review should reflect what actually changed, not simply clear every warning.'],
 ['Export a review record that another person can inspect','The review can be exported as structured JSON or printable HTML. The record preserves findings, source evidence, edits, and saved scenario results. Full source text is optional, so organizers can decide what to include before sharing a report.'],
 ['BriefCheck · English review with evidence and repeatable checks','BriefCheck gives organizers a repeatable way to compare instructions, understand consequences, and check corrections. This English proof of concept is available in a public repository with setup instructions, planning documents, and verification results. Real organizer pilot testing is the next step.']
];
const durations=[];
for(let i=0;i<scenes.length;i++){
 await writeFile(`${root}/audio/${i}.txt`,scenes[i][1]);
 const r=existsSync(`${root}/audio/${i}.aiff`)?{status:0}:spawnSync('say',['-v','Samantha','-r','165','-f',`${root}/audio/${i}.txt`,'-o',`${root}/audio/${i}.aiff`]);assert.equal(r.status,0);
 const p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',`${root}/audio/${i}.aiff`],{encoding:'utf8'});durations.push(Math.max(12,Number(p.stdout)+1.2));
}
assert.ok(durations.reduce((a,b)=>a+b,0)<172,'Narration must fit the three-minute limit');
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:1080},recordVideo:{dir:`${root}/raw`,size:{width:1440,height:1080}}});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.setContent(`<style>body{margin:0;background:#102c29}iframe{display:block;width:1440px;height:960px;border:0}footer{height:120px;box-sizing:border-box;padding:20px 38px;color:white;font:25px/1.4 Arial}small{display:block;color:#a4d2c5;font:15px Arial;margin-bottom:7px}</style><iframe src="http://127.0.0.1:5173"></iframe><footer><small>BRIEFCHECK · REAL APP WALKTHROUGH · SYNTHETIC EXAMPLE</small><span id="caption"></span></footer>`);
const app=page.frameLocator('iframe');await app.getByRole('button',{name:'Load sample materials'}).waitFor();
const timeline=[];const started=Date.now();
async function scene(i){await page.locator('#caption').textContent();await page.locator('#caption').evaluate((e,t)=>e.textContent=t,scenes[i][0]);timeline.push({index:i,start:(Date.now()-started)/1000,title:scenes[i][0],narration:scenes[i][1]});console.log(`Scene ${i+1}/10: ${scenes[i][0]}`);await page.waitForTimeout(durations[i]*1000);}
async function top(){await app.locator('body').evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(300);}
async function shot(name){if(name==='06-verified-resolution'){await app.getByText('resolved',{exact:true}).evaluate(e=>e.closest('section').scrollIntoView({block:'center'}));}else if(name==='03-boundary-test'){await app.locator('.scenario-panel').evaluate(e=>e.scrollIntoView({block:'center'}));}else if(!['04-exact-evidence','05-draft-correction'].includes(name)){await top();}await page.locator('iframe').screenshot({path:`${root}/gallery/${name}.png`});}
await scene(0);
await app.getByRole('button',{name:'Load sample materials'}).click();await shot('01-source-workspace');await scene(1);
await app.getByRole('button',{name:'Review instructions'}).click();await app.getByText('Review complete: 2 findings, 0 unresolved extractions.').waitFor();await shot('02-review-findings');await scene(2);
await app.getByRole('button',{name:/Where does the time limit land/}).click();await app.getByRole('button',{name:'180s',exact:true}).click();await shot('03-boundary-test');await scene(3);await app.getByRole('button',{name:'Save scenario & results'}).click();
await app.getByRole('button',{name:'Inspect exact passage'}).first().click();assert.equal(await app.locator('dialog mark').textContent(),'Demo video must be at most 3 minutes.');await shot('04-exact-evidence');await scene(4);await app.getByRole('button',{name:'Close dialog'}).click();
await app.getByRole('button',{name:'Edit local draft'}).first().click();await app.getByLabel('Organizer’s boundary choice').selectOption('exclude');await app.getByRole('button',{name:'Apply suggested wording'}).click();await shot('05-draft-correction');await scene(5);
await app.getByRole('button',{name:'Save draft revision'}).click();await app.getByText('Unchecked changes.',{exact:true}).waitFor();await top();await scene(6);await app.getByRole('button',{name:'Rerun review'}).click();await app.getByText('Review complete: 1 findings, 0 unresolved extractions.').waitFor();
await app.getByRole('button',{name:'Coverage',exact:true}).click();await app.getByText('resolved',{exact:true}).waitFor();await shot('06-verified-resolution');await scene(7);
await app.getByRole('button',{name:'Export review',exact:true}).click();await shot('07-export-record');await scene(8);
const pending=page.waitForEvent('download');await app.getByRole('button',{name:'Structured JSON'}).click();await(await pending).saveAs(`${root}/review-example.json`);
const report=JSON.parse(await readFile(`${root}/review-example.json`,'utf8'));assert.equal(report.runs.length,2);assert.equal(report.revisions.length,1);assert.ok(report.runs[1].scenarios[0].outcomes.every(o=>o.result.startsWith('Does not meet')));
await page.locator('footer small').textContent();await page.locator('footer small').evaluate(e=>e.textContent='PUBLIC SOURCE: github.com/ankitlade12/briefcheck');await scene(9);
assert.deepEqual(errors,[]);const video=page.video();await ctx.close();await writeFile(`${root}/timeline.json`,JSON.stringify({video:await video.path(),timeline,durations,elapsed:(Date.now()-started)/1000},null,2));await browser.close();console.log('Capture and assertions passed');
