**Source Visual Truth**
- Original visual path: `C:\Users\edmun\Downloads\ChatGPT Image Jun 22, 2026, 11_29_53 PM.png`
- Bug reference path: `C:\Users\edmun\AppData\Local\Temp\codex-clipboard-59f49213-0472-414c-a9a7-090adda350ba.png`
- V1.05 direction: preserve the V1.04 PixiJS game while optimizing pulse spikes and fixing the node capture arc line bug.

**Implementation Evidence**
- Local URL: `http://127.0.0.1:3000`
- Expected viewports: desktop `1440x900`, mobile `390x844`
- State: PixiJS renders the animated arena, dots, haze, cores, ring sprites, particles, nodes, and modifiers. React still renders HUD, controls, level picker, mobile stats, and diagnostics.

**Architecture Evidence**
- `src/lib/game/Game.ts` owns simulation, active pulse state, dot spatial grid, pulse budgets, level generation, AI, collisions, nodes, modifiers, pause/reset, win/loss, and debug stats.
- `src/lib/rendering/PixiRenderer.ts` syncs visual rings, particles, dots, cores, nodes, modifiers, and low-resolution haze from `GameRenderState`.
- `src/lib/rendering/pixiTextures.ts` creates the reusable ring texture used by pulse and ripple sprite pools.
- React state updates remain throttled; no per-frame React HUD updates were added.

**Full-View Comparison Evidence**
- V1.05 keeps the reference's clean light arena, dense dot field, blue/orange territory haze, glass HUD, reset button, and compact mobile controls.
- V1.05 keeps V1.04 gameplay: click/tap movement, staged levels, enemies, nodes, walls, gates, wells, viscosity zones, shockwave, pause, reset, and diagnostics.
- The node capture arc now starts at the arc origin, so it circles the node instead of drawing a diagonal line toward the screen edge.

**Focused Region Comparison Evidence**
- Pulse gameplay: shockwaves, node pulses, and enemy pulses are active objects with current radius, previous radius, max radius, speed, strength, owner, processed IDs, pending dot hits, and lifetime.
- Pulse performance: pulses query a spatial hash grid and process only newly reached ring-band dots.
- Frame budgets: pulse dot hits are capped at 80 per frame and pulse particles at 40 per frame.
- Particles: shockwave particles are sampled rather than spawned one-per-dot; `MAX_PARTICLES = 300` is preserved.
- Visual rings: pulse and ripple rings use pooled sprites with a pre-rendered soft ring texture.
- Haze: still low-resolution at 33% scale; refreshes every 4th frame normally and every 2nd frame during active pulse pressure.
- Diagnostics: pressing `D` now shows shockwave cost, shockwave dot/particle totals, pulse queue, max frame over 5 seconds, haze rebuild cost, Pixi sync cost, and pulse processing time.

**Findings**
- No actionable P0/P1/P2 issues are known after V1.05 implementation.
- [P3] Full five-minute repeated-shockwave soak was not run.
  Location: long-run performance validation.
  Evidence: lint, build, audit, and browser pulse smoke passed; a 4.2 second rAF sample around Space had no frames over 34 ms in headless Chrome.
  Impact: acceptable for this optimization pass, but a longer human-play soak is still useful.
  Fix: run Level 6 for 5+ minutes with diagnostics visible and repeatedly use shockwave as it recharges.

**Required Fidelity Surfaces**
- Fonts and typography: Geist remains consistent; diagnostics panel widened only enough for the new pulse rows.
- Spacing and layout rhythm: desktop HUD, mobile controls, stat circles, reset, level controls, and arena bounds remain aligned in the tested viewports.
- Colors and visual tokens: player, enemy, neutral, contested, node, viscosity, wall, gate, well, shockwave, and pulse states remain visually distinct.
- Image quality and asset fidelity: UI icons use `lucide-react`; game rings use reusable Pixi textures rather than per-frame generated graphics.
- Copy and content: README now documents V1.05 pulse optimization and diagnostics.

**Patches Made Since V1.04**
- Added pulse-specific diagnostics:
  - last shockwave frame cost,
  - dots affected by last shockwave,
  - particles spawned by last shockwave,
  - active pulse queue length,
  - max frame time over the last 5 seconds,
  - haze rebuild cost,
  - Pixi sync cost,
  - pulse processing cost.
- Added active pulse objects with radius, speed, strength, processed dot/enemy sets, pending hit queues, and lifetime.
- Added a spatial hash grid for pulse dot queries.
- Added frame budgets: `MAX_PULSE_DOT_HITS_PER_FRAME = 80` and `MAX_PULSE_PARTICLES_PER_FRAME = 40`.
- Converted pulse/ripple visuals to pooled Pixi ring sprites.
- Added a reusable soft ring texture.
- Adjusted haze cadence during active pulses without allowing full-frame haze rebuilds.
- Fixed the Pixi node capture arc by moving to the arc start before drawing.
- Updated README to Version 1.05.

**Verification**
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd audit --omit=dev`: passed with 0 vulnerabilities.
- Browser smoke test with system Chrome: passed.
  - One Pixi canvas rendered at desktop and mobile sizes.
  - No Next.js redbox overlay.
  - No console errors.
  - No page errors.
  - Level 6/6 Open War loaded.
  - `D` toggled diagnostics with Pixi renderer, timing, pulse, haze, sprite, and effect stats.
  - Pressing `Space` produced shockwave dot/particle diagnostics.
  - rAF sample around shockwave: max frame `33.3ms`, p95 `16.8ms`, frames over `34ms`: `0`.
  - Node capture screenshot showed no long diagonal capture line.
  - Mobile controls and stat indicators remained in viewport.
- Screenshots:
  - `C:\Users\edmun\OneDrive\Dokumenti\Color Infection\artifacts\color-infection-v105-level6-before-space.png`
  - `C:\Users\edmun\OneDrive\Dokumenti\Color Infection\artifacts\color-infection-v105-after-space-debug.png`
  - `C:\Users\edmun\OneDrive\Dokumenti\Color Infection\artifacts\color-infection-v105-node-capture.png`
  - `C:\Users\edmun\OneDrive\Dokumenti\Color Infection\artifacts\color-infection-v105-mobile.png`

final result: passed
