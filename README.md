# Color Infection

Color Infection is a web-based 2D territorial puzzle prototype built with Next.js App Router, TypeScript, React, PixiJS, and Tailwind CSS.

## Version 1.15

Version 1.15 is the Fog Removal pass. It preserves the V1.13 simplified base-capture arena, core movement/combat, recovery feedback, PixiJS renderer, dark glass HUD, controls, pause/reset, and diagnostics while removing fog-of-war and haze as active rendering systems.

The main V1.15 diagnosis: the temporary Fog FX toggle confirmed that full-screen fog/haze visuals were the FPS culprit. With the map fully uncovered, turning fog back on immediately reintroduced frame drops. Fog and haze are now removed from the active frame path.

V1.13 base capture, V1.12 recovery feedback, V1.10 recovery, V1.09 radius readability, V1.08 dark glass UI, V1.07 hold-and-drag movement, V1.06 core combat, and V1.05 pulse/spike optimizations remain in place.

The architecture is intentionally split:

- `Game.ts` owns simulation state, level generation, dots, cores, infection, cleansing, enemy AI, collisions, nodes, modifiers, pulses, win/loss rules, pause/reset, and debug stats.
- Pixi rendering owns the animated scene: application lifecycle, layers, textures, sprites, pooled visual effects, haze, resize handling, and cleanup.
- React owns layout, HUD, pause/reset/shockwave buttons, level controls, mobile controls, keyboard shortcuts, and the diagnostics overlay.

### Current Gameplay

- The player controls a blue/cyan healing core with hold-and-drag movement.
- Desktop:
  - move the mouse to preview a destination,
  - hold mouse down to steer the core,
  - drag while held to continuously redirect,
  - release to keep traveling to the last held point.
- Mobile:
  - hold/drag with a finger to steer,
  - lift to keep traveling to the last touch point.
- A cyan destination ring and faint path line stay visible until the core arrives.
- The player now focuses on capturing the enemy main base, controlling mini-bases, healing, and using shockwave at high-risk moments.
- Core movement speed is reduced by 50%, making positioning heavier and more intentional.
- Direct core healing/infection is much stronger, so dots flip quickly when a core reaches them.
- The old dot magnify/lens effect around cores has been removed; dots no longer repel, swirl, or balloon around the orb.
- Fog of war has been removed. The arena is fully visible so performance work can shift toward gameplay and mechanics.
- Player and enemy cores collide elastically, push apart, slow briefly, create contested gray shock zones, and now deal clash damage through shield and health.
- Core death is a setback, not an instant match end:
  - defeated enemy cores respawn at their bases after a short delay,
  - the player respawns at the player base with a territory penalty and temporary invulnerability.
- Blue and red bases pulse softly, restore nearby friendly shields, and act as respawn anchors.
- Each side has a main base. Capturing the enemy main base wins the match; losing the player main base loses the match.
- Mini-bases are placed strategically across the arena and can be captured, recaptured, and used as healing stations.
- Friendly main bases restore 20 health per second after recovery delay.
- Friendly mini-bases restore 6 health per second after recovery delay.
- Pause stops timer, movement, infection, cleansing, nodes, pulses, particles, and dot animation.
- Reset restarts the current level.

### Dark Glass Interface

- The UI now uses a compact dark glass navbar at the top of the screen.
- The top bar contains the logo, infected count, cleansed count, timer, infection level, wave, shield, level controls, AI difficulty, reset, and pause.
- The top bar is non-playable space; the arena begins below it.
- The arena now runs full-width and continues to the bottom edge of the viewport.
- Previous bottom HUD controls, bottom ability dock, bottom reset, and bottom mobile stat circles are disabled in favor of the single top command surface.
- The Pixi background/frame has been shifted to a darker atmospheric shell to better match the new UI direction.
- Influence visuals are intentionally subtle, while combat rings are clearer and match actual combat range.

### Core Combat And Progression

- Player and enemy cores have separate body, collision, combat, influence, and vision radii.
- Body radius controls orb size.
- Collision radius controls physical pushback.
- Combat radius controls visible ring-touch combat range.
- Influence radius controls healing/infection territory range.
- Vision radius controls fog reveal and stays larger than influence.
- Healing/infection influence radius is now roughly 50% of the previous V1.08 field range.
- Influence radius scales by level with `baseInfluenceRadius * (1 + 0.05 * (level - 1))`.
- Player and enemy cores also have level, XP, health, shield, mass, move speed, power, base position, respawn state, and invulnerability timers.
- Player levels 1-5 by cleansing infected dots, capturing nodes, and destroying enemy cores.
- Level-ups increase max health, shield capacity, influence radius, cleanse power, clash power, and visual core intensity.
- Level 2 strengthens shockwave.
- Level 3 unlocks the shield ability.
- Level 4 shockwave leaves short-lived protected blue territory.
- Level 5 provides a larger aura and stronger clash power with slightly slower movement.
- Health and shield rings render around player and enemy cores in Pixi.
- Floating high-contrast health/shield bars are now the primary combat readability layer:
  - health uses green, amber, and red thresholds,
  - shield uses pale violet/silver,
  - dark translucent backplates keep bars readable over territory, fog, and haze.
- Player bars are always visible. Enemy bars appear when enemies are visible, damaged, in combat, targeted, or near the player.
- Invulnerable or shielded cores display subtle ring/shell feedback.
- Combat begins when visible combat rings touch, so the visual ring matches the actual combat radius.
- Clash sparks communicate advantage: cyan when the player is winning, orange/red when the enemy is winning, and purple/gray when the clash is even.
- Core health and shield no longer regenerate during combat.
- After combat ends, territory recovery waits 3 seconds; base recovery can start after 0.75 seconds.
- Recovery supply rules:
  - enemy territory: no health or shield regeneration,
  - neutral territory: slow shield-only recovery,
  - own territory: modest health and shield regeneration,
  - own base territory: fast health and shield regeneration.
- Shield regeneration is prioritized before health regeneration.
- Level-ups no longer fully heal the player; they restore a modest 20% max health and 50% max shield after max-stat increases.
- The HUD shows compact recovery state feedback: `COMBAT`, `RECOVERING`, `REGEN`, `BASE REGEN`, or `NO SUPPLY`.
- During `RECOVERING`, the HUD shows a countdown until normal recovery can begin.
- When the player core actually restores health, small green healing numbers float above the health bar, such as `+2` in own territory or `+18` in base recovery.

### Shield Ability

- Press `E` or use the shield UI button to activate the player shield after it unlocks on level 3.
- Shield duration: 6 seconds.
- Shield cooldown: 12 seconds.
- The shield adds temporary protection and a cyan shell/ring around the player core.

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

Enemy AI still uses readable modes:

- `expand`: grows into neutral territory.
- `contest`: pressures red/blue frontlines and weak blue frontier dots.
- `defend`: retreats toward its infected home when invaded.
- `attack`: briefly pressures the player core, mostly from hunter-type enemies.
- `recover` / `retreat`: pulls back toward base when health is low or the fight is unfavorable.

Enemy targeting now uses scored candidates instead of direct chasing. Each enemy periodically evaluates neutral clusters, weak blue frontiers, nodes, bases, player territory, and the player core. Scores consider distance, territory value, node value, safety, player weakness, support, difficulty, and enemy variant role.

### AI Difficulty

Use the AI difficulty selector in the HUD:

- Easy: slower decisions, more randomness, lower aggression, weaker infection/clash pressure, rare player hunts.
- Medium: balanced frontier pressure, node capture, and sensible retreat behavior.
- Hard: faster decisions, stronger target scoring, smarter node priority, earlier retreats, and opportunistic attacks when the player is weak or exposed.
- Visible enemies show subtle intent cues: hunter attack lines, spreader infection aura pulses, tank blocking rings, retreat/recover lines back to base, and warning rings before enemy pulses fire.

### Fog Removal

- The Pixi renderer no longer calls fog or haze drawing during the frame.
- Fog and haze texture updates should remain `H0/F0` in diagnostics.
- The gameplay map is fully visible.
- Enemy awareness no longer depends on fog discovery.
- Old fog arrays remain as harmless always-visible compatibility data until the next deeper simulation cleanup.

### Arena And Objectives

- The arena is intentionally simplified for performance and readability.
- Walls, gates, viscosity zones, and energy wells are disabled in this base-capture version.
- Main bases are the win/loss objectives.
- Mini-bases replace most of the old territory-control importance and act as healing stations.

### Active Ability

- Press `Space` or use the shockwave UI button to fire the player shockwave.
- Shockwave emits a large, expanding cleansing pulse from the player core.
- Using it drains 10% of current player territory and turns those dots neutral.
- Standing in blue territory, owning nodes, and using energy wells improves recharge.
- Shockwave also pushes enemy cores away and briefly interrupts clash pressure.

### Strategic Nodes

- Advanced levels spawn larger stationary node dots.
- Hover a core over a node for 3 seconds to capture it.
- Captured nodes pulse every 5 seconds.
- Player nodes emit cleansing pulses.
- Enemy nodes emit infection pulses.

### Win, Loss, And Stars

- Win by capturing an enemy main base.
- Lose if the enemy captures the player main base.
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
  - hold/drag continuously steers the player destination,
  - touch hold/drag steers on mobile.
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
- Dot arrays still exist as lightweight simulation/fog samples, but Pixi no longer creates or renders dot sprites.
- Territory haze is now generated from bases, mini-bases, and cores instead of thousands of per-dot radial gradients.
- Per-dot frontline drawing is disabled.
- Diagnostics still report dot sample counts, but `Visible Dots` and `Active Sprites` should remain near zero in this simplified renderer.
- The arena is tracked with simple 192px render chunks for visibility, dirty, and fog diagnostics.
- Distant/inactive dot animation is throttled so stationary midgame scenes sync far fewer sprites per frame.
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
- Haze skips fully unexplored dots and reports per-frame texture update counts for debugging.

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
- visible dot count,
- hidden/unexplored dot count,
- synced dot sprites this frame,
- dirty dot count,
- visible/dirty/fogged chunk counts,
- render-state build time,
- render-state allocation count,
- dot sprite sync time,
- health bar sync time,
- fog/haze sync time,
- haze and fog texture update counts,
- fog visual toggle state,
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
- active attached dot sprite count,
- unaccounted frame time, which is frame time not explained by game update or Pixi sync and is useful for spotting render/compositor/GPU pressure,
- active Pixi effect object count,
- player level and XP,
- player health and shield,
- recovery state,
- combat lockout remaining,
- health and shield regeneration per second,
- local territory supply,
- base proximity,
- shield cooldown/duration,
- player respawn timer,
- AI difficulty,
- enemy health/shield summary,
- selected AI target/mode per enemy,
- player and enemy death counters.

### Visual Direction

- The game now uses a dark atmospheric shell with compact glass controls.
- Blue/cyan and red/orange haze makes territory ownership readable.
- Gray/purple frontline flicker highlights contested zones.
- Larger nodes, darker viscosity zones, walls, gates, and energy wells add tactical landmarks.
- Core health rings, shield shells, base pulses, respawn rings, and death bursts make core combat readable without adding shaders.
- The arena is fully visible, with readability coming from bases, cores, capture rings, and lightweight effects.
- Mobile uses the same top command surface with horizontal overflow instead of separate bottom controls.

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
