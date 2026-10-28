// Display interpolation never advances or modifies the solver state.
export function blendFraction(now,start,duration,paused=false){return paused?1:Math.max(0,Math.min(1,(now-start)/Math.max(1,duration)));}
export function loadComparison(frame,alone=false){
  if(!frame)return {ready:false,available:false,values:[]};
  const gs=frame.statistics,rs=frame.reference,ready=gs.ready&&(!alone||rs.ready);
  const available=ready||(gs.previewAvailable&&(!alone||rs.previewAvailable));
  const g=ready?gs.mean:gs.provisionalMean,r=ready?rs.mean:rs.provisionalMean;
  const ref=alone?r?.[0]:g?.[0];
  return {ready,available,ref,values:frame.positions.map((_,i)=>available&&ref>1e-6?100*(1-g[i*3]/ref):null),basis:alone?'riding alone':'R1'};
}
