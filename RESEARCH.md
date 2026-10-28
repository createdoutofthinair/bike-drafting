# Physics audit — 28 October 2026

## What this application can establish

This browser application solves a discretized, low-Mach, three-dimensional fluid model around simplified, stationary rider/bike proxies. It can reveal interactions in **that numerical model**. It cannot currently establish road-cycling drag percentages or realistic turbulent structures. No result is altered to enforce an expected rider ranking.

“Lower than riding alone” is a reference calculation, not a claim that the riders are outside their formation. The actual field always contains the chosen group. A separate simulation removes every rider except rider 1. Group-versus-reference force then includes the influence of following riders on the leader. Alternatively, comparing each force against rider 1 describes relative loads within the group. The UI defaults to this second, more directly interpretable comparison.

## Research findings relevant to the screenshot

- Blocken et al. (2018), *Aerodynamic drag in cycling team time trials*, DOI [10.1016/j.jweia.2018.09.015](https://doi.org/10.1016/j.jweia.2018.09.015): their CFD/wind-tunnel study examined 2–9 riders and gaps from 0.05 to 5 m. The last rider had the lowest drag for the tested groups of up to five riders with gaps up to 1 m; longer groups did not always follow that ordering. The leader also benefited slightly from following riders. Their detailed methods used turbulence modeling, mesh sensitivity analysis, and a low-blockage domain. These findings are conditional benchmarks, not coefficients to hard-code into this application.
- van Druenen and Blocken (2024), *CFD simulations of cyclist aerodynamics: Impact of computational parameters*, DOI [10.1016/j.jweia.2024.105714](https://doi.org/10.1016/j.jweia.2024.105714): predictions were sensitive to surface resolution, near-wall mesh and turbulence treatment. Matching one expected trend is insufficient validation. [University record](https://research.tue.nl/en/publications/cfd-simulations-of-cyclist-aerodynamics-impact-of-computational-p/).
- Guo, Zheng and Shi (2002), DOI [10.1088/1009-1963/11/4/310](https://doi.org/10.1088/1009-1963/11/4/310): reconstruct boundary distributions from equilibrium plus extrapolated interior non-equilibrium. This is the basis of the new approximate velocity/pressure boundaries. Published accuracy claims for the method do **not** validate this implementation.
- Ginzburg, Verhaeghe and d'Humieres (2008), [TRT parametrization and boundaries](https://www.global-sci.com/cicp/article/view/5523): even and odd population components can be relaxed separately. This implementation uses TRT with `(tau_even - 0.5)(tau_odd - 0.5) = 3/16`. It remains a low-resolution solver, not a substitute for RANS/LES validation.

The available abstracts and indexed method excerpts were reviewed. Some publisher/full-PDF retrievals were blocked; this audit does not claim to have reproduced all methods or experimental data from those publications.

## Verified problems in the previous code

| Problem | Consequence | Correction |
|---|---|---|
| Arbitrary velocity scaling and viscosity 0.1 | Body-length Reynolds number around 5, not cycling flow | Explicit SI/lattice scales; display actual and target Re; reduce numerical viscosity with TRT, without concealing the remaining large mismatch |
| Fixed no-slip ground in stationary-rider coordinates | Road boundary layer changed forces artificially | Moving-ground bounce-back at riding speed, independent of ambient wind |
| Uniform equilibrium imposed at every outlet | Wakes were forced back to free stream at nearby boundaries | Non-equilibrium extrapolated velocity inlets and density outlets; zero-gradient treatment for tangential/top boundary |
| Only 300 steps before publishing percentages | Less than one advective traversal; startup values looked final | Two domain traversals plus four 128-step blocks and <3% inter-block force change; reset statistics, not fluid, after wind changes |
| Opaque global-variable swapping for solo case | State coupling hard to audit | Independent `Solver` instances; identical time-dependent conditions |
| Three ellipsoids with no physical dimensions | Could not interpret spacing or geometry | Shared, SI-sized rider/bike proxy mask; wheel gap in metres; all geometry used by both renderer and solver |
| Central derivatives through solid cells | Artificially bright vorticity at solid interfaces | Fluid-only one-sided derivatives where a neighbour is solid |
| Rotation was called turbulence | Misleading physical interpretation | Explicit distinction between vorticity and turbulence; no invented noise or turbulence gain in the solver |
| Solver/render loops on the main thread | UI could appear to freeze | Dedicated CPU worker; cached geometry and field layers; rendering independent of solver updates |

## Equations and conventions

D3Q19 equilibrium:

`f_eq = w rho [1 + 3(c·u) + 4.5(c·u)^2 - 1.5(u·u)]`.

TRT collision independently damps the even and odd parts of `f - f_eq`. `nu_lattice = (tau_even - 0.5)/3`. Streamed populations hitting a stationary rider bounce back; force is the exchanged momentum summed over fluid/solid links. Uniform reference pressure is subtracted from the reported force, so rider/road contact does not introduce a spurious ambient-pressure support force. Labels use only the X component, opposing the riding direction, not the total force magnitude. They describe aerodynamic model force, not rolling resistance, drivetrain losses, metabolic effort or side load.

Moving-road reflection: `f_opp = f_post - 6 w rho c·u_road`. The road moves along +X in the rider frame. Ambient air may have a Y component but the road does not.

Default domain: 112 × 64 × 32 at dx = 0.125 m (14 × 8 × 4 m). This is still too coarse for cyclist boundary layers and small bicycle parts. The nominal wheel radius is 0.34 m and bicycle length about 1.75 m. Wheels are solid thin disks, not rotating/spoked wheels; limb pose is fixed; torso/head are smooth proxies. No 3D scan is implied.

Time step is fixed: dt = 0.003 dx = 0.000375 s. Therefore `u_lattice = u_SI dt/dx`; controls do not arbitrarily rescale the state. Physical air viscosity is 1.5e-5 m²/s. The default lattice viscosity 0.006 corresponds to **0.25 m²/s**, over 16,000 times air viscosity. At 35 km/h in still air, the target Re based on 1.75 m is about **1.13 million**, while the model Re is about **68**. These are not dynamically similar flows. TRT alone does not fix that mismatch.

A matching real-air viscosity on this grid would require tau extremely close to 0.5, but setting that value without resolving boundary layers and turbulent scales would not make a valid cycling simulation. No turbulence closure, resolved LES, adaptive mesh, rotating wheel model or transition model is implemented.

The new boundary is still an approximation, including face intersections and zero-gradient top treatment. Domain-size and grid-convergence studies remain required. The isolated reference stays at rider 1's location; ratios for other positions can retain boundary-location bias.

## Numerical settling versus physical validity

Provisional force comparisons appear after eight steps and are explicitly marked ≈ and provisional. The settled designation is reserved until the required cases meet the settling criteria. This is only a heuristic for slowly changing mean model loads, not proof of physical convergence or a statistical uncertainty estimate. Time-averaged turbulent forces would require longer, independent sampling. The final rider is not guaranteed to have the least model force at this low Re.

Changing wind or viscosity invalidates the force history and smoothly changes boundary targets; it does not restart the distributions or step count. Changing geometry requires reinitialization. Any numerical failure pauses with an error and retains the last committed state rather than looping/resetting automatically.

## Verification

Run `node tests.mjs`. Tests cover lattice moments, vector/unit conversion, a uniform moving flow over a matching moving road, zero aerodynamic force at rest, identical group/reference cases, uninterrupted condition changes, and the distinction between road velocity and ambient wind. These are numerical regression tests, not wind-tunnel validation.

`validation.json` records the actual verification results for this revision. The deployment workflow runs the regression suite before publication. Full-scale geometry, mesh/domain independence, turbulence modeling and measured drag comparisons remain open acceptance criteria before the UI can claim realistic cycling predictions.

## Smooth display and route to realism

The renderer targets 60 display frames/s, caching the static scene and blending between actual field snapshots. The worker sends every computed group/reference step. Render FPS is measured independently from solver steps/s. This is interpolation of known numerical results, not a 60 Hz physics solver. Physical time advances only by the fixed solver dt, never by the render clock. Background tabs and slow devices may render less often.

At the present dt, one physical second requires about 2,667 time steps; 60 display frames cannot replace those steps. A steady flow can look steady even with a continuously advancing solver. No decorative turbulence is added to hide that.

The practical route to trustworthy cycling results is: (1) representative geometry and surface/wake/boundary-layer meshing; (2) air properties and Reynolds matching with validated turbulence/transition and near-wall treatment; (3) grid, domain, time-step and force-statistics sensitivity studies; (4) isolated and drafting wind-tunnel validation. More detailed unsteady displays require appropriate scale-resolving methods and sufficient spatial/temporal resolution.

A browser GPU backend or WASM kernel could reduce numerical cost, but accelerating this low-Re model does not establish accuracy. A realistic product can render precomputed validated CFD fields smoothly, or use a separately validated surrogate for instant control changes while an expensive solver handles new cases. No such high-Re backend or validated surrogate is implemented here.
