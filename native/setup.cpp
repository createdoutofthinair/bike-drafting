// Peloton setup for FluidX3D. This file is an original integration, not upstream
// FluidX3D. Upstream: Dr. Moritz Lehmann / ProjectPhysX; see native/README.md.
#include "setup.hpp"
#include <cstdlib>
#include <fstream>
#include <filesystem>
#include <iomanip>
#include <cmath>
#include <stdexcept>

namespace {
double env_number(const char* name,double fallback){const char* s=std::getenv(name);if(!s)return fallback;char* e=nullptr;double v=std::strtod(s,&e);if(!e||*e||!std::isfinite(v))throw std::runtime_error(std::string("Invalid ")+name);return v;}
bool capsule_si(float x,float y,float z,const float3& a,const float3& b,float r){const float3 d=b-a,p=float3(x,y,z)-a;const float t=std::fmax(0.0f,std::fmin(1.0f,dot(p,d)/dot(d,d)));return length(p-t*d)<=r;}
bool rider_si(float x,float y,float z){
 const bool torso=sq((x+.03f)/.40f)+sq(y/.23f)+sq((z-1.04f)/.21f)<1.0f;
 const bool head=sq((x+.43f)/.14f)+sq(y/.13f)+sq((z-1.24f)/.16f)<1.0f;
 bool legs=false,arms=false;for(float side:{-1.0f,1.0f}){legs|=capsule_si(x,y,z,float3(.25f,side*.12f,.88f),float3(.05f,side*.12f,.40f),.09f);arms|=capsule_si(x,y,z,float3(-.25f,side*.20f,1.05f),float3(-.57f,side*.20f,.72f),.065f);}
 const bool wheels=(std::hypot(x+.52f,z-.34f)<=.34f||std::hypot(x-.52f,z-.34f)<=.34f)&&std::fabs(y)<.055f;
 const bool frame=capsule_si(x,y,z,float3(-.52f,0.0f,.34f),float3(.12f,0.0f,.68f),.055f)||capsule_si(x,y,z,float3(.12f,0.0f,.68f),float3(.52f,0.0f,.34f),.055f);
 return torso||head||legs||arms||wheels||frame;
}
}
void main_setup(){
 const uint budget=(uint)env_number("VRAM_MB",2048),riders=(uint)env_number("RIDERS",3);
 const float ride=(float)env_number("RIDE_KMH",35)/3.6f,wind=(float)env_number("WIND_KMH",0.0f)/3.6f,angle=(float)env_number("WIND_DEG",0.0f)*pif/180.0f;
 const float gap=(float)env_number("GAP_M",.5),rho=1.225f,nu_si=1.5E-5f;
 const float3 si_u=float3(ride+wind*std::cos(angle),wind*std::sin(angle),0.0f);
 const float speed=length(si_u),scale_speed=std::fmax(std::fmax(speed,ride),1.0f),lattice_speed=.06f;
 if(budget<32||budget>65536||riders<1||riders>3||gap<.1f||gap>2.0f||ride<0||wind<0||scale_speed>40)throw std::runtime_error("Invalid bounds: VRAM 32..65536 MB, riders 1..3, gap .1..2 m, nonnegative speeds <144 km/h.");
 const uint3 dims=resolution(float3(32.0f,16.0f,8.0f),budget);
 units.set_m_kg_s((float)dims.x,lattice_speed,1.0f,32.0f,scale_speed,rho);
 const float nu=units.nu(nu_si);LBM lbm(dims,nu);
 const uint Nx=lbm.get_Nx(),Ny=lbm.get_Ny(),Nz=lbm.get_Nz();
 const float3 u=float3(units.u(si_u.x),units.u(si_u.y),0.0f),road=float3(units.u(ride),0.0f,0.0f);
 const uchar markers[3]={uchar(TYPE_S|TYPE_X),uchar(TYPE_S|TYPE_Y),uchar(TYPE_S|TYPE_X|TYPE_Y)};
 std::vector<float3> centers;for(uint r=0;r<riders;r++)centers.push_back(float3(.25f*Nx+units.x((1.75f+gap)*r),.5f*Ny,0.0f));
 parallel_for(lbm.get_N(),[&](ulong n){uint x,y,z;lbm.coordinates(n,x,y,z);lbm.u.x[n]=u.x;lbm.u.y[n]=u.y;lbm.u.z[n]=0;
   if(z==0){lbm.flags[n]=TYPE_S;lbm.u.x[n]=road.x;lbm.u.y[n]=0;return;}
   if(x==0||x==Nx-1||y==0||y==Ny-1||z==Nz-1){lbm.flags[n]=TYPE_E;return;}
   for(uint r=0;r<riders;r++)if(rider_si(units.si_x((float)x-centers[r].x),units.si_x((float)y-centers[r].y),units.si_x((float)z-.5f))){lbm.flags[n]=markers[r];lbm.u.x[n]=lbm.u.y[n]=lbm.u.z[n]=0;break;}
 });
 const char* output_env=std::getenv("OUTPUT_DIR");const std::string out=output_env?output_env:get_exe_path()+"peloton-output/";std::filesystem::create_directories(out);
 std::ofstream metadata(out+"/run.json");metadata<<std::setprecision(9)<<"{\n\"engine\":\"FluidX3D\",\"backend\":\"OpenCL\",\"turbulence\":\"Smagorinsky-Lilly SUBGRID\",\"validated\":false,\"nx\":"<<Nx<<",\"ny\":"<<Ny<<",\"nz\":"<<Nz<<",\"dx_m\":"<<units.si_x(1.0f)<<",\"dt_s\":"<<units.si_t(1ull)<<",\"nu_m2_s\":"<<nu_si<<",\"lattice_nu\":"<<nu<<",\"nominal_Re_1_75m\":"<<speed*1.75f/nu_si<<",\"riders\":"<<riders<<",\"ride_kmh\":"<<ride*3.6f<<",\"wind_kmh\":"<<wind*3.6f<<",\"wind_degrees\":"<<angle*180/pif<<"}\n";metadata.close();
 std::ofstream forces(out+"/forces.csv");forces<<"step,time_s,rider,force_x_N,force_y_N,force_z_N\n";forces<<std::setprecision(9);
 const ulong max_steps=(ulong)env_number("MAX_STEPS",10000),sample=(ulong)env_number("SAMPLE_STEPS",100),image_interval=(ulong)env_number("IMAGE_STEPS",1000);
 if(!sample)throw std::runtime_error("SAMPLE_STEPS must be >0");
#ifdef GRAPHICS
 lbm.graphics.visualization_modes=VIS_FLAG_SURFACE|VIS_Q_CRITERION;
 lbm.graphics.set_camera_centered(-45.0f,25.0f,70.0f,1.0f);
#endif
 while(max_steps==0||lbm.get_t()<max_steps){const ulong count=max_steps?std::min(sample,max_steps-lbm.get_t()):sample;lbm.run(count,max_steps?max_steps:max_ulong);
   lbm.update_force_field();for(uint r=0;r<riders;r++){const float3 f=lbm.object_force(markers[r]);if(!std::isfinite(f.x+f.y+f.z))throw std::runtime_error("Nonfinite force; stopping without reset.");forces<<lbm.get_t()<<','<<units.si_t(lbm.get_t())<<','<<r+1<<','<<units.si_F(f.x)<<','<<units.si_F(f.y)<<','<<units.si_F(f.z)<<'\n';}forces.flush();
#ifdef GRAPHICS
   if(image_interval&&lbm.get_t()%image_interval==0)lbm.graphics.write_frame(out+"/", "vortices", ".png");
#endif
 }
 lbm.u.write_device_to_vtk(out+"/");lbm.rho.write_device_to_vtk(out+"/");lbm.flags.write_device_to_vtk(out+"/",false);
 lbm.u.read_from_device();lbm.rho.read_from_device();double rmin=2,rmax=0,umax=0;for(ulong n=0;n<lbm.get_N();n++){if(lbm.flags[n]&TYPE_S)continue;float r=lbm.rho[n];float v=std::sqrt(sq(lbm.u.x[n])+sq(lbm.u.y[n])+sq(lbm.u.z[n]));if(!std::isfinite(r+v)||r<=0)throw std::runtime_error("Nonfinite or nonpositive fluid field");rmin=std::fmin(rmin,r);rmax=std::fmax(rmax,r);umax=std::fmax(umax,v);}
 std::ofstream status(out+"/status.json");status<<"{\"completed_steps\":"<<lbm.get_t()<<",\"finite\":true,\"density_min\":"<<rmin<<",\"density_max\":"<<rmax<<",\"max_lattice_speed\":"<<umax<<",\"validated\":false}\n";
}
