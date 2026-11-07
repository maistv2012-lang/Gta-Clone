import './browser-setup.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
await mkdir('docs/rugby-upgrade',{recursive:true});
const b=await chromium.launch({headless:true});try{
 const p=await b.newPage({viewport:{width:1200,height:760}});p.on('pageerror',e=>console.log(e.message));
 await p.route(`http://localhost:${process.env.PORT||8080}/model-sheet`,r=>r.fulfill({contentType:'text/html',body:`<html><head><meta charset="utf-8"></head><body style="margin:0;background:#17212b;color:white;font:18px Arial"><h2 style="text-align:center">RUGBY — modelo 3D original • frente / ¾ / costas</h2><script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><script type="module">
 import * as T from 'three';import {createCharacter,CHARACTERS} from '/js/characters.js';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,660);renderer.setClearColor(0x27313a);renderer.setScissorTest(true);renderer.outputColorSpace=T.SRGBColorSpace;document.body.append(renderer.domElement);
 const scene=new T.Scene(),ch=createCharacter(CHARACTERS.find(c=>c.key==='rugby').colors);scene.add(ch.group);scene.add(new T.HemisphereLight(0xdceaff,0x635c4a,2));const sun=new T.DirectionalLight(0xffeddb,3);sun.position.set(-3,6,5);scene.add(sun);
 const camera=new T.PerspectiveCamera(34,400/660,.05,20);camera.position.set(0,1.18,3.8);camera.lookAt(0,1,0);
 const uv=ch.skin.geometry.attributes.uv;window.atlasValid=true;
 for(let i=0;i<uv.count;i++) if(uv.getX(i)<.019||uv.getX(i)>.971||uv.getY(i)<.019||uv.getY(i)>.981)window.atlasValid=false;
 [0,.75,Math.PI].forEach((angle,i)=>{ch.group.rotation.y=angle;renderer.setViewport(i*400,0,400,660);renderer.setScissor(i*400,0,400,660);renderer.render(scene,camera);});window.glError=renderer.getContext().getError();window.done=true;
 </script></body></html>`}));
 await p.goto(`http://localhost:${process.env.PORT||8080}/model-sheet`);await p.waitForFunction(()=>window.done,null,{timeout:90000});assert.equal(await p.evaluate(()=>window.atlasValid),true);assert.equal(await p.evaluate(()=>window.glError),0);await p.screenshot({path:'docs/rugby-upgrade/model-sheet.png'});
 await p.close();
 for(const mobile of [false,true]) {
  const context=await b.newContext({viewport:mobile?{width:384,height:832}:{width:1100,height:700},isMobile:mobile,hasTouch:mobile});
  const menu=await context.newPage();
  await menu.goto(`http://localhost:${process.env.PORT||8080}/`);
  await menu.waitForFunction(()=>window.__debug&&!document.querySelector('#playbtn').disabled,null,{timeout:120000});
  await menu.locator('.charcard').filter({hasText:'RUGBY'})[mobile?'tap':'click']();
  await menu.waitForTimeout(500);
  await menu.screenshot({path:`docs/rugby-upgrade/${mobile?'mobile':'desktop'}-menu.png`,animations:'disabled'});
  await context.close();
 }
 console.log('PASS original 3D model sheet and settled desktop/mobile selection captures');
}finally{await b.close();}
