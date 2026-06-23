# Color Infection

Color Infection is a web-based 2D canvas puzzle prototype built with Next.js App Router, TypeScript, React, HTML Canvas 2D, and Tailwind CSS.

## Version 1.03

This version adds staged level progression, enemy variants, arena modifiers, and a performance optimization pass focused on stable long-running canvas play.

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

The prototype now introduces mechanics gradually:

- Level 1, First Cleanse: no enemy core, only seeded infected dots.
- Level 2, Pinned Core: a static enemy core infects nearby territory.
- Level 3, Slow Spreader: a slow enemy core moves outward and expands.
- Level 4, Border Contest: the enemy begins contesting red/blue frontlines.
- Level 5, Pulse Pressure: enemy pulses and a light hunter escort enter play.
- Level 6, Open War: nodes, walls, gates, energy wells, viscosity zones, and enemy variants combine.

Use the bottom-left level control to step through levels.

### Enemy Variants

- Spreader: slow, broad infection field, high spread pressure.
- Hunter: faster, occasionally attacks the player, but spreads weakly.
- Tank: large, slow, high mass, hard to push.
- Splitter: breaks into smaller hunter-style infection cores when damaged.
- Root: stationary; in advanced levels it creates branching infection pressure.

Enemy AI still uses the four readable modes:

- `expand`: grows into neutral territory.
- `contest`: pressures red/blue frontlines and weak blue frontier dots.
- `defend`: retreats toward its own infected home when invaded.
- `attack`: briefly pressures the player core, mostly from hunter-type enemies.

### Arena Modifiers

- Walls block core movement and force cores to slide around them.
- Gates begin closed and open when nearby dots become cleansed.
- Energy wells recharge player shockwave faster when the player core is nearby.
- Viscosity zones slow both cores but increase local infection/cleansing spread.

### Active Ability

- Press `Space` or use the shockwave UI button to fire the player shockwave.
- Shockwave emits a large, fast cleansing pulse from the player core.
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

### Performance Pass

- Canvas internal resolution is capped at `Math.min(devicePixelRatio, 1.5)`.
- The canvas keeps responsive CSS sizing while using `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
- Red/blue territory haze now renders to a low-resolution offscreen canvas at 33% scale.
- Haze updates every 4th frame and scales back to the main canvas.
- Main dot rendering uses pre-rendered dot/core sprites instead of per-dot shadows and gradients.
- Frontline haze is folded into the low-resolution haze pass, with only lightweight main-canvas flicker.
- Effects are capped and cleaned in-place:
  - `MAX_RIPPLES = 60`
  - `MAX_PARTICLES = 300`
  - `MAX_PULSES = 20`
- Temporary arrays no longer grow indefinitely.

### Debug Diagnostics

Press `D` to toggle the debug overlay.

The overlay shows:

- FPS,
- frame time,
- update time,
- draw time,
- dot count,
- ripple count,
- particle count,
- pulse count,
- active effect count,
- capped DPR,
- haze scale and update cadence.

### Visual Direction

- The game keeps the clean light portfolio-canvas look.
- Blue/cyan and red/orange haze makes territory ownership readable.
- Gray/purple frontline flicker highlights contested zones.
- Larger nodes, darker viscosity zones, walls, gates, and energy wells add tactical landmarks.
- Mobile keeps a compact timer/ability/pause pill at the top and three circular stat indicators at the bottom.

### Main Files

- `src/app/page.tsx` mounts the game.
- `src/components/GameCanvas.tsx` owns the React canvas shell, HUD, level controls, debug overlay, pause/reset/shockwave controls, keyboard shortcuts, and pointer/touch input.
- `src/lib/game/Game.ts` owns game state, level generation, enemy variants, arena modifiers, performance caches, sprites, pulses, collisions, nodes, viscosity, AI, infection/cleansing, pause, win/loss, and drawing.
- `src/lib/game/Dot.ts` owns per-dot visual motion and influence response.
- `src/lib/game/colors.ts` and `src/lib/game/math.ts` provide rendering and numeric helpers.

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
