import './browser-setup.mjs';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(`http://localhost:${process.env.PORT||8080}/?map=legacy`);
 await page.waitForFunction(()=>window.__debug,null,{timeout:60000});
 const cases=await page.evaluate(async()=>{
  const {addCrime}=await import('./js/police.js'),random=Math.random;
  const run=(witness,roll,onDuty=false)=>{
   const world={wanted:0,wantedTimer:20,onDuty,player:{pos:{x:0,z:0}},peds:witness?[{pos:{x:3,z:3}}]:[]};
   Math.random=()=>roll;addCrime(world,2);return {wanted:world.wanted,dodged:world.crimeDodged||0};
  };
  try{return {unseenLucky:run(false,.25),unseenReported:run(false,.75),witnessed:run(true,.25),onDuty:run(true,.25,true)};}
  finally{Math.random=random;}
 });
 assert.deepEqual(cases,{unseenLucky:{wanted:0,dodged:1},unseenReported:{wanted:2,dodged:0},witnessed:{wanted:2,dodged:0},onDuty:{wanted:0,dodged:0}});
 console.log('PASS unchanged police witness rules reproduce zero-heat branch and guarantee witnessed crime reporting',JSON.stringify(cases));
 await context.close();
}finally{await browser.close();}
