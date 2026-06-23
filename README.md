# Color Infection

Color Infection is a web-based 2D territorial puzzle prototype built with Next.js App Router, TypeScript, React, PixiJS, and Tailwind CSS.

## Version 1.05

Version 1.05 is the PixiJS Phase 2 pulse and spike optimization pass. It preserves V1.04 gameplay, levels, enemies, HUD, controls, pause/reset, and diagnostics while making shockwaves, enemy pulses, node pulses, and collision rings cheaper and smoother.

This version also fixes the node capture arc bug where a capture ring could draw a long diagonal line across the arena.

The architecture is intentionally split:

- `Game.ts` owns simulation state, level generation, dots, cores, infection, cleansing, enemy AI, collisions, nodes, modifiers, pulses, win/loss rules, pause/reset, and debug stats.
- Pixi rendering owns the animated scene: application lifecycle, layers, textures, sprites, pooled visual effects, haze, resize handling, and cleanup.
- React owns layout, HUD, pause/reset/shockwave buttons, level controls, mobile controls, keyboard shortcuts, and the diagnostics overlay.

### Current Gameplay

- The player controls a blue/cyan healing core with click/tap-to-move movement.
- Desktop:
  - move the mouse to preview a destination,
  - click to set the destination,
  - click again to redirect.
- Mobile:
  - tap to move the player core.
- A cyan destination ring and faint path line stay visible until the core arrives.
- The player cleanses infected dots, spreads blue territory, captures objectives, and uses shockwave at high-risk moments.
- Player and enemy cores collide elastically, push apart, slow briefly, and create contested gray shock zones.
- Pause stops timer, movement, infection, cleansing, nodes, pulses, particles, and dot animation.
- Reset restarts the current level.

### Level Structure

The prototype introduces mechanics gradually:

- Level 1, First Cleanse: no enemy core, only seeded infected dots.
- Level 2, Pinned Core: a static enemy core infects nearby territory.
- Level 3, Slow Spreader: a slow enemy core moves outward and expands.
- Level 4, Border Contest: the enemy begins contesting red/blue frontlines.
- Level 5, Pulse Pressure: enemy pulses and a light hunter escort enter play.
- Level 6, Open War: nodes, walls, gates, energy wells, viscosity zones, and enemy variants combine.

Use the level control to step through levels.

### Enemy Variants

- Spreader: slow, broad infection field, high spread pressure.
- Hunter: faster, occasionally attacks the player, but spreads weakly.
- Tank: large, slow, high mass, hard to push.
- Splitter: breaks into smaller hunter-style infection cores when damaged.
- Root: stationary; in advanced levels it creates branching infection pressure.

Enemy AI still uses four readable modes:

- `expand`: grows into neutral territory.
- `contest`: pressures red/blue frontlines and weak blue frontier dots.
- `defend`: retreats toward its infected home when invaded.
- `attack`: briefly pressures the player core, mostly from hunter-type enemies.

### Arena Modifiers

- Walls block core movement and force cores to slide around them.
- Gates begin closed and open when nearby dots become cleansed.
- Energy wells recharge player shockwave faster when the player core is nearby.
- Viscosity zones slow both cores but increase local infection/cleansing spread.

### Active Ability

- Press `Space` or use the shockwave UI button to fire the player shockwave.
- Shockwave emits a large, expanding cleansing pulse from the player core.
- Using it drains 10% of current player territory and turns those dots neutral.
- Standing in blue territory, owning nodes, and using energy wells improves recharge.

### Strategic Nodes

- Advanced levels spawn larger stationary node dots.
- Hover a core over a node for 3 seconds to capture it.
- Captured nodes pulse every 5 seconds.
- Player nodes emit cleansing pulses.
- Enemy nodes emit infection pulses.

### Win, Loss, And Stars

- Win when the player controls 70% of active dots.
- Lose when infection controls 75% of active dots.
- The timer does not cause instant loss.
- Star scoring is based on win time:
  - under 2:00 = 3 stars,
  - under 3:30 = 2 stars,
  - under 5:00 = 1 star.
- After 5:00, infection gradually becomes stronger, but the player can still win.

### PixiJS Renderer

- `src/components/PixiGameCanvas.tsx` creates and destroys the Pixi app on the client.
- Pixi's ticker is the single active game loop: it calls `game.update(dt)` and then `pixiRenderer.sync(game.getRenderState())`.
- React receives throttled HUD/debug updates instead of updating state every frame.
- Pointer behavior is preserved:
  - pointer move previews destination on desktop,
  - pointer down commits movement destination,
  - touch/tap commits movement on mobile.
- The old public Canvas 2D draw path is disabled for active gameplay; rendering is driven by Pixi snapshots from `Game.ts`.

### Pixi Layers

Pixi containers are kept simple and ordered for future upgrades:

- `backgroundLayer`
- `hazeLayer`
- `territoryLayer`
- `dotLayer`
- `modifierLayer`
- `nodeLayer`
- `coreLayer`
- `effectLayer`
- `debugLayer`

### Rendering And Performance

- `pixi.js` is the active scene dependency.
- Canvas resolution is capped at `Math.min(devicePixelRatio || 1, 1.5)`.
- Pixi uses responsive CSS sizing with capped internal renderer resolution.
- Dots use reusable Pixi sprites and small shared textures for neutral, infected, player, and contested states.
- Dot sprites are created once per level/revision, then updated with position, scale, alpha, tint, texture, and visibility.
- Cores render through Pixi sprites and lightweight graphics for aura, destination, and collision feedback.
- Ripples, pulses, shockwaves, particles, and collision bursts are rendered with pooled Pixi display objects.
- Pulse and ripple rings use a reusable pre-rendered Pixi ring texture instead of redrawing ring graphics every frame.
- Shockwave, enemy pulse, and node pulse gameplay now runs as active pulse objects that expand over time.
- Active pulses query dots through a spatial grid and process only newly reached ring-band dots.
- Pulse processing is frame-budgeted:
  - `MAX_PULSE_DOT_HITS_PER_FRAME = 80`
  - `MAX_PULSE_PARTICLES_PER_FRAME = 40`
- Shockwave particle bursts use sampling instead of spawning one particle per affected dot.
- Effect caps are:
  - `MAX_RIPPLES = 30`
  - `MAX_PARTICLES = 300`
  - `MAX_PULSES = 10`
- Territory haze is rendered to a low-resolution canvas texture at 33% scale.
- Haze normally refreshes every 4th frame, and temporarily refreshes every 2nd frame while pulses are active.
- Heavy full-screen blur filters and per-dot gradient creation are avoided in the main render loop.

### Debug Diagnostics

Press `D` to toggle the diagnostics overlay.

The overlay shows:

- FPS,
- frame time,
- max frame time over the last 5 seconds,
- update time,
- draw/render sync time,
- Pixi sync time,
- pulse processing time,
- last shockwave frame cost,
- dots affected by the last shockwave,
- particles spawned by the last shockwave,
- active pulse queue length,
- dot count,
- ripple count,
- particle count,
- pulse count,
- active effect count,
- capped DPR,
- haze scale and update cadence,
- haze rebuild cost,
- Pixi renderer type,
- stage child count,
- dot sprite count,
- active Pixi effect object count.

### Visual Direction

- The game keeps the clean light portfolio-canvas look.
- Blue/cyan and red/orange haze makes territory ownership readable.
- Gray/purple frontline flicker highlights contested zones.
- Larger nodes, darker viscosity zones, walls, gates, and energy wells add tactical landmarks.
- Mobile keeps a compact timer/ability/pause cluster and bottom circular stat indicators.

### Main Files

- `src/app/page.tsx` mounts the game.
- `src/components/GameCanvas.tsx` owns the React shell, HUD, level controls, debug overlay, pause/reset/shockwave controls, and keyboard shortcuts.
- `src/components/PixiGameCanvas.tsx` mounts Pixi, forwards pointer/touch input, runs the Pixi ticker, and throttles React stats updates.
- `src/lib/game/Game.ts` owns game state, simulation, level generation, AI, arena modifiers, collisions, effects state, pause, win/loss, debug stats, and render snapshots.
- `src/lib/game/Dot.ts` owns per-dot state and visual motion data.
- `src/lib/game/colors.ts` and `src/lib/game/math.ts` provide color and numeric helpers.
- `src/lib/rendering/PixiRenderer.ts` syncs Pixi visuals from `GameRenderState`.
- `src/lib/rendering/pixiTextures.ts` creates reusable Pixi textures.
- `src/lib/rendering/pixiLayers.ts` creates the Pixi layer stack.
- `src/lib/rendering/pixiEffects.ts` provides display-object pools for effects.

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

Run checks:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Deployment

The project is deployable on Vercel with the default Next.js settings.
