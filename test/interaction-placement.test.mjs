import test from 'node:test';import assert from 'node:assert/strict';
import {clearInteractionPoint} from '../js/interaction-placement.js';
const preferred={x:-23,y:0,z:17},table={x:-16,z:12};
test('clear, sufficiently separated hatch keeps its original coordinates',()=>{
 const original={...preferred};assert.deepEqual(clearInteractionPoint(preferred,table,()=>false),preferred);assert.deepEqual(preferred,original);
});
test('obstructed hatch is reachable with a 1.4m approach margin, without changing colliders',()=>{
 const walls=[{x0:-40,x1:-10,z0:14,z1:40}],before=JSON.stringify(walls);
 const blocked=p=>walls.some(c=>p.x>c.x0-1.4&&p.x<c.x1+1.4&&p.z>c.z0-1.4&&p.z<c.z1+1.4);
 const placed=clearInteractionPoint(preferred,table,blocked);
 assert.equal(blocked(placed),false);assert.ok(Math.hypot(placed.x-table.x,placed.z-table.z)>=6.5);
 // The original test/player approach offset stays outside the real building
 // expanded by the existing 0.5m player radius, and inside drilling distance.
 const approach={x:placed.x+.5,z:placed.z+.5};
 assert.ok(Math.hypot(approach.x-placed.x,approach.z-placed.z)<2.6);
 assert.ok(walls.every(c=>approach.x<=c.x0-.5||approach.x>=c.x1+.5||approach.z<=c.z0-.5||approach.z>=c.z1+.5));
 assert.equal(JSON.stringify(walls),before);
 assert.deepEqual(placed,clearInteractionPoint(preferred,table,blocked));
});
test('hatch stays outside blackjack interaction range even if preferred point overlaps the table',()=>{
 const p=clearInteractionPoint({x:0,y:0,z:0},{x:0,z:0},()=>false);assert.ok(Math.hypot(p.x,p.z)>=6.5);
});
test('fully obstructed placement fails explicitly after a bounded search',()=>{
 let queries=0;assert.throws(()=>clearInteractionPoint(preferred,table,()=>{queries++;return true;}),/No accessible casino vault/);assert.ok(queries<=1025);
});
