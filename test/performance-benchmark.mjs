import './browser-setup.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
const stage=process.env.GTC_BENCH_STAGE||'after';
const out=process.env.GTC_BENCH_OUTPUT||`docs/performance/${stage}`;await mkdir(out,{recursive:true});
// UUID allocation must not consume the gameplay seed: caching creates fewer
// objects. Both copies receive the same metadata-only RNG isolation in transit.
const vendor=await readFile(new URL('../vendor/three/three.module.js',import.meta.url),'utf8');
const isolatedVendor=vendor.replace(/function generateUUID\(\) \{([\s\S]*?)\n\}/,(whole,body)=>{
 assert.equal((body.match(/Math\.random\(\)/g)||[]).length,4);
 return `let __benchmarkUUIDSeed=0x9e3779b9;
 function __benchmarkUUIDRandom(){__benchmarkUUIDSeed=(Math.imul(__benchmarkUUIDSeed,1664525)+1013904223)>>>0;return __benchmarkUUIDSeed/4294967296;}
 function generateUUID(){${body.replaceAll('Math.random()','__benchmarkUUIDRandom()')}\n}`;
});
assert.notEqual(isolatedVendor,vendor);
const sourceHash=createHash('sha256');
for(const name of (await readdir(new URL('../js/',import.meta.url))).filter(n=>n.endsWith('.js')).sort()){sourceHash.update(name);sourceHash.update(await readFile(new URL(`../js/${name}`,import.meta.url)));}
const sourceFingerprint=sourceHash.digest('hex'),mapSha256=createHash('sha256').update(await readFile(new URL('../data/christchurch.json',import.meta.url))).digest('hex');
// Verify the served checkout, not just the files next to this harness.
const rootURL=`http://localhost:${process.env.PORT||8080}/`;
for(const path of ['js/graphics.js','js/main.js','js/characters.js','js/christchurch-city.js','data/christchurch.json']) {
 const response=await fetch(new URL(path,rootURL));assert.equal(response.status,200,`${path} HTTP`);
 const served=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
 const local=createHash('sha256').update(await readFile(new URL(`../${path}`,import.meta.url))).digest('hex');
 assert.equal(served,local,`Server is not delivering the selected checkout: ${path}`);
}
console.log('Verified server sources and real-map bytes:',rootURL,sourceFingerprint);
let browser;const results=[];
try{
 for(const mobile of [false,true]){
  browser=await chromium.launch({channel:'chrome',headless:true});
  const name=mobile?'mobile-medium':'desktop-high';
  const context=await browser.newContext({viewport:mobile?{width:384,height:832}:{width:800,height:500},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  await context.addInitScript(({mobile})=>{
    // Idle render measurement: optional capture must not expire during cold shaders.
    HTMLElement.prototype.requestPointerLock=()=>Promise.resolve();
    const stats=window.__benchmarkGL={programsCreated:0,shaderSubmissions:0,compileSubmissionMs:0};
    const proto=WebGL2RenderingContext.prototype,create=proto.createProgram,compile=proto.compileShader;
    proto.createProgram=function(...args){stats.programsCreated++;return create.apply(this,args);};
    proto.compileShader=function(...args){const start=performance.now();try{return compile.apply(this,args);}finally{stats.shaderSubmissions++;stats.compileSubmissionMs+=performance.now()-start;}};
    let seed=0x43485249;Math.random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};localStorage.setItem('opencity-save-v1',JSON.stringify({settings:{quality:mobile?'medium':'high',fps:mobile?30:60,adaptiveResolution:false}}));},{mobile});
  await context.route('**/vendor/three/three.module.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:isolatedVendor}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const startupAt=Date.now();
  await page.goto(`http://localhost:${process.env.PORT||8080}/`);await page.waitForFunction(()=>window.__debug&&!document.querySelector('#playbtn').disabled,null,{timeout:100000});const mapReadyMs=Date.now()-startupAt;assert.equal(await page.evaluate(()=>!!__debug.world.city.osm&&__debug.world.city.spawnArea==='Cathedral Square'&&!__debug.world.settings.lowGfx),true);const clickAt=Date.now();await page.locator('#playbtn')[mobile?'tap':'click']();const playClickMs=Date.now()-clickAt;
  await page.waitForFunction(()=>__debug.graphics().frames>3&&!__debug.world.city.detailing.pending,null,{timeout:300000});
  await page.waitForFunction(()=>__debug.world.time>=6,null,{timeout:240000});
  await page.evaluate(()=>{__debug.player.health=1000;__debug.setClock(10);__debug.setCamYaw(0);__debug.setCamPitch(.15);__debug.player.pos.copy(__debug.world.city.spawn);});
  const settleFrame=await page.evaluate(()=>__debug.graphics().frames);
  await page.waitForFunction(frame=>__debug.graphics().frames>=frame+12,settleFrame,{timeout:120000});
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const measured=await page.evaluate(()=>new Promise(resolve=>{
    const start=performance.now(),base=__debug.graphics().frames;let last=start,lastFrame=base;const samples=[];
    function tick(){const now=performance.now(),g=__debug.graphics();if(g.frames!==lastFrame){samples.push({ms:(now-last)/(g.frames-lastFrame),calls:g.calls,triangles:g.triangles});last=now;lastFrame=g.frames;}
      if((now-start>=30000&&samples.length>=20)||now-start>90000){
        const frames=g.frames-base,duration=now-start,ms=samples.map(s=>s.ms).sort((a,b)=>a-b),avg=k=>samples.reduce((s,v)=>s+v[k],0)/samples.length;
        const gl=document.getElementById('game').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');
        let objects=0,meshes=0;const geometries=new Set(),materials=new Set(),buffers=new Set();let geometryBytes=0;const countBuffer=a=>{if(a?.array?.buffer)buffers.add(a.array.buffer);};
        __debug.world.scene.traverse(o=>{objects++;if(o.isMesh){meshes++;if(o.geometry&&!geometries.has(o.geometry)){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes)){geometryBytes+=a.array?.byteLength||0;countBuffer(a);}geometryBytes+=o.geometry.index?.array.byteLength||0;countBuffer(o.geometry.index);}for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);}});
        resolve({frames,durationMs:duration,averageFps:frames*1000/duration,meanFrameMs:duration/frames,p95FrameMs:ms[Math.floor(ms.length*.95)],drawCalls:avg('calls'),triangles:avg('triangles'),graphics:g,objects,meshes,uniqueGeometries:geometries.size,uniqueMaterials:materials.size,geometryAttributeBytes:geometryBytes,uniqueGeometryBufferBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),jsHeapBytes:performance.memory?.usedJSHeapSize,shaderSubmissions:window.__benchmarkGL,errors:window.__gtcBoot?.failed||false});return;
      }requestAnimationFrame(tick);
    }requestAnimationFrame(tick);
  }));
  const cpu=await cdp.send('Profiler.stop');await writeFile(`${out}/${name}-cpu.json`,JSON.stringify(cpu.profile));
  const metrics=await cdp.send('Performance.getMetrics');const heap=Object.fromEntries(metrics.metrics.filter(m=>/JSHeap|Nodes|TaskDuration|ScriptDuration/.test(m.name)).map(m=>[m.name,m.value]));
  assert.equal(measured.errors,false);assert.deepEqual(errors,[]);assert.ok(measured.frames>=20);
  const result={name,stage,sourceFingerprint,mapSha256,commit:process.env.GTC_BENCH_COMMIT,viewport:mobile?{width:384,height:832}:{width:800,height:500},quality:mobile?'medium':'high',adaptiveResolution:false,freshBrowserPerCase:true,serverSourcesVerified:true,uuidRngIsolated:true,pointerCaptureStubbed:true,minimumWarmupGameSeconds:6,cameraSettledFrames:12,mapReadyMs,playClickMs,...measured,cdp:heap,pageErrors:errors,browser:browser.version()};results.push(result);await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(result));await page.screenshot({path:`${out}/${name}.png`});await context.close();await browser.close();browser=null;
 }
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
}finally{await browser?.close();}
