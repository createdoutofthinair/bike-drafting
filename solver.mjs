/* D3Q19 TRT, SI-to-lattice conversion and momentum-exchange forces.
 * A numerical flow demonstrator; unresolved near-wall flow is NOT cycling CFD.
 * See RESEARCH.md for method references, assumptions and validation gaps. */
export const C = [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0],[1,0,1],[-1,0,-1],[1,0,-1],[-1,0,1],[0,1,1],[0,-1,-1],[0,1,-1],[0,-1,1]];
export const O = [0,2,1,4,3,6,5,8,7,10,9,12,11,14,13,16,15,18,17];
export const W = [1/3,...Array(6).fill(1/18),...Array(12).fill(1/36)];
export const AIR_NU = 1.5e-5;
export function equilibrium(q,r,x,y,z) { const c=C[q],v=c[0]*x+c[1]*y+c[2]*z;return W[q]*r*(1+3*v+4.5*v*v-1.5*(x*x+y*y+z*z)); }
// X increases along oncoming apparent flow. Riders travel toward -X.
// Ambient angle is explicitly a blowing-TOWARD direction; 0=headwind.
export function windVector(rideKmh,windKmh,angleDeg) {const a=angleDeg*Math.PI/180;return [(rideKmh+windKmh*Math.cos(a))/3.6,windKmh*Math.sin(a)/3.6,0];}
export function scales({dx=.125,ride=35,wind=0,angle=0,latticeNu=.006}={}) {
  const velocity=windVector(ride,wind,angle),speed=Math.hypot(...velocity);
  // Fixed time scale independent of settings: max 90 km/h => lattice u=.075.
  const dt=.003*dx, physicalNu= AIR_NU*dt/(dx*dx);
  return {dx,dt,velocity:velocity.map(v=>v*dt/dx),groundSpeed:ride/3.6*dt/dx,speed,
    physicalNu,latticeNu,effectiveNu:latticeNu*dx*dx/dt,
    targetRe:speed*1.75/AIR_NU,modelRe:speed*dt/dx*(1.75/dx)/latticeNu};
}
function capsule(x,y,z,a,b,r) {const ab=b.map((n,j)=>n-a[j]),p=[x-a[0],y-a[1],z-a[2]],t=Math.max(0,Math.min(1,p.reduce((v,n,j)=>v+n*ab[j],0)/ab.reduce((v,n)=>v+n*n,0)));return Math.hypot(...p.map((n,j)=>n-ab[j]*t))<=r;}
export function layout(kind='line',gap=.5,dx=.125,nx=112,ny=64) {
  const stride=(1.75+gap)/dx,first=nx*.29,cy=ny/2;
  if(kind==='single')return [[first,cy]];
  if(kind==='double')return [[first,cy-.6/dx],[first,cy+.6/dx],[first+stride,cy-.6/dx],[first+stride,cy+.6/dx]];
  if(kind==='stagger')return [[first,cy-.75/dx],[first+stride*.55,cy],[first+stride*1.1,cy+.75/dx]];
  return [[first,cy],[first+stride,cy],[first+2*stride,cy]];
}
export class Solver {
  constructor({nx=112,ny=64,nz=32,dx=.125,kind='line',gap=.5,reference=false,empty=false,latticeNu=.006}={}) {
    Object.assign(this,{nx,ny,nz,dx,latticeNu});this.n=nx*ny*nz;
    this.f=new Float32Array(this.n*19);this.g=new Float32Array(this.n*19);
    this.owner=new Uint8Array(this.n);this.positions=empty?[]:layout(kind,gap,dx,nx,ny);if(reference)this.positions=this.positions.slice(0,1);
    this.steps=0;this.target=[0,0,0];this.u=[0,0,0];this.road=0;this.targetRoad=0;this.age=0;this.travel=0;this.blocks=[];this.block=[];
    this.force=new Float64Array(this.positions.length*3);this.previewForce=new Float64Array(this.positions.length*3);this.buildGeometry();this.setConditions({ride:35,wind:0,angle:0,latticeNu},true);
  }
  id(x,y,z){return (z*this.ny+y)*this.nx+x;}
  buildGeometry(){const {nx,ny,nz,dx}=this;
    // Physical proxies: 1.75 m bicycle, 0.34 m wheel radius, dropped rider.
    // Both render and solver consume this exact voxel mask; no visual-only bike.
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const i=this.id(x,y,z);if(z===0){this.owner[i]=255;continue;}
      for(let k=0;k<this.positions.length;k++){const [cx,cy]=this.positions[k],px=(x-cx)*dx,py=(y-cy)*dx,pz=(z-.5)*dx;
        const wheel=[-.52,.52].some(wx=>Math.hypot(px-wx,pz-.34)<=.34 && Math.abs(py)<.055);
        const body=((px+.03)/.40)**2+(py/.23)**2+((pz-1.04)/.21)**2<1;
        const head=((px+.43)/.14)**2+(py/.13)**2+((pz-1.24)/.16)**2<1;
        const leg=[-.12,.12].some(s=>capsule(px,py,pz,[.25,s,.88],[.05,s,.40],.09));
        const arm=[-.20,.20].some(s=>capsule(px,py,pz,[-.25,s,1.05],[-.57,s,.72],.065));
        const frame=capsule(px,py,pz,[-.52,0,.34],[.12,0,.68],.055)||capsule(px,py,pz,[.12,0,.68],[.52,0,.34],.055);
        if(wheel||body||head||leg||arm||frame){if(this.owner[i])throw Error('Overlapping rider geometry');this.owner[i]=k+1;}
      }
    }
  }
  setConditions({ride=35,wind=0,angle=0,latticeNu=this.latticeNu},initial=false){
    this.config={ride,wind,angle,latticeNu};this.units=scales({...this.config,dx:this.dx});this.target=this.units.velocity;this.targetRoad=this.units.groundSpeed;this.latticeNu=latticeNu;
    this.age=0;this.travel=0;this.blocks=[];this.block=[];this.previewForce.fill(0);
    if(initial){this.u=[...this.target];this.road=this.targetRoad;for(let i=0;i<this.n;i++)for(let q=0;q<19;q++)this.f[i*19+q]=equilibrium(q,1,...this.u);}
  }
  macroAt(i,buffer=this.f){let r=0,x=0,y=0,z=0,b=i*19;for(let q=0;q<19;q++){let v=buffer[b+q];r+=v;x+=v*C[q][0];y+=v*C[q][1];z+=v*C[q][2];}return [r,x/r,y/r,z/r];}
  step(){
    const {nx,ny,nz,f,g,owner}=this;
    for(let k=0;k<3;k++)this.u[k]+=(this.target[k]-this.u[k])*.005;
    this.road+=(this.targetRoad-this.road)*.005;
    const tau=.5+3*this.latticeNu,wp=1/tau,wm=1/(.5+(3/16)/(tau-.5));
    const force=new Float64Array(this.force.length),eq=new Float64Array(19);g.fill(0);
    let mass=0,fluid=0,maxSpeed=0,minR=Infinity,maxR=0;
    for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
      const i=this.id(x,y,z);if(owner[i])continue;
      const b=i*19;let r=0,ux=0,uy=0,uz=0;
      for(let q=0;q<19;q++){let v=f[b+q];r+=v;ux+=v*C[q][0];uy+=v*C[q][1];uz+=v*C[q][2];}
      ux/=r;uy/=r;uz/=r;const speed=Math.hypot(ux,uy,uz);
      if(!Number.isFinite(r+speed)||r<.7||r>1.3||speed>.25)throw Error(`Numerical limit exceeded at step ${this.steps}; state preserved, no reset.`);
      mass+=r;fluid++;minR=Math.min(minR,r);maxR=Math.max(maxR,r);maxSpeed=Math.max(maxSpeed,speed);
      for(let q=0;q<19;q++)eq[q]=equilibrium(q,r,ux,uy,uz);
      for(let q=0;q<19;q++){
        const o=O[q],c=C[q],even=.5*(f[b+q]+f[b+o]-eq[q]-eq[o]),odd=.5*(f[b+q]-f[b+o]-eq[q]+eq[o]);
        const post=f[b+q]-wp*even-wm*odd,j=this.id(x+c[0],y+c[1],z+c[2]),body=owner[j];
        if(body){const reflected=post-(body===255?6*W[q]*r*c[0]*this.road:0);g[b+o]=reflected;
          if(body!==255)for(let k=0;k<3;k++)force[(body-1)*3+k]+=(post+reflected-2*W[q])*c[k];
        }else g[j*19+q]=post;
      }
    }
    // Guo et al. 2002 non-equilibrium extrapolation. Reconstruct complete
    // distributions from a fully streamed INTERIOR neighbour, including edges.
    // Inflow: prescribed velocity with neighbour density. Outflow: rho=1,
    // neighbour velocity. Top / tangential far-field: zero-gradient macro data.
    for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
      if(!(x===1||x===nx-2||y===1||y===ny-2||z===nz-2))continue;
      if(owner[this.id(x,y,z)])continue;
      const j=this.id(Math.max(2,Math.min(nx-3,x)),Math.max(2,Math.min(ny-3,y)),Math.min(nz-3,z)),m=this.macroAt(j,g);
      let dot=(x===1?-this.u[0]:x===nx-2?this.u[0]:0)+(y===1?-this.u[1]:y===ny-2?this.u[1]:0);
      let r=dot>1e-8?1:m[0],ux=dot< -1e-8?this.u[0]:m[1],uy=dot< -1e-8?this.u[1]:m[2],uz=dot< -1e-8?0:m[3];
      const b=this.id(x,y,z)*19;
      for(let q=0;q<19;q++)g[b+q]=equilibrium(q,r,ux,uy,uz)+g[j*19+q]-equilibrium(q,...m);
    }
    this.f=g;this.g=f;this.steps++;this.age++;this.travel+=Math.hypot(...this.u)/Math.max(nx,ny);
    this.force=force;for(let k=0;k<force.length;k++)this.previewForce[k]=this.age===1?force[k]:this.previewForce[k]*.9+force[k]*.1;this.diagnostics={meanDensity:mass/fluid,minDensity:minR,maxDensity:maxR,maxMach:maxSpeed*Math.sqrt(3)};
    this.block.push([...force]);
    if(this.block.length===128){let mean=Array(force.length).fill(0);for(const a of this.block)for(let k=0;k<a.length;k++)mean[k]+=a[k]/128;this.blocks.push(mean);if(this.blocks.length>4)this.blocks.shift();this.block=[];}
  }
  statistics(){
    const n=this.blocks.length,mean=Array(this.force.length).fill(0);for(const b of this.blocks)for(let k=0;k<mean.length;k++)mean[k]+=b[k]/n;
    let drift=Infinity;if(n===4){drift=0;for(let k=0;k<mean.length;k+=3)drift=Math.max(drift,Math.abs(this.blocks[3][k]-this.blocks[2][k])/Math.max(Math.abs(mean[k]),1e-5));}
    return {mean,provisionalMean:[...this.previewForce],previewAvailable:this.age>=8,drift,ready:this.travel>=2&&n===4&&drift<.03,flowThroughs:this.travel,blocks:n};
  }
  snapshot(){const velocity=new Float32Array(this.n*3);for(let i=0;i<this.n;i++){if(this.owner[i])continue;const m=this.macroAt(i);for(let k=0;k<3;k++)velocity[i*3+k]=Number.isFinite(m[k+1])?m[k+1]:0;}return velocity;}
}
