# Independent WebGPU CFD framework — first kernel

Original WGSL/JavaScript implementation; independent of FluidX3D and the existing browser demo. Serve the repository over HTTPS or localhost and import `FluidGPU` from `engine.mjs`.

Implemented: GPU D3Q19 BGK collision/streaming, stationary solid halfway bounce-back, closed-box boundaries, equilibrium initialization, explicit compute-pass ordering, ping-pong buffers, adapter checks, asynchronous readback and resource cleanup.

This is a foundation, **not a complete or validated CFD framework**. The current kernel recomputes neighbour moments repeatedly and needs a separate collision pass for performance. A closed box cannot represent an outdoor peloton.

Required before cycling use:

1. GPU regression tests: uniform equilibrium, mass/momentum conservation, shear-wave viscosity, Couette/Poiseuille flow, obstacle-force benchmarks and grid convergence.
2. Open inlet/outlet conditions, moving road and wheels, interpolated curved boundaries and force integration.
3. Higher-stability collision, validated turbulence/transition/near-wall models and physical Reynolds matching.
4. Adaptive/refined meshes or a documented wall-model strategy; domain and time-step studies.
5. GPU scalar/vector diagnostics, convergence and failure detection; stable field export and checkpoint/resume.
6. Volume rendering and vortex indicators consuming the actual velocity/pressure field, decoupled from simulation time.

No GPU runtime test has yet been performed. Syntax checks of JavaScript do not validate WGSL, stability or aerodynamics. Do not use this module for drafting percentages. No 60 FPS or real-time CFD performance claim is made.
