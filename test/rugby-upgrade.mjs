import './browser-setup.mjs';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {waitForGame} from './game-time.mjs';
const output='docs/rugby-upgrade';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const reports=[];
try {
 for(const mobile of [false,true]) {
  const name=mobile?'mobile':'desktop';
  const context=await browser.newContext({viewport:mobile?{width:384,height:832}:{width:1100,height:700},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(()=>{HTMLElement.prototype.requestPointerLock=function(){return Promise.resolve();};if(!localStorage.getItem('opencity-save-v1'))localStorage.setItem('opencity-save-v1',JSON.stringify({settings:{quality:'medium',fps:30,adaptiveResolution:false}}));});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://localhost:${process.env.PORT||8080}/`);
  await page.waitForFunction(()=>window.__debug&&!document.querySelector('#playbtn').disabled,null,{timeout:120000});
  assert.equal(await page.locator('.charcard').count(),4);
  const card=page.locator('.charcard').filter({hasText:'RUGBY'});
  await card[mobile?'tap':'click']();
  assert.equal(await page.evaluate(()=>__debug.player.ch.model),'rugby');
  await page.waitForTimeout(350); // Let CSS selection transitions / Android tap highlight finish.
  assert.ok((await page.locator('.charcard.sel').textContent()).includes('RUGBY'));
  await page.screenshot({path:`${output}/${name}-menu.png`});
  const rig=await page.evaluate(async()=>{
   const {createCharacter,setCharacterModel,applySuit,CHARACTERS,animateWalk,setCharacterQuality}=await import('./js/characters.js');
   const THREE=await import('three');
   const outfit=CHARACTERS.find(c=>c.key==='rugby').colors;
   const a=createCharacter(outfit),b=createCharacter(outfit),regular=createCharacter();
   const group=a.group,skin=a.skin,scene=new THREE.Scene();scene.add(group);
   const expected=b.skin.geometry.attributes.color.array.slice();applySuit(a,{shirt:'#ff0000'});
   const independent=expected.every((n,i)=>n===b.skin.geometry.attributes.color.array[i]);
   const originalRadius=.5;
   a.skin.geometry.computeBoundingBox();const bounds=a.skin.geometry.boundingBox;
   const positions=a.skin.geometry.attributes.position,uv=a.skin.geometry.attributes.uv;
   let horizontalRadius=0,atlasValid=true;
   for(let i=0;i<positions.count;i++)horizontalRadius=Math.max(horizontalRadius,Math.hypot(positions.getX(i),positions.getZ(i)));
   for(let i=0;i<uv.count;i++)if(!Number.isFinite(uv.getX(i)+uv.getY(i))||uv.getX(i)<.019||uv.getX(i)>.971||uv.getY(i)<.019||uv.getY(i)>.981)atlasValid=false;
   const clips=[];
   for(const quality of ['low','medium','high']){setCharacterQuality(quality,scene);clips.push(a.skin.material[0].isMeshLambertMaterial===true?quality==='low':quality!=='low');}
   for(let i=0;i<20;i++){
    setCharacterModel(a,CHARACTERS.find(c=>c.key==='tank').colors);applySuit(a,{build:'heavy'});
    if(a.group!==group||a.group.scale.x!==1.13)throw Error('Brick/group changed');
    setCharacterModel(a,outfit);applySuit(a,outfit);a.setBuild('regular');
   }
   animateWalk(a,.8,.7);a.group.updateMatrixWorld(true);a.skin.skeleton.update();
   return {independent,shared:a.skin.geometry.attributes.position===b.skin.geometry.attributes.position,
    stableGroup:a.group===group,reusedSkin:a.skin===skin,pool:a._models.size,bones:a.skin.skeleton.bones.length,
    groups:a.skin.geometry.groups.length,triangles:a.skin.geometry.index.count/3,regularTriangles:regular.skin.geometry.index.count/3,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},horizontalRadius,atlasValid,fitsCollision:horizontalRadius<originalRadius,
    atlas:a.skin.material[0].map.image.width,quality:clips,animated:a.joints.some(j=>Math.abs(j.lower.rotation.x)>.01)};
  });
  assert.ok(rig.independent&&rig.shared&&rig.stableGroup&&rig.reusedSkin&&rig.fitsCollision&&rig.atlasValid);
  assert.equal(rig.pool,2);assert.equal(rig.bones,10);assert.equal(rig.groups,1);assert.equal(rig.atlas,512);
  assert.deepEqual(rig.quality,[true,true,true]);assert.ok(rig.animated);assert.ok(rig.triangles<12000);assert.ok(rig.bounds.min[1]>=-.02);
  console.log(`PASS ${name}: original rugby rig, shared atlas, 10 bones, one draw, bounded model reuse and Brick restoration`,JSON.stringify(rig));
  await page.locator('#playbtn')[mobile?'tap':'click']();
  await page.waitForFunction(()=>__debug.graphics().frames>3&&!__debug.world.city.detailing.pending,null,{timeout:240000});
  assert.equal(await page.evaluate(()=>__debug.getState()),'play');
  assert.equal(await page.evaluate(()=>__debug.world.city.spawnArea),'Cathedral Square');
  assert.equal(await page.evaluate(()=>!!__debug.world.city.osm),true);
  assert.equal(await page.evaluate(()=>__debug.player.mesh===__debug.player.ch.group),true);
  await page.evaluate(()=>{__debug.setClock(12);__debug.setCamYaw(0);__debug.setCamPitch(.03);__debug.player.heading=0;});
  await waitForGame(page,500);
  await page.screenshot({path:`${output}/${name}-cathedral-rugby.png`});
  if(mobile)assert.equal(await page.locator('#joypad').isVisible(),true);
  const start=await page.evaluate(()=>({x:__debug.player.pos.x,z:__debug.player.pos.z}));
  await page.keyboard.down('w');await waitForGame(page,700);await page.keyboard.up('w');
  const end=await page.evaluate(()=>({x:__debug.player.pos.x,z:__debug.player.pos.z}));
  assert.ok(Math.hypot(end.x-start.x,end.z-start.z)>1);
  await page.evaluate(()=>{__debug.player.pos.copy(__debug.world.city.spawn);__debug.player.vel.set(0,0,0);__debug.player.heading=0;__debug.setCamYaw(.95);});
  await waitForGame(page,300);
  await page.screenshot({path:`${output}/${name}-streets.png`});
  const before=await page.evaluate(()=>({time:performance.now(),frames:__debug.graphics().frames}));
  await page.waitForFunction(n=>__debug.graphics().frames>=n+12,before.frames,{timeout:120000});
  const metrics=await page.evaluate(before=>{
   const g=__debug.graphics(),gl=document.querySelector('#game').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {...g,averageFPS:(g.frames-before.frames)*1000/(performance.now()-before.time),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),heapBytes:performance.memory?.usedJSHeapSize,glError:gl.getError()};
  },before);
  assert.equal(metrics.glError,0);assert.equal(metrics.contextLost,false);assert.ok(metrics.calls>0);
  assert.deepEqual(errors,[]);
  await page.reload();await page.waitForFunction(()=>window.__debug&&!document.querySelector('#playbtn').disabled,null,{timeout:120000});
  assert.equal(await page.evaluate(()=>__debug.player.ch.model),'rugby');
  reports.push({name,rig,metrics,errors});
  console.log(`PASS ${name}: real Cathedral Square PLAY, movement, rendering, mobile interface and saved rugby reload`);
  await context.close();
 }
 const hash=createHash('sha256').update(await readFile('data/christchurch.json')).digest('hex');
 assert.equal(hash,'8450e30bcfd21904980edd981025eb11816eed46b8acd299e1ac158694111c46');
 await writeFile(`${output}/results.json`,JSON.stringify({mapSHA256:hash,reports},null,2));
 console.log('PASS real OSM data unchanged');
}finally{await browser.close();}
