const $=id=>document.getElementById(id),canvas=$('view'),ctx=canvas.getContext('2d');
const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
let frame=null,owner=null,faces=[],yaw=-.7,pitch=.58,zoom=1,drag=null,fields=[],pendingRender=false;
function conditions(){return {ride:+$('ride').value,wind:+$('wind').value,angle:+$('angle').value,latticeNu:+$('viscosity').value};}
function updateOutputs(){const c=conditions();$('rideVal').textContent=c.ride+' km/h';$('windVal').textContent=c.wind+' km/h';$('angleVal').textContent=c.angle+'°'+(c.angle===0?' · headwind':Math.abs(c.angle)===180?' · tailwind':'');$('gapVal').textContent=(+$('gap').value).toFixed(2)+' m';$('visVal').textContent=c.latticeNu.toFixed(3);$('densityVal').textContent=$('density').value+'%';$('contrastVal').textContent=(+$('contrast').value).toFixed(1)+'×';}
function initialise(){updateOutputs();owner=null;frame=null;$('runBadge').textContent='Building geometry…';worker.postMessage({type:'init',options:{kind:$('formation').value,gap:+$('gap').value},conditions:conditions()});}
function conditionChange(){updateOutputs();worker.postMessage({type:'conditions',conditions:conditions()});}
for(const id of ['ride','wind','angle','viscosity'])$(id).oninput=conditionChange;
for(const id of ['formation','gap'])$(id).onchange=initialise;
for(const id of ['density','contrast','field'])$(id).oninput=()=>{updateOutputs();buildFields();requestRender();};
$('basis').onchange=()=>{updateComparison();requestRender();};$('reset').onclick=initialise;$('toggle').onclick=()=>worker.postMessage({type:'pause'});
worker.onerror=e=>{$('state').textContent='Worker error: '+e.message;$('runBadge').textContent='Paused · error';};
worker.onmessage=({data})=>{frame=data;if(data.owner){owner=data.owner;buildFaces();}if(!owner)return;updateDiagnostics();buildFields();updateComparison();requestRender();};
function idx(x,y,z){return (z*frame.ny+y)*frame.nx+x;}
function velocity(i){return [frame.velocity[i*3],frame.velocity[i*3+1],frame.velocity[i*3+2]];}
function derivative(x,y,z,axis,component){let a=[x,y,z],b=[x,y,z];a[axis]--;b[axis]++;let ia=idx(...a),ib=idx(...b),i=idx(x,y,z),v=frame.velocity[i*3+component],oa=owner[ia],ob=owner[ib];
  // Never differentiate through a solid or an uncomputed ghost cell.
  if(oa&&ob)return 0;if(oa)return frame.velocity[ib*3+component]-v;if(ob)return v-frame.velocity[ia*3+component];return (frame.velocity[ib*3+component]-frame.velocity[ia*3+component])*.5;
}
function buildFields(){if(!frame||!owner)return;fields=[];const {nx,ny,nz}=frame,opacity=+$('density').value/100,gain=+$('contrast').value,mode=$('field').value;
  for(const z of [2,4,6,8,10,12]){if(z>=nz-2)continue;const c=document.createElement('canvas');c.width=nx;c.height=ny;const cctx=c.getContext('2d'),image=cctx.createImageData(nx,ny);
    for(let y=2;y<ny-2;y++)for(let x=2;x<nx-2;x++){let i=idx(x,y,z),b=(y*nx+x)*4;if(owner[i])continue;
      let value;if(mode==='speed')value=Math.hypot(...velocity(i))/.075;
      else value=Math.hypot(derivative(x,y,z,1,2)-derivative(x,y,z,2,1),derivative(x,y,z,2,0)-derivative(x,y,z,0,2),derivative(x,y,z,0,1)-derivative(x,y,z,1,0))/.03*gain;
      let t=Math.min(1,Math.max(0,value));image.data[b]=Math.round(24+205*t);image.data[b+1]=Math.round(57+162*t);image.data[b+2]=Math.round(116+70*Math.sin(t*Math.PI)-35*t);image.data[b+3]=Math.round(255*opacity*(mode==='speed'?.07+.16*t:.015+.36*t));
    }cctx.putImageData(image,0,0);fields.push({canvas:c,z});
  }
  $('legendLow').textContent=mode==='speed'?'0 m/s (rider frame)':'Low rotation';$('legendHigh').textContent=mode==='speed'?'25 m/s · fixed scale':'Higher rotation · display gain applied';
}
function buildFaces(){faces=[];const {nx,ny,nz}=frame;for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
  const body=owner[idx(x,y,z)];if(!body||body===255)continue;
  for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){if(owner[idx(x+dx,y+dy,z+dz)])continue;
    const vertices=dx?[[x+dx*.5,y-.5,z-.5],[x+dx*.5,y+.5,z-.5],[x+dx*.5,y+.5,z+.5],[x+dx*.5,y-.5,z+.5]]:dy?[[x-.5,y+dy*.5,z-.5],[x+.5,y+dy*.5,z-.5],[x+.5,y+dy*.5,z+.5],[x-.5,y+dy*.5,z+.5]]:[[x-.5,y-.5,z+dz*.5],[x+.5,y-.5,z+dz*.5],[x+.5,y+.5,z+dz*.5],[x-.5,y+.5,z+dz*.5]];
    faces.push({vertices,color:dz?'#b6c7b3':dy?'#668b7e':'#91aa98'});
  }
}}
function project(x,y,z){const {nx,ny,nz}=frame;x-=nx*.5;y-=ny*.5;z-=nz*.35;const a=Math.cos(yaw)*x-Math.sin(yaw)*y,b=Math.sin(yaw)*x+Math.cos(yaw)*y,scale=6.5*zoom;return [500+a*scale,300+(b*Math.sin(pitch)-z*Math.cos(pitch))*scale,b*Math.cos(pitch)+z*Math.sin(pitch)];}
function line(a,b,color){const p=project(...a),q=project(...b);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();}
function comparison(){if(!frame)return {ready:false};const gs=frame.statistics,rs=frame.reference,alone=$('basis').value==='alone',ready=gs.ready&&(!alone||rs.ready),ref=alone?rs.mean[0]:gs.mean[0];
  return {ready,ref,values:frame.positions.map((_,i)=>ref>1e-6?100*(1-gs.mean[i*3]/ref):null),basis:alone?'riding alone':'R1'};
}
function updateComparison(){if(!frame)return;const c=comparison();$('basisHelp').textContent=$('basis').value==='alone'?'Reference = an independent one-rider calculation at rider 1’s position, with identical wind and boundaries. The riders remain in their formation; only the reference case is isolated. This can reveal a change in rider 1’s load.':'Rider 1 is the group reference. This compares loads within this formation; rider 1 is 0% by definition and its own drafting benefit is not visible.';
  const header='<table><thead><tr><th>Rider</th><th>Experimental model load</th></tr></thead><tbody>';
  $('riderTable').innerHTML=header+frame.positions.map((_,i)=>{let v=c.values[i],text=!c.ready?'Developing flow…':v===null?'No positive reference force':i===0&&c.basis==='R1'?'Group reference':`${Math.abs(v).toFixed(1)}% ${v>=0?'lower':'higher'} than ${c.basis}`;return `<tr><td>R${i+1}</td><td class="${c.ready?'good':'pending'}">${text}</td></tr>`;}).join('')+'</tbody></table>';
  const drift=frame.statistics.drift;const d=Number.isFinite(drift)?(drift*100).toFixed(1)+'%':'not enough samples';$('convergence').textContent=c.ready?'Numerical settling criteria met (not physical validation). Values average four 128-step blocks.':'Percentages withheld: require two domain traversals and <3% change between recent force blocks. Current change: '+d+'.';
}
function updateDiagnostics(){const d=frame.diagnostics,u=frame.units;$('steps').textContent=frame.steps.toLocaleString();$('traversals').textContent=frame.statistics.flowThroughs.toFixed(2);$('targetRe').textContent=Math.round(u.targetRe).toLocaleString();$('modelRe').textContent=u.modelRe.toFixed(1);$('mach').textContent=d?d.maxMach.toFixed(3):'—';$('rho').textContent=d?d.minDensity.toFixed(4)+' – '+d.maxDensity.toFixed(4):'—';$('runBadge').textContent=frame.error?'Numerical limit · paused':frame.paused?'Paused':'Computing continuously';$('toggle').textContent=frame.error?'Restart required':frame.paused?'Resume':'Pause';$('toggle').disabled=Boolean(frame.error);$('state').textContent=frame.error||'Group and reference advancing in a CPU worker. No automatic reinitialisation.';}
function requestRender(){if(pendingRender)return;pendingRender=true;requestAnimationFrame(()=>{pendingRender=false;render();});}
function render(){if(!frame||!owner)return;ctx.fillStyle='#091519';ctx.fillRect(0,0,1000,560);const {nx,ny,nz}=frame;
  for(let x=4;x<nx-1;x+=8)line([x,1,.5],[x,ny-2,.5],'#17312a');for(let y=4;y<ny-1;y+=8)line([1,y,.5],[nx-2,y,.5],'#17312a');
  const corners=[[1,1,1],[nx-2,1,1],[nx-2,ny-2,1],[1,ny-2,1],[1,1,nz-2],[nx-2,1,nz-2],[nx-2,ny-2,nz-2],[1,ny-2,nz-2]];
  for(let [a,b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])line(corners[a],corners[b],'#294439');
  for(const field of fields){let a=project(0,0,field.z),b=project(nx,0,field.z),c=project(0,ny,field.z);ctx.save();ctx.transform((b[0]-a[0])/nx,(b[1]-a[1])/nx,(c[0]-a[0])/ny,(c[1]-a[1])/ny,a[0],a[1]);ctx.imageSmoothingEnabled=true;ctx.drawImage(field.canvas,0,0);ctx.restore();}
  const draw=faces.map(f=>({...f,p:f.vertices.map(v=>project(...v))})).sort((a,b)=>a.p[0][2]-b.p[0][2]);for(const f of draw){ctx.beginPath();f.p.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();}
  const c=comparison();ctx.textAlign='center';ctx.font='600 14px system-ui';frame.positions.forEach(([x,y],i)=>{const p=project(x,y,1.7/frame.dx);let detail=!c.ready?'developing flow':c.values[i]===null?'no reference':i===0&&c.basis==='R1'?'group reference':`${Math.abs(c.values[i]).toFixed(0)}% ${c.values[i]>=0?'lower':'higher'} · model`;let w=Math.max(62,ctx.measureText(detail).width+20);ctx.fillStyle='rgba(9,20,17,.93)';ctx.fillRect(p[0]-w/2,p[1]-19,w,41);ctx.fillStyle='#e7f3dc';ctx.fillText('R'+(i+1),p[0],p[1]-3);ctx.fillStyle='#b7d393';ctx.font='12px system-ui';ctx.fillText(detail,p[0],p[1]+14);ctx.font='600 14px system-ui';});
}
canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;yaw=drag.yaw+(e.clientX-drag.x)*.008;pitch=Math.max(.05,Math.min(1.5,drag.pitch+(e.clientY-drag.y)*.008));requestRender();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(2,zoom*Math.exp(-e.deltaY*.001)));requestRender();},{passive:false});
initialise();
