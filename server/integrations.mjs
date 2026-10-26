import {spawn} from 'node:child_process';
export function integrationDestinations(){
 if(process.env.BRIEFCHECK_GITHUB_REPO)return [`Public GitHub review archive: ${process.env.BRIEFCHECK_GITHUB_REPO}`];
 return process.env.BRIEFCHECK_WEBHOOK_URL?['Configured review webhook']:[];
}
export async function exportToGitHub(report,remoteAddress){
 const repo=process.env.BRIEFCHECK_GITHUB_REPO;
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo||''))throw new Error('Configure a valid fixed GitHub repository.');
 // Local CLI credentials must never become a remotely exposed write capability.
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remoteAddress)||process.env.BRIEFCHECK_BIND&&!['127.0.0.1','::1'].includes(process.env.BRIEFCHECK_BIND))throw new Error('GitHub CLI export is restricted to this local computer. Use a scoped webhook for remote hosting.');
 if(report?.schema_version!=='1.0'||!Array.isArray(report.runs)||typeof report.title!=='string')throw new Error('A versioned BriefCheck report is required.');
 const path=`reports/review-${Date.now()}-${crypto.randomUUID().slice(0,8)}.json`;
 const payload=JSON.stringify({message:'archive: add explicitly exported BriefCheck review',content:Buffer.from(JSON.stringify(report,null,2)).toString('base64')});
 return new Promise((resolve,reject)=>{
  const child=spawn('gh',['api','--hostname','github.com',`repos/${repo}/contents/${path}`,'--method','PUT','--input','-'],{stdio:['pipe','pipe','pipe']});let output='';
  const timeout=setTimeout(()=>child.kill('SIGTERM'),20000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1000000)child.kill('SIGTERM')});child.stderr.resume();
  child.on('error',()=>{clearTimeout(timeout);reject(new Error('GitHub CLI is unavailable. Authenticate locally with gh auth login.'))});
  child.on('close',code=>{clearTimeout(timeout);if(code!==0)return reject(new Error('GitHub export failed. Check local GitHub authentication and write access to the configured repository.'));try{const result=JSON.parse(output);resolve({url:result.content.html_url,commit:result.commit.sha,path})}catch{reject(new Error('GitHub returned an invalid export response.'))}});
  child.stdin.on('error',()=>{});child.stdin.end(payload);
 });
}
