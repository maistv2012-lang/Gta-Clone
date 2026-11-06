import './browser-setup.mjs';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 for(const mode of ['reject','throw']){
  const context=await browser.newContext({viewport:{width:640,height:480}});
  await context.addInitScript(mode=>{
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=callback=>raf(time=>{if(window.__forceSlowFrame)setTimeout(()=>callback(performance.now()),70);else callback(time);});
   localStorage.setItem('opencity-save-v1',JSON.stringify({settings:{lowGfx:true}}));
   HTMLElement.prototype.requestPointerLock=function(){const e=new DOMException('Deliberate preview capture denial','NotAllowedError');if(mode==='throw')throw e;return Promise.reject(e);};
  },mode);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://localhost:${process.env.PORT||8080}/?map=legacy`);
  await page.waitForFunction(()=>window.__debug&&!document.querySelector('#playbtn').disabled,null,{timeout:100000});
  await page.click('#playbtn');await page.waitForFunction(()=>__debug.graphics().frames>3,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.__gtcBoot.failed),false);
  assert.equal(await page.locator('#start').isVisible(),false);
  assert.equal(await page.evaluate(()=>__debug.getState()),'play');
  await page.waitForFunction(()=>__debug.graphics().frames>=20,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>document.querySelector('#game').getContext('webgl2').getError()),0);
  assert.deepEqual(errors,[]);console.log(`PASS optional pointer capture ${mode} does not interrupt rendered play`);
  if(mode==='reject') {
   await page.evaluate(()=>{window.__forceSlowFrame=true;__debug.pauseGame();});
   await page.locator('#adaptive-resolution').check();
   assert.equal(await page.evaluate(()=>__debug.world.settings.adaptiveResolution),true);
   await page.getByRole('button',{name:'RESUME',exact:true}).click();
   await page.waitForFunction(()=>__debug.graphics().pixelRatio<.8,null,{timeout:60000});
   const graphics=await page.evaluate(()=>__debug.graphics());assert.ok(graphics.pixelRatio>=.5);assert.ok(graphics.width<640*.8);
   assert.equal(await page.evaluate(()=>__debug.getState()),'play');
   await page.evaluate(()=>{window.__forceSlowFrame=false;});
   console.log('PASS adaptive resolution UI resizes actual render buffers while play remains active');
  }
  const rig=await page.evaluate(async()=>{
   const {createCharacter,applySuit}=await import('./js/characters.js');
   const a=createCharacter({shirt:'#ff0000'}),b=createCharacter({shirt:'#0000ff',build:'heavy'});
   const before=b.skin.geometry.attributes.color.array.slice();applySuit(a,{shirt:'#00ff00'});
   return {groups:a.skin.geometry.groups.length,shared:a.skin.geometry.attributes.position===b.skin.geometry.attributes.position,
    individual:a.skin.geometry.attributes.color!==b.skin.geometry.attributes.color,
    preserved:before.every((v,i)=>v===b.skin.geometry.attributes.color.array[i]),
    bones:a.skin.skeleton.bones.length,color:a.materials.shirt.color.getHex(),heavy:b.group.scale.x};
  });
  assert.equal(rig.groups,1);assert.equal(rig.shared,true);assert.equal(rig.individual,true);assert.equal(rig.preserved,true);assert.equal(rig.bones,10);assert.equal(rig.color,0x00ff00);assert.ok(rig.heavy>1);
  console.log('PASS single-draw shared rig retains independent wardrobe, skeleton and Brick proportions');
  const gold=await page.evaluate(async()=>{
   const THREE=await import('three');const {createCharacter,setCharacterQuality}=await import('./js/characters.js');const {initLegend}=await import('./js/legend.js');
   const a=createCharacter(),b=createCharacter({shirt:'#0000ff'}),scene=new THREE.Scene();scene.add(a.group,b.group);
   const original=b.skin.material[0],world={player:{mesh:a.group},scene,city:{spawn:new THREE.Vector3(20000,0,20000),colliders:[]},parked:[]};
   initLegend({},world,{crowned:true});const results=[];
   for(const quality of ['low','medium','high']){setCharacterQuality(quality,scene);results.push(a.skin.material[0].color.getHex()===0xffd24a&&!a.skin.material[0].vertexColors&&b.skin.material[0].vertexColors);}
   return {profiles:results,npcUnchanged:original.color.getHex()===0xffffff,crown:!!world._crownMesh,car:world.parked.length===1};
  });
  assert.deepEqual(gold,{profiles:[true,true,true],npcUnchanged:true,crown:true,car:true});
  console.log('PASS crowned gold finish survives all quality levels without changing NPC materials');
  const vehicles=await page.evaluate(async()=>{
   const {createCarMesh,resprayVehicle,darkenCar}=await import('./js/car.js');
   const a=createCarMesh('#ff0000'),b=createCarMesh('#0000ff');
   const detail=car=>car.group.children.find(o=>o.isLOD).levels[0].object;
   const shared=detail(a).children[0].geometry===detail(b).children[0].geometry;
   resprayVehicle({mesh:a.group},'#00ff00');const respray=a.group.children[0].material.color.getHex()===0x00ff00&&b.group.children[0].material.color.getHex()===0x0000ff;
   darkenCar({mesh:a.group});return {shared,respray,burnIndependent:b.group.children[0].material.color.getHex()===0x0000ff};
  });
  assert.deepEqual(vehicles,{shared:true,respray:true,burnIndependent:true});
  console.log('PASS shared vehicle geometry retains independent respray and damage materials');
  await context.close();
 }
}finally{await browser.close();}
