import './browser-setup.mjs';import {chromium} from 'playwright-core';import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const map of [...Array(8).fill('legacy'),'real']){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:${process.env.PORT||8080}/${map==='legacy'?'?map=legacy':''}`);
  await page.waitForFunction(()=>window.__debug&&!document.querySelector('#playbtn').disabled,null,{timeout:150000});
  const result=await page.evaluate(async()=>{
   const d=__debug,h=d.cheist(),{resolveCircle,pointBlocked}=await import('./js/city.js'),preferred=h.casinoPos.clone().add({x:-7,y:0,z:5}),table=d.world.propMarks?.find(m=>m.def.key==='casino')?.pos||h.casinoPos;
   const approach=h.vaultPos.clone().add({x:.5,y:0,z:.5}),initial=approach.clone();for(let i=0;i<5;i++)resolveCircle(approach,.5,d.world.city.colliders,.5);
   const preferredClear=!pointBlocked(preferred,d.world.city.colliders,1.4)&&Math.hypot(preferred.x-table.x,preferred.z-table.z)>=6.5;
   return {osm:!!d.world.city.osm,preferred:preferred.toArray(),hatch:h.vaultPos.toArray(),preferredClear,keptClearPreferred:!preferredClear||preferred.distanceTo(h.vaultPos)<1e-6,
    afterCollisionDistance:Math.hypot(approach.x-h.vaultPos.x,approach.z-h.vaultPos.z),approachShift:approach.distanceTo(initial),tableDistance:Math.hypot(h.vaultPos.x-table.x,h.vaultPos.z-table.z),
    meshMatches:Math.hypot(h.hatch.position.x-h.vaultPos.x,h.hatch.position.z-h.vaultPos.z)<1e-6,rendererInitialized:d.graphics().initialized};
  });
  assert.equal(result.osm,map==='real');assert.ok(result.afterCollisionDistance<2.6);assert.ok(result.approachShift<.01);assert.ok(result.tableDistance>=6.5);assert.ok(result.keptClearPreferred&&result.meshMatches);assert.deepEqual(errors,[]);
  results.push({map,...result,errors});console.log(`PASS ${map} vault has a clear player approach within original drilling radius and outside blackjack range`,JSON.stringify(result));await context.close();
 }
 await mkdir('docs/rugby-release',{recursive:true});await writeFile('docs/rugby-release/casino-placement.json',JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
