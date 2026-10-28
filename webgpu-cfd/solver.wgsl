// D3Q19 BGK collision + pull streaming with stationary halfway bounce-back.
struct Params { nx:u32, ny:u32, nz:u32, count:u32, omega:f32, pad0:f32, pad1:f32, pad2:f32 }
@group(0) @binding(0) var<storage,read> src:array<f32>;
@group(0) @binding(1) var<storage,read_write> dst:array<f32>;
@group(0) @binding(2) var<storage,read> solid:array<u32>;
@group(0) @binding(3) var<uniform> p:Params;
const c=array<vec3<i32>,19>(vec3(0,0,0),vec3(1,0,0),vec3(-1,0,0),vec3(0,1,0),vec3(0,-1,0),vec3(0,0,1),vec3(0,0,-1),vec3(1,1,0),vec3(-1,-1,0),vec3(1,-1,0),vec3(-1,1,0),vec3(1,0,1),vec3(-1,0,-1),vec3(1,0,-1),vec3(-1,0,1),vec3(0,1,1),vec3(0,-1,-1),vec3(0,1,-1),vec3(0,-1,1));
const opp=array<u32,19>(0,2,1,4,3,6,5,8,7,10,9,12,11,14,13,16,15,18,17);
fn weight(q:u32)->f32 {if(q==0){return 1.0/3.0;}if(q<7){return 1.0/18.0;}return 1.0/36.0;}
fn post(i:u32,q:u32)->f32 {var rho=0.0;var mom=vec3<f32>(0.0);for(var k=0u;k<19u;k++){let f=src[i*19u+k];rho+=f;mom+=f*vec3<f32>(c[k]);}let u=mom/max(rho,1e-12);let cu=dot(vec3<f32>(c[q]),u);let eq=weight(q)*rho*(1.0+3.0*cu+4.5*cu*cu-1.5*dot(u,u));return src[i*19u+q]+p.omega*(eq-src[i*19u+q]);}
@compute @workgroup_size(64) fn step(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;if(i>=p.count){return;}if(solid[i]!=0u){return;}let x=i%p.nx;let y=(i/p.nx)%p.ny;let z=i/(p.nx*p.ny);for(var q=0u;q<19u;q++){let a=vec3<i32>(i32(x),i32(y),i32(z))-c[q];if(any(a<vec3<i32>(0))||any(a>=vec3<i32>(i32(p.nx),i32(p.ny),i32(p.nz)))){dst[i*19u+q]=post(i,opp[q]);continue;}let j=u32(a.x)+(u32(a.y)+u32(a.z)*p.ny)*p.nx;if(solid[j]!=0u){dst[i*19u+q]=post(i,opp[q]);}else{dst[i*19u+q]=post(j,q);}}}
