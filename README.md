# Peloton Flow Lab

A native OpenCL GPU backend is now available under [native/](native/README.md), using a pinned FluidX3D engine with D3Q27, subgrid modelling, moving ground, per-rider force reduction and native Q-criterion rendering. The public browser page remains a JavaScript preview; it does not run the native GPU backend. See the native verification workflow for actual build/run status.

An experimental 3D fluid-flow explorer for cycling formations. The CPU worker solves D3Q19 TRT lattice Boltzmann around SI-sized rider/bike proxies and reports numerical health and provisional load comparisons. It is **not validated cycling CFD**. In particular, its simulated Reynolds number is far below real cycling conditions.

Open [the app](https://createdoutofthinair.github.io/bike-drafting/). Run locally with `python -m http.server 8000`, then visit `http://localhost:8000`. ES modules and workers require HTTP (not `file://`). Run numerical checks with `node tests.mjs`. The optional `node long-test.mjs` repeats the full-resolution 1,000-step group/reference stability run (it can take several minutes).

Read [the physics audit](RESEARCH.md) for equations, research, corrected bugs and remaining limitations. See [validation.json](validation.json) for recorded tests.

- `solver.mjs`: independent solver state, geometry, boundaries, forces and settling diagnostics.
- `worker.mjs`: continuous group and reference computations outside the main thread.
- `app.mjs`: cached scene, 60 FPS display target, interpolation between actual solver snapshots, live controls and comparisons.
- `display.mjs`: display-only interpolation and provisional/settled comparison logic. Render FPS and physics steps/s are separate measurements. Provisional percentages appear after 8 steps; they are not validated road-cycling predictions.

There are no empirical drafting percentages or rules that force a particular rider ranking. The current visualisation is a set of translucent sampled flow layers, not a volumetric renderer or evidence of resolved turbulence.
