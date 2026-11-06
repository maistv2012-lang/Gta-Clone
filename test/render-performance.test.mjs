import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RenderBatches } from '../js/render-batches.js';
import { AdaptiveResolution } from '../js/adaptive-resolution.js';
import { nearbyColliders } from '../js/collider-query.js';

test('adaptive resolution is bounded, gradual, and opt-out',()=>{
 const a=new AdaptiveResolution();a.reset(1,true,30);let changes=0;
 for(let i=1;i<=200;i++)if(a.sample(80,i*200))changes++;
 assert.ok(changes>=3);assert.ok(a.ratio>=.65&&a.ratio<1);
 for(let i=201;i<=800;i++)a.sample(10,i*200);
 assert.ok(a.ratio<=1&&a.ratio>.9);a.reset(.8,false,30);
 for(let i=0;i<100;i++)assert.equal(a.sample(500,i*200),false);
 assert.equal(a.ratio,.8);assert.equal(a.sample(NaN,99999),false);
});
test('collision grid retains live moving bounds and original ordering',()=>{
 const distant={x0:500,x1:510,z0:500,z1:510,spatialStatic:true};
 const live={x0:1000,x1:1001,z0:1000,z1:1001};
 const near={x0:-2,x1:2,z0:-2,z1:2,spatialStatic:true};
 const list=[distant,live,near],p={x:0,z:0};
 assert.deepEqual([...nearbyColliders(list,p,1)],[live,near]);
 live.x0=-1;assert.deepEqual([...nearbyColliders(list,p,1)],[live,near]);
 list.push({...near});assert.equal([...nearbyColliders(list,p,1)].length,3);
});
test('collision grid re-queries after pushes without revisiting earlier bounds',()=>{
 const list=[{x0:0,x1:1,z0:0,z1:1,spatialStatic:true},{x0:200,x1:201,z0:0,z1:1,spatialStatic:true}];
 const p={x:0,z:0},seen=[];for(const c of nearbyColliders(list,p,1)){seen.push(c);p.x=200;}
 assert.deepEqual(seen,list);
});
test('render proxies preserve source transforms, colours, visibility, and live changes',()=>{
 const s=new THREE.Scene(),c=new THREE.PerspectiveCamera(),parent=new THREE.Group();s.add(parent);
 const m=new THREE.MeshStandardMaterial({color:0xff0000}),g=new THREE.BoxGeometry(2,3,4);
 const a=new THREE.Mesh(g,m);a.position.set(3,4,5);a.rotation.y=.6;parent.add(a);
 const batches=new RenderBatches(s,{minInstances:1});batches.update(c,0);assert.equal(batches.stats.instances,1);
 assert.equal(a.parent,parent);assert.equal(a.material,m);assert.equal(a.visible,true);
 let proxy=[...batches.groups.values()][0].mesh,actual=new THREE.Matrix4();proxy.getMatrixAt(0,actual);
 const expected=a.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(2,3,4));
 actual.elements.forEach((v,i)=>assert.ok(Math.abs(v-expected.elements[i])<1e-5));
 const color=new THREE.Color();m.color.set(0x00ff00);a.position.x=8;batches.update(c,100);proxy.getColorAt(0,color);assert.equal(color.getHex(),0x00ff00);
 parent.visible=false;batches.update(c,200);assert.equal(batches.stats.instances,0);
 parent.visible=true;batches.update(c,300);assert.equal(batches.stats.instances,1);
 m.transparent=true;batches.update(c,400);assert.equal(a.layers.mask,1);assert.equal(batches.stats.instances,0);
});
test('sloped cabin geometry and custom materials retain their original draw path',()=>{
 const s=new THREE.Scene(),c=new THREE.PerspectiveCamera(),g=new THREE.BoxGeometry();g.attributes.position.setX(0,.3);
 const a=new THREE.Mesh(g,new THREE.MeshStandardMaterial());s.add(a);
 const b=new RenderBatches(s,{minInstances:1});b.update(c,0);assert.equal(b.stats.instances,0);assert.equal(a.layers.mask,1);
});
test('instancing grows without losing sources and retires unused cells',()=>{
 const s=new THREE.Scene(),c=new THREE.PerspectiveCamera(),g=new THREE.BoxGeometry(),m=new THREE.MeshLambertMaterial();
 const sources=Array.from({length:35},()=>{const mesh=new THREE.Mesh(g,m);s.add(mesh);return mesh;});
 const b=new RenderBatches(s,{minInstances:1});b.update(c,0);assert.equal(b.stats.instances,35);assert.equal(b.stats.batches,1);
 for(const o of sources)s.remove(o);b.update(c,100);b.update(c,11000);assert.equal(b.groups.size,0);
});

test('facades vary deterministically while honouring source glass and brick',async()=>{
 const {facadeStyle}=await import('../js/facade-style.js');
 assert.deepEqual(facadeStyle({id:17}),facadeStyle({id:17}));
 assert.equal(facadeStyle({id:5,tags:{'building:material':'glass'}}).modern,true);
 assert.equal(facadeStyle({id:5,tags:{'building:material':'brick'}}).finish,'brick');
 const variants=new Set(Array.from({length:20},(_,id)=>JSON.stringify(facadeStyle({id}))));assert.ok(variants.size>4);
});

test('indexed collision resolution exactly matches exhaustive narrow phase',async()=>{
 const {readFile}=await import('node:fs/promises');const {polygonContact}=await import('../js/road-network.js');
 const source=await readFile(new URL('../js/city.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('export function resolveCircle'),source.indexOf('// Highest walkable surface')).replace('export ','');
 const compile=query=>new Function('nearbyColliders','polygonContact',body+';return resolveCircle;')(query,polygonContact);
 const indexed=compile(nearbyColliders),exhaustive=compile(c=>c);
 let seed=17;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const colliders=Array.from({length:500},(_,i)=>{const x=rand()*1000-500,z=rand()*1000-500,w=rand()*30+1;return{x0:x,x1:x+w,z0:z,z1:z+w,h:rand()*40,spatialStatic:i%5!==0,...(i%3===0?{polygon:[[x,z],[x+w,z],[x+w,z+w],[x,z+w],[x,z]]}:{})};});
 for(let i=0;i<2000;i++){const a={x:rand()*1000-500,z:rand()*1000-500,y:0},b={...a},r=rand()*4+.1,h=rand()*20;const hitA=indexed(a,r,colliders,h),hitB=exhaustive(b,r,colliders,h);assert.deepEqual(a,b);assert.deepEqual(hitA,hitB);}
});

test('detached vehicle groups leave no proxy ghosts and can be reattached',()=>{
 const s=new THREE.Scene(),car=new THREE.Group(),c=new THREE.PerspectiveCamera(),o=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());car.add(o);s.add(car);
 const b=new RenderBatches(s,{minInstances:1});b.update(c,0);assert.equal(b.stats.instances,1);
 s.remove(car);b.update(c,100);assert.equal(b.stats.instances,0);b.update(c,600);assert.equal(b.records.length,0);assert.equal(o.layers.mask,1);
 s.add(car);b.update(c,1200);assert.equal(b.stats.instances,1);
});

test('custom UVs and mirrored meshes stay on the source rendering path',()=>{
 const s=new THREE.Scene(),c=new THREE.PerspectiveCamera(),g=new THREE.BoxGeometry();g.attributes.uv.setX(0,7);
 const a=new THREE.Mesh(g,new THREE.MeshStandardMaterial()),b=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());b.scale.x=-1;s.add(a,b);
 const batches=new RenderBatches(s,{minInstances:1});batches.update(c,0);assert.equal(batches.stats.instances,0);assert.equal(a.layers.mask,1);assert.equal(b.layers.mask,1);
});

test('sparse cells use original meshes instead of allocating proxy resources',()=>{
 const s=new THREE.Scene(),c=new THREE.PerspectiveCamera();for(let i=0;i<2;i++)s.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
 const b=new RenderBatches(s);b.update(c,0);assert.equal(b.groups.size,0);assert.equal(b.stats.instances,0);assert.ok(s.children.every(o=>o.layers.mask===1));
});

test('custom shader and deformed-normal boxes are not normalised into proxies',()=>{
 const s=new THREE.Scene(),c=new THREE.PerspectiveCamera();
 const a=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());a.material.onBeforeCompile=()=>{};
 const g=new THREE.BoxGeometry();g.computeVertexNormals();const b=new THREE.Mesh(g,new THREE.MeshStandardMaterial());s.add(a,b);
 const batches=new RenderBatches(s,{minInstances:1});batches.update(c,0);assert.equal(batches.stats.instances,0);assert.equal(a.layers.mask,1);assert.equal(b.layers.mask,1);
});

test('stable frames reuse material signatures and live material edits invalidate them',()=>{
 const s=new THREE.Scene(),c=new THREE.PerspectiveCamera(),m=new THREE.MeshStandardMaterial({color:0xff0000}),o=new THREE.Mesh(new THREE.BoxGeometry(),m);s.add(o);
 const b=new RenderBatches(s,{minInstances:1});b.update(c,0);const cache=b.materialKeys.get(m),recordKey=b.records[0].key;
 for(let i=1;i<40;i++)b.update(c,i*20);
 assert.equal(b.materialKeys.get(m),cache);assert.equal(b.records[0].key,recordKey);
 m.color.set(0x00ff00);b.update(c,900);assert.equal(b.materialKeys.get(m),cache);
 m.roughness=.2;b.update(c,1000);assert.notEqual(b.materialKeys.get(m),cache);
 let active=[...b.groups.values()].find(g=>g.used);assert.equal(active.mesh.material.roughness,.2);
 const changed=b.materialKeys.get(m);m.normalScale.x=.25;b.update(c,1100);assert.notEqual(b.materialKeys.get(m),changed);
 o.castShadow=true;b.update(c,1200);active=[...b.groups.values()].find(g=>g.used);assert.equal(active.mesh.castShadow,true);
});
