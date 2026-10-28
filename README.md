# Peloton Flow Lab

An experimental 3D fluid-flow explorer for cycling formations. The CPU worker solves D3Q19 TRT lattice Boltzmann around SI-sized rider/bike proxies and reports numerical health and provisional load comparisons. It is **not validated cycling CFD**. In particular, its simulated Reynolds number is far below real cycling conditions.

Open [the app](https://createdoutofthinair.github.io/bike-drafting/). Run locally with `python -m http.server 8000`, then visit `http://localhost:8000`. ES modules and workers require HTTP (not `file://`). Run numerical checks with `node tests.mjs`.

Read [the physics audit](RESEARCH.md) for equations, research, corrected bugs and remaining limitations. See [validation.json](validation.json) for recorded tests.

- `solver.mjs`: independent solver state, geometry, boundaries, forces and settling diagnostics.
- `worker.mjs`: continuous group and reference computations outside the main thread.
- `app.mjs`: visualisation, live controls and clearly defined comparisons.

There are no empirical drafting percentages or rules that force a particular rider ranking. The current visualisation is a set of translucent sampled flow layers, not a volumetric renderer or evidence of resolved turbulence.
