// CPU-only microbenchmark; this does not measure frame rate or a physical GPU.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {nearbyColliders} from '../js/collider-query.js';
import {polygonContact} from '../js/road-network.js';
const map=JSON.parse(await readFile('data/christchurch.json','utf8'));
const colliders=map.areas.filter(a=>a.tags.building).map(a=>{
 const xs=a.points.map(p=>p[0]),zs=a.points.map(p=>p[1]);return{x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),h:Math.max(2,Math.min(180,a.height))+.3,polygon:a.points,spatialStatic:true};
});
const source=await readFile('js/city.js','utf8');
const body=source.slice(source.indexOf('export function resolveCircle'),source.indexOf('// Highest walkable surface')).replace('export ','');
const compile=query=>new Function('nearbyColliders','polygonContact',body+';return resolveCircle;')(query,polygonContact);
const indexed=compile(nearbyColliders),exhaustive=compile(c=>c);
const samples=Array.from({length:2000},(_,i)=>({x:21.8+Math.sin(i*2.399963)*Math.sqrt(i)*2,z:-33.47+Math.cos(i*2.399963)*Math.sqrt(i)*2,y:0}));
const warm=performance.now();indexed({...samples[0]},.45,colliders,1.8);const initialIndexedQueryMs=performance.now()-warm;
for(const p of samples){const a={...p},b={...p};assert.deepEqual(indexed(a,.45,colliders,1.8),exhaustive(b,.45,colliders,1.8));assert.deepEqual(a,b);}
function run(fn){const start=performance.now();for(const p of samples)fn({...p},.45,colliders,1.8);return performance.now()-start;}
const full=[],grid=[];for(let i=0;i<7;i++){if(i%2){grid.push(run(indexed));full.push(run(exhaustive));}else{full.push(run(exhaustive));grid.push(run(indexed));}}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const result={kind:'CPU-only static OSM collision-query microbenchmark',colliders:colliders.length,queriesPerBatch:samples.length,repetitions:7,initialIndexedQueryMs,exhaustiveBatchMs:full,indexedBatchMs:grid,medianExhaustiveMs:median(full),medianIndexedMs:median(grid),speedup:median(full)/median(grid),exactParity:true};
await mkdir('docs/performance',{recursive:true});await writeFile('docs/performance/collision-benchmark.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
