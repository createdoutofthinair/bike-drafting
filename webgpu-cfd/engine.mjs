export class FluidGPU {
 static async create({nx=32,ny=32,nz=32,nu=.1,mask,velocity=[0,0,0]}={}) {
  if(!globalThis.navigator?.gpu)throw Error('WebGPU unavailable; secure context and compatible adapter required');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No WebGPU adapter');
  const n=nx*ny*nz,bytes=n*19*4;if(![nx,ny,nz].every(v=>Number.isInteger(v)&&v>1)||!(nu>0))throw Error('Invalid grid or viscosity');
  if(bytes>adapter.limits.maxStorageBufferBindingSize)throw Error('Grid exceeds adapter storage binding limit');
  const device=await adapter.requestDevice();const code=await (await fetch(new URL('./solver.wgsl',import.meta.url))).text();const module=device.createShaderModule({code});const info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw Error(info.messages.map(m=>m.message).join('\n'));
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'step'}});
  const buffers=[0,1].map(()=>device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}));
  const f=new Float32Array(n*19);const c=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
  for(let i=0;i<n;i++)for(let q=0;q<19;q++){let cu=c[q].reduce((a,v,k)=>a+v*velocity[k],0),u2=velocity.reduce((a,v)=>a+v*v,0);f[i*19+q]=(q===0?1/3:q<7?1/18:1/36)*(1+3*cu+4.5*cu*cu-1.5*u2);}
  buffers.forEach(b=>device.queue.writeBuffer(b,0,f));const solid=device.createBuffer({size:n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(solid,0,mask||new Uint32Array(n));
  const params=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const data=new ArrayBuffer(32);new Uint32Array(data).set([nx,ny,nz,n]);new Float32Array(data)[4]=1/(.5+3*nu);device.queue.writeBuffer(params,0,data);
  const groups=buffers.map((_,i)=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[buffers[i],buffers[1-i],solid,params].map((buffer,binding)=>({binding,resource:{buffer}}))}));
  return Object.assign(new FluidGPU(),{device,pipeline,buffers,groups,solid,params,n,bytes,index:0,steps:0});
 }
 step(count=1){if(!Number.isInteger(count)||count<1)throw Error('Invalid step count');const e=this.device.createCommandEncoder();for(let k=0;k<count;k++){const p=e.beginComputePass();p.setPipeline(this.pipeline);p.setBindGroup(0,this.groups[this.index]);p.dispatchWorkgroups(Math.ceil(this.n/64));p.end();this.index=1-this.index;}this.device.queue.submit([e.finish()]);this.steps+=count;}
 async read(){const b=this.device.createBuffer({size:this.bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{const e=this.device.createCommandEncoder();e.copyBufferToBuffer(this.buffers[this.index],0,b,0,this.bytes);this.device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);return new Float32Array(b.getMappedRange().slice(0));}finally{b.unmap();b.destroy();}}
 destroy(){for(const b of [...this.buffers,this.solid,this.params])b.destroy();this.device.destroy();}
}
