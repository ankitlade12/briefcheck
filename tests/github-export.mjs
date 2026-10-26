// Opt-in live test: publishes one synthetic report to the configured public archive.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:5173';
const headers={Origin:base,'Content-Type':'application/json'};
const auth=await fetch(base+'/api/auth',{method:'POST',headers,body:JSON.stringify({action:'register',name:'archive_test_'+Date.now().toString(36),password:crypto.randomUUID()})});
assert.equal(auth.status,200);
headers.Cookie=auth.headers.get('set-cookie').split(';')[0];
const report=JSON.parse(await readFile('/tmp/briefcheck-browser-export.json','utf8'));
report.title='Synthetic English end-to-end verification';
const denied=await fetch(base+'/api/integrations/export',{method:'POST',headers,body:JSON.stringify({report,confirm:false})});
assert.equal(denied.status,400);
const sent=await fetch(base+'/api/integrations/export',{method:'POST',headers,body:JSON.stringify({report,confirm:true})});
const result=await sent.json();assert.equal(sent.status,200,JSON.stringify(result));
assert.match(result.url,/^https:\/\/github.com\/ankitlade12\/briefcheck\/blob\//);
const publicRead=await fetch(result.url);assert.equal(publicRead.status,200);
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
await writeFile('test-results/github-export-results.json',JSON.stringify({runAt:new Date().toISOString(),explicitConfirmationRequired:true,authenticatedExportPassed:true,anonymousPublicReadStatus:publicRead.status,...result},null,2));
console.log(JSON.stringify(result));
