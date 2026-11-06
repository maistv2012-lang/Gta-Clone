// Static site: validate syntax and local module closure without a bundler.
import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
let files=0,imports=0;
for(const file of await readdir('js')){
 if(!file.endsWith('.js'))continue;const path=`js/${file}`,text=await readFile(path,'utf8');
 const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);files++;
 for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){
  await access(new URL(match[1],new URL(`../${path}`,import.meta.url)));imports++;
 }
}
const html=await readFile('index.html','utf8');assert.match(html,/vendor\/three/);
for(const path of ['data/christchurch.json','manifest.json','package.json'])JSON.parse(await readFile(path,'utf8'));
await access('.nojekyll');console.log(`PASS ${files} source modules parse; ${imports} local imports resolve; JSON and static Pages entry present`);
