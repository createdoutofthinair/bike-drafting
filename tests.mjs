import assert from 'node:assert/strict';
import {Solver,C,O,W,equilibrium,windVector,scales} from './solver.mjs';
const results=[];function test(name,fn){let start=performance.now();fn();results.push({name,status:'pass',ms:Math.round(performance.now()-start)});}
function small(options={}){return new Solver({nx:40,ny:24,nz:20,dx:.25,kind:'single',...options});}
test('D3Q19 isotropy, opposite links and equilibrium moments',()=>{
  assert.ok(Math.abs(W.reduce((a,b)=>a+b)-1)<1e-14);
  C.forEach((c,q)=>c.forEach((v,k)=>assert.equal(v,-C[O[q]][k]||0)));
  const u=[.03,-.01,.005],f=C.map((_,q)=>equilibrium(q,1.02,...u));
  assert.ok(Math.abs(f.reduce((a,b)=>a+b)-1.02)<1e-14);
  for(let k=0;k<3;k++)assert.ok(Math.abs(f.reduce((a,b,q)=>a+b*C[q][k],0)/1.02-u[k])<1e-14);
});
test('Headwind, crosswind, following wind and SI scaling',()=>{
  assert.deepEqual(windVector(36,0,0),[10,0,0]);assert.ok(Math.abs(windVector(36,36,180)[0])<1e-12);
  assert.ok(Math.abs(windVector(36,18,90)[1]-5)<1e-12);
  let p=scales({ride:36});assert.ok(p.targetRe/p.modelRe>1000,'Must expose huge Reynolds mismatch');
  assert.ok(Math.abs(p.physicalNu*p.dx*p.dx/p.dt-1.5e-5)<1e-15);
});
test('Uniform moving flow + matching moving road remains uniform',()=>{
  const s=small({empty:true});s.setConditions({ride:36,wind:0,angle:0},true);
  for(let t=0;t<120;t++)s.step();
  let m=s.macroAt(s.id(20,12,2));assert.ok(Math.abs(m[0]-1)<1e-5);assert.ok(Math.abs(m[1]-.03)<1e-6);
  assert.ok(Math.abs(s.diagnostics.meanDensity-1)<1e-5);
});
test('Symmetric stationary rider in still air has zero net force',()=>{
  const s=small();s.setConditions({ride:0,wind:0,angle:0},true);
  for(let t=0;t<20;t++)s.step();assert.ok(Math.max(...s.force.map(Math.abs))<1e-5);
});
test('Independent identical group/reference states give equal forces',()=>{
  const a=small(),b=small({reference:true});
  for(let t=0;t<80;t++){a.step();b.step();}
  assert.deepEqual([...a.force],[...b.force]);assert.equal(a.steps,b.steps);
});
test('Condition changes preserve time and fluid state; convergence is invalidated',()=>{
  const s=small();for(let t=0;t<40;t++)s.step();let before=s.f.slice(),steps=s.steps;
  s.setConditions({ride:35,wind:20,angle:90});assert.equal(s.steps,steps);assert.deepEqual(s.f,before);
  assert.equal(s.statistics().ready,false);for(let t=0;t<80;t++)s.step();assert.equal(s.steps,steps+80);
});
test('Ground speed does not wrongly include ambient wind',()=>{
  const a=scales({ride:36,wind:0}),b=scales({ride:36,wind:20,angle:90});assert.equal(a.groundSpeed,b.groundSpeed);
});
test('Stable force history alone cannot pass the flow-through requirement',()=>{
  const s=small();s.blocks=[[1,0,0],[1,0,0],[1,0,0],[1,0,0]];s.travel=.3;
  assert.equal(s.statistics().ready,false);s.travel=2.1;assert.equal(s.statistics().ready,true);
});
test('Numerical failure preserves the committed field and step count',()=>{
  const s=small();let i=s.id(20,12,10);s.owner[i]=0;s.f[i*19]=NaN;
  const count=s.steps,field=s.f;assert.throws(()=>s.step(),/Numerical limit exceeded/);
  assert.equal(s.steps,count);assert.equal(s.f,field);
});
console.log(JSON.stringify({tests:results},null,2));
