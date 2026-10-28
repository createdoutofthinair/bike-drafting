import {Solver} from './solver.mjs?v=20261028-live3';
let group,reference,paused=false,timer=null,error=null,epoch=0;
function emit(initial=false){if(!group)return;const velocity=group.snapshot(),gs=group.statistics(),rs=reference.statistics();
  const data={type:'frame',epoch,steps:group.steps,nx:group.nx,ny:group.ny,nz:group.nz,dx:group.dx,
    velocity,positions:group.positions,statistics:gs,reference:rs,units:group.units,diagnostics:group.diagnostics,
    error,paused,conditions:group.config,simulationTime:group.steps*group.units.dt};if(initial)data.owner=group.owner;
  postMessage(data,[velocity.buffer]);
}
function run(){timer=null;if(paused||!group)return;
  try{group.step();reference.step();emit();}
  catch(e){error=e.message;paused=true;emit();return;}
  timer=setTimeout(run,0);
}
onmessage=({data})=>{
  if(data.type==='init'){
    epoch++;if(timer!==null)clearTimeout(timer);error=null;paused=false;
    group=new Solver(data.options);reference=new Solver({...data.options,reference:true});
    if(data.conditions){group.setConditions(data.conditions,true);reference.setConditions(data.conditions,true);}
    emit(true);timer=setTimeout(run,0);
  }else if(data.type==='conditions'&&group){group.setConditions(data.conditions);reference.setConditions(data.conditions);emit();}
  else if(data.type==='pause'){paused=!paused;if(!paused&&!error&&timer===null)timer=setTimeout(run,0);emit();}
  else if(data.type==='snapshot')emit();
};
