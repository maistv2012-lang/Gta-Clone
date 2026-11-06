// Serial execution: concurrent software WebGL browsers invalidate timings.
import {createWriteStream} from 'node:fs';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const output=process.env.GTC_TEST_OUTPUT||'docs/performance/regression';await mkdir(output,{recursive:true});
const groups=[
 ['build',['scripts/check-build.mjs']],
 ['units',['--test','test/christchurch-spawn.test.mjs','test/map-network.test.mjs','test/map-loader.test.mjs','test/visual-quality.test.mjs','test/render-performance.test.mjs']],
 ['real-map-data',['test/real-map-data.mjs']],
 ...['startup-browser','map-browser','spawn-browser','preview-render','visual-demo','visual-visibility','render-contracts'].map(name=>[name,[`test/${name}.mjs`],name==='map-browser'?{GTC_REAL_MAP:'1'}:{}]),
 ['map-synthetic',['test/map-browser.mjs'],{}],
 ...['featurecheck','mobiletest','fulltest','newfeatures','intensetest','season3test','season4test','season8btest','season9test','season10test','keytest','screenshots'].map(name=>[name,['--import','./test/browser-setup.mjs',`test/${name}.mjs`],{GTC_TEST_MAP:'legacy',GTC_LOW_GFX:'1'}]),
];
let results=[];
if(process.env.GTC_TEST_RESUME==='1'){try{results=JSON.parse(await readFile(`${output}/results.json`,'utf8'));}catch{}}
for(const[name,args,env={}]of groups.filter(([name])=>(!process.env.GTC_TEST_FILTER||new RegExp(process.env.GTC_TEST_FILTER).test(name))&&!(process.env.GTC_TEST_RESUME==='1'&&results.some(r=>r.name===name&&r.passed)))){
 console.log(`START ${name}`);let log='';const started=Date.now();const streamLog=createWriteStream(`${output}/${name}.log`);
 const child=spawn(process.execPath,args,{env:{...process.env,PORT:'8080',...env},stdio:['ignore','pipe','pipe']});
 for(const stream of[child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk;streamLog.write(chunk);});
 const timer=setTimeout(()=>child.kill('SIGTERM'),20*60000);
 const code=await new Promise(resolve=>child.on('close',resolve));clearTimeout(timer);await new Promise(resolve=>streamLog.end(resolve));
 await writeFile(`${output}/${name}.log`,log);
 const failures=log.split('\n').filter(line=>/^(?:FAIL\b|PAGE ERROR:)|\bFAIL\s*$|\bFAIL\s+[—(]/.test(line));
 if(!log.trim())failures.push('No test output captured; execution is unverified');
 const result={name,code,durationSeconds:(Date.now()-started)/1000,failures,passed:code===0&&!failures.length};results=results.filter(r=>r.name!==name);results.push(result);
 console.log(JSON.stringify(result));await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));
}
if(results.some(r=>!r.passed))process.exitCode=1;
