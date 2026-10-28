#!/usr/bin/env python3
"""Configure a separate, pinned FluidX3D checkout. Core source and license stay intact."""
import argparse, pathlib, re, shutil, subprocess
PIN='dbf0bb5b19233668672f73a0865a41424651a09c'
p=argparse.ArgumentParser();p.add_argument('checkout',type=pathlib.Path);p.add_argument('--interactive',action='store_true');args=p.parse_args()
root=args.checkout.resolve();head=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
if head!=PIN:raise SystemExit(f'Expected FluidX3D {PIN}, found {head}; refusing an unreviewed API version.')
defines=root/'src/defines.hpp';s=defines.read_text()
enable={'D3Q27','SRT','FORCE_FIELD','EQUILIBRIUM_BOUNDARIES','MOVING_BOUNDARIES','SUBGRID','GRAPHICS'}
if args.interactive:enable.add('INTERACTIVE_GRAPHICS')
disable={'BENCHMARK','D3Q19','D3Q15','D2Q9','TRT','FP16S','FP16C','SURFACE','PARTICLES','VOLUME_FORCE','TEMPERATURE','INTERACTIVE_GRAPHICS_ASCII'}
if not args.interactive:disable.add('INTERACTIVE_GRAPHICS')
for name in enable|disable:
 pattern=rf'^(?://)?#define {re.escape(name)}(?=\s|$)'
 if not re.search(pattern,s,flags=re.M):raise SystemExit(f'Missing upstream define {name}')
 s=re.sub(pattern,('#define ' if name in enable else '//#define ')+name,s,flags=re.M)
s='// ALTERED CONFIGURATION: bike-drafting GPU integration. Original engine by Dr. Moritz Lehmann.\n'+s
defines.write_text(s);shutil.copyfile(pathlib.Path(__file__).with_name('setup.cpp'),root/'src/setup.cpp')
print('Configured D3Q27 FP32 + Smagorinsky subgrid, moving boundaries, force reduction and native Q-criterion rendering.')
