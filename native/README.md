# Native GPU CFD backend

This integration uses [FluidX3D](https://github.com/ProjectPhysX/FluidX3D), by Dr. Moritz Lehmann, as an established OpenCL fluid solver. The upstream core is not copied into this repository. `configure.py` requires one reviewed source commit and replaces only its case setup and compile-time configuration in a dedicated checkout.

The OpenCL collision/streaming, subgrid closure, moving boundaries, force reduction, and Q-criterion rendering run on the selected OpenCL device. With a suitable GPU driver this is GPU physics, not merely GPU drawing. On a CPU OpenCL runtime the same kernels execute on the CPU. The engine reports the device actually selected; do not infer GPU execution from a passing CI run.

## Configuration

- Pinned upstream: `dbf0bb5b19233668672f73a0865a41424651a09c`.
- D3Q27, FP32 distributions/arithmetic, Smagorinsky-Lilly subgrid extension.
- Molecular air viscosity 1.5e-5 m²/s and density 1.225 kg/m³; explicit SI mapping. No artificial viscosity floor to lower the nominal Reynolds number. The subgrid model adds local eddy viscosity as part of its modelling.
- Nominal 32 × 16 × 8 m domain, resolution selected from a user-specified memory budget. This is still subject to domain and grid sensitivity studies.
- Stationary SI-sized body/bicycle proxies, moving road at riding speed, wind from any horizontal direction. Wheels and pedalling remain fixed in this first case; the geometry is not a rider scan.
- Native GPU-rendered velocity-coloured Q-criterion surfaces, rather than prescribed streamlines, particle smoke or free-surface water effects. Q is a vortex indicator, not an accuracy certificate.
- GPU force summation for each rider, written in newtons. Ratios are not hard-coded and a particular rider ranking is not imposed.
- Every output is marked `validated:false`. Matching the molecular Reynolds number is necessary, but not sufficient for correct cycling drag. Near-wall treatment, geometry, grid resolution, turbulence closure and experimental validation remain material limitations.

## Run on Linux with a supported OpenCL device

Install a C++17 compiler, make, git, Python 3, OpenCL development loader and the GPU vendor's OpenCL driver. Follow upstream hardware/driver guidance rather than installing an arbitrary driver package. Then, from this repository:

```bash
VRAM_MB=2048 RIDERS=3 MAX_STEPS=10000 bash native/run.sh
```

`VRAM_MB` is an explicit allocation budget, not auto-detected free VRAM. Leave headroom for graphics, other applications, and host memory. The engine checks device compatibility and reports its actual memory requirements.

For desktop native graphics (requires Linux X11 development libraries and display):

```bash
VRAM_MB=2048 RIDERS=3 MAX_STEPS=0 bash native/run.sh --interactive
```

`MAX_STEPS=0` continues until the application is closed. P starts/pauses the upstream native simulation; mouse/keyboard control its camera. No timestep limit automatically restarts it. Finite runs export VTK velocity, density and solid flags, a force CSV, run metadata, status and periodic rendered images under `bin/peloton-output/`, or `OUTPUT_DIR` if set.

Example conditions:

```bash
VRAM_MB=4096 RIDE_KMH=40 WIND_KMH=15 WIND_DEG=90 GAP_M=0.5 \
RIDERS=3 MAX_STEPS=20000 SAMPLE_STEPS=100 IMAGE_STEPS=1000 bash native/run.sh
```

Angles describe where ambient wind blows toward: 0 adds headwind, ±90 is crosswind, 180 is tailwind. The rider frame also includes riding speed. Road velocity excludes ambient wind. The first case supports 1–3 riders in a straight line. Use the same conditions with `RIDERS=1` for an isolated reference. Results require startup removal, time averaging and convergence assessment before comparing loads; the provided CSV is raw force history.

Windows users can configure the separate checkout with Python, then follow the upstream native Windows compiler and GPU-driver instructions. The Linux launcher is not a Windows GPU-driver installer. WSL/OpenCL support depends on the actual device/runtime; it is not guaranteed by this integration.

## Verification and limitations

The `Native OpenCL CFD verification` workflow compiles this exact integration and executes a small finite case on a CPU OpenCL runtime. It checks execution and finite output, and preserves force/field/render artifacts. This tests portable OpenCL kernel execution; it does not test a GPU, performance, realistic resolution or measured drafting drag.

Native GPU computation needs hardware beyond GitHub Pages. The public page is still the explicitly labelled JavaScript preview until native results are supplied through a separate result pipeline. It does not secretly run this native executable in the browser, and this change does not claim 60 real-time physical solves per second.

For quantitative cycling accuracy, retain an independently validated reference workflow (e.g. OpenFOAM SST/transition-sensitive CFD with suitable meshing) and compare both isolated and group drag. There is no universal best solver that replaces those checks. This backend is selected for GPU throughput and native fluid-field visualization; it is not declared best in aerodynamic accuracy.

## Upstream license and attribution

FluidX3D has a restrictive upstream license allowing public research, education and personal use, with restrictions including commercial and military use. Review the [exact upstream license](https://github.com/ProjectPhysX/FluidX3D/blob/dbf0bb5b19233668672f73a0865a41424651a09c/LICENSE.md) for your intended use. The integration does not relicense the engine or remove its notices. Generated/modified setup and configuration sources accompany CI results, with the pinned upstream source remaining publicly reconstructable. Cite the upstream scientific references when publishing research results.
