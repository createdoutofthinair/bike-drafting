// Optional full-resolution integration run. This is a stability/regression check,
// not proof of convergence or physical accuracy. May take several minutes.
import assert from 'node:assert/strict';
import {Solver} from './solver.mjs';
const group=new Solver(),reference=new Solver({reference:true});
for(let t=0;t<1000;t++){
  group.step();reference.step();
  if(t===499){const change={ride:35,wind:20,angle:90};group.setConditions(change);reference.setConditions(change);}
}
assert.equal(group.steps,1000);assert.equal(reference.steps,1000);
assert.ok(group.diagnostics.maxMach<.2);assert.ok(reference.diagnostics.maxMach<.2);
assert.equal(group.statistics().ready,false,'Do not claim converged percentages after this short run');
console.log(JSON.stringify({steps:group.steps,referenceSteps:reference.steps,group:group.diagnostics,reference:reference.diagnostics,statistics:group.statistics(),units:group.units},null,2));
