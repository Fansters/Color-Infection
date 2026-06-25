# Color Infection

Color Infection is a web-based 2D territorial puzzle prototype built with Next.js App Router, TypeScript, React, PixiJS, and Tailwind CSS.

## Version 1.21

Version 1.21 is the Arena Boundary and Mini-Base Bonus pass. It builds on V1.20 with cleaner orb readability, compact level-up choices, a richer static arena boundary, strategic mini-base placement, max-health bonuses from captured mini-bases, dismissible hints, improved ability tooltips, and wheel/pinch-only zoom.

The main V1.21 direction: the arena should be more readable and strategic without adding rendering cost. Mini-bases are now valuable health objectives, the playable bounds are visually obvious, and upgrade/hint overlays interrupt the fight less.

V1.20 dark HUD and zoom, V1.19 support bots and strategic AI, V1.18 combat fixes, V1.17 start flow, V1.16 strategic bases, V1.15 fog removal, V1.13 base capture, V1.12 recovery feedback, V1.10 recovery, V1.09 radius readability, V1.08 dark glass UI, V1.07 hold-and-drag movement, V1.06 core combat, and V1.05 pulse/spike optimizations remain in place.

The architecture is intentionally split:

- `Game.ts` owns simulation state, level generation, cores, base capture, supply, enemy AI, collisions, nodes, pulses, win/loss rules, pause/reset, and debug stats.
- Pixi rendering owns the animated scene: application lifecycle, layers, textures, sprites, pooled visual effects, resize handling, and cleanup.
- React owns layout, start screen, level select, HUD, pause/reset/shockwave buttons, mobile controls, keyboard shortcuts, and the diagnostics overlay.

### Start Flow

- The app now opens on a dark glass home screen instead of immediately dropping the player into live gameplay.
- Press `Start` to open level select.
- Level select shows all six designed arena levels with their names, summaries, and enemy counts.
- Starting a level resets that level and unpauses the simulation.
- The in-game navbar includes Home and Levels controls, letting the player pause live gameplay and return to the menu flow without reloading the page.
- `Continue Level` starts the currently selected level from the home screen.
- The old in-navbar previous/next level switcher has been removed so level changes happen through level select.

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
- The player focuses on capturing the enemy main base, controlling mini-bases, healing, and using shockwave at high-risk moments.
- Core movement speed is reduced by 50%, making positioning heavier and more intentional.
- Old infected/cleansed dot territory is no longer the main gameplay loop or HUD framing.
- The old dot magnify/lens effect around cores has been removed; dots no longer repel, swirl, or balloon around the orb.
- Fog of war has been removed. The arena is fully visible so performance work can shift toward gameplay and mechanics.
- Player and enemy cores collide elastically, push apart, slow briefly, create contested gray shock zones, and now deal clash damage through shield and health.
- Core clash damage now runs directly from the active combat update path, so player and enemy cores can damage each other whenever combat rings overlap.
- Core death is a setback, not an instant match end:
  - defeated enemy cores respawn at their bases after a short delay,
  - the player respawns at the player base with temporary invulnerability.
- Defeated enemy cores now respawn after a fixed 9 seconds.
- Enemy cores no longer receive spawn invulnerability when entering or re-entering the arena.
- Blue and red bases pulse softly, restore nearby friendly shields, and act as respawn anchors.
- Each side has one main base. Capturing the enemy main base wins the match; losing the player main base loses the match.
- In multi-enemy levels, every enemy core spawns and respawns from the same enemy main base in the opposite corner.
- Bases have visible capture zones and capture progress rings.
- If one team core is inside a capture zone, capture moves toward that team.
- If both teams are inside, capture is contested and progress slows/bleeds instead of freely completing.
- If no opposing core is inside, capture progress stabilizes back toward the current owner.
- Mini-bases are placed strategically across the arena and can be captured, recaptured, and used as healing stations by their owner.
- Each map uses six mini-bases placed as strategic objectives across the arena rather than as forced supply chains.
- Mini-base connection logic is no longer required for healing.
- Each captured mini-base adds +10 max health to the owning team.
- If the enemy recaptures a player-owned mini-base, the player loses that +10 max-health bonus.
- Capturing a mini-base awards XP.
- Friendly main bases restore 20 health per second after recovery delay.
- Friendly captured mini-bases restore 6 health per second after recovery delay.
- Level-ups can trigger compact upgrade choices: Clash Power, Shield Cell, or Drive.
- If the player ignores upgrades and levels multiple times, each level-up is queued as a pending upgrade pick.
- Contextual hints explain key conditions such as capturing mini-bases, isolated bases, base threats, recovery supply, upgrades, and the enemy main-base goal.
- Hints are dismissible with a close button.
- The `Choose an upgrade` hint no longer sticks after the player chooses an upgrade.
- Pause stops timer, movement, base capture, enemy decisions, nodes, pulses, particles, and core animation.
- Reset restarts the current level.
- Arena zoom uses mouse wheel on desktop and pinch gestures on touch devices.
- Visible zoom buttons were removed to keep the arena cleaner.

### Dark Glass Interface

- The UI uses an 80px dark glass navbar at the top of the screen.
- The arena and navbar now share a deeper blue-black sci-fi background treatment with a subtle dotted texture.
- The top bar is simplified to Home, Levels, enemy-base capture progress, compact recovery, AI difficulty, reset, and pause.
- The old in-match logo, timer, core-level pill, supplied mini-base pill, and top ability buttons have been removed from the visible navbar.
- The enemy-base objective copy now reads as the main objective: capture the enemy base.
- Wave, Shield, and Bot abilities now live in a small bottom-center in-arena dock.
- The top bar is non-playable space; the arena begins below it.
- The arena now runs full-width and continues to the bottom edge of the viewport.
- Previous legacy bottom HUD/mobile stat circles remain disabled.
- The Pixi background/frame has been shifted to a darker atmospheric shell to better match the new visual direction.
- Player and enemy orb sprites now use a stronger 3D radial highlight/rim style.
- Floating health/shield bars are larger, higher contrast, and include small shield/health glyphs for faster reading.
- Health/shield arc rings around orb bodies have been removed because the bars now carry that information.
- Bar icons are smaller, and the health icon is red for better recognition.
- Ability tooltips now use a wider padded tooltip so labels do not collapse into one word per line.
- The level-up UI is now a compact dark command bar with three choices: Clash Power, Shield Cell, and Drive.
- Influence visuals are intentionally subtle, while combat rings are clearer and match actual combat range.
- The player core displays a small `LV n` title under the orb so progression is readable directly in the arena.

### Core Combat And Progression

- Player and enemy cores have separate body, collision, combat, influence, and vision radii.
- Body radius controls orb size.
- Collision radius controls physical pushback.
- Combat radius controls visible ring-touch combat range.
- Influence radius is retained for ability and proximity calculations, but the main visible objective is base capture.
- Vision radius controls enemy visibility.
- Influence radius is now roughly 50% of the previous V1.08 field range.
- Influence radius scales by level with `baseInfluenceRadius * (1 + 0.05 * (level - 1))`.
- Player and enemy cores also have level, XP, health, shield, mass, move speed, power, base position, respawn state, and invulnerability timers.
- Player and enemy cores now support levels 1-10.
- The player levels by capturing mini-bases, dealing combat pressure, and destroying enemy cores.
- Level-ups increase max health, shield capacity, influence radius, cleanse power, clash power, and visual core intensity.
- Level 2 strengthens shockwave.
- Level 3 unlocks the shield ability.
- Level 4 improves shockwave utility.
- Higher core levels continue increasing health, shields, combat power, mass, and radius, with slight high-level speed tradeoffs.
- Health and shield arc rings around player and enemy cores have been removed from the orb body.
- Floating high-contrast health/shield bars are now the primary combat readability layer:
  - health uses green, amber, and red thresholds,
  - shield uses pale violet/silver,
  - dark translucent backplates keep bars readable over bases, effects, and the arena background.
- Player recovery is isolated from support-bot combat. If support bots fight elsewhere, the player core can still regenerate normally when it is not personally fighting.
- Player bars are always visible. Enemy bars appear only when enemies are visible through player proximity or temporary reveal.
- Invulnerable or shielded cores display subtle ring/shell feedback.
- Combat begins when visible combat rings touch, so the visual ring matches the actual combat radius.
- Clash sparks communicate advantage: cyan when the player is winning, orange/red when the enemy is winning, and purple/gray when the clash is even.
- Core health and shield no longer regenerate during combat.
- After combat ends, normal recovery waits 3 seconds; base recovery can start after 0.75 seconds.
- Recovery supply rules:
  - neutral arena: slow shield-only recovery,
  - captured mini-base: medium health and shield regeneration,
  - own main base: fast health and shield regeneration.
- Shield regeneration is prioritized before health regeneration.
- Level-ups no longer fully heal the player; they restore a modest 20% max health and 50% max shield after max-stat increases.
- The HUD shows compact recovery state feedback: `COMBAT`, `RECOVERING`, `REGEN`, `BASE REGEN`, or `NO SUPPLY`.
- During `RECOVERING`, the HUD shows a countdown until normal recovery can begin.
- When the player core actually restores health, small green healing numbers float above the health bar, such as `+6` at supplied mini-bases or `+20` in main-base recovery.

### Shield Ability

- Press `E` or use the shield UI button to activate the player shield after it unlocks on level 3.
- Shield duration: 6 seconds.
- Shield cooldown: 12 seconds.
- The shield adds temporary protection and is reflected in the floating shield bar.

### Arena Boundary

- The playable arena now has a clear rounded containment field.
- Outside the arena is darker and quieter; inside keeps the subtle dotted game surface.
- The boundary uses a thin cyan/white energy rim with static corner accents and scanline/tick details.
- Arena background and border textures are generated once on resize and reused by Pixi.
- Dragging outside the playable bounds clamps the destination to the nearest valid point.
- Out-of-bounds destination feedback turns amber and shows a small blocked-boundary ring at the valid point.
- Cores remain clamped to arena bounds.
- When a core presses against the boundary, a subtle pooled ripple/particle effect plays on the border.
- The nearby edge segment brightens softly when the player is close.

### Support Bot Ability

- Press `F` or use the bot UI button to deploy a small cyan support bot.
- Up to three support bots can be active at once.
- Support bots evaluate nearby mini-bases and enemies, then move independently to help capture or contest the arena.
- Support bots capture mini-bases slowly, at roughly 25% of the main core capture speed.
- Support bots cannot capture main bases; only large player/enemy cores can win or lose the match by taking a main base.
- Support bots have light health, shield, collision, health bars, level labels, and trails, and can be destroyed in combat.

### Level Structure

The prototype introduces mechanics gradually:

- Level 1, First Cleanse: no enemy core; learn movement and base capture.
- Level 2, Pinned Core: a static enemy core guards the enemy side.
- Level 3, Slow Spreader: a slow enemy core starts expanding into mini-bases.
- Level 4, Border Contest: the enemy begins contesting the base network.
- Level 5, Pulse Pressure: enemy pulses and a light hunter escort enter play.
- Level 6, Open War: nodes, walls, gates, energy wells, viscosity zones, and enemy variants combine.

Use the home screen level select to choose a level.

### Enemy Variants

- Spreader: slow, broad pressure field, strong base-control pressure.
- Hunter: faster, occasionally attacks the player, but spreads weakly.
- Tank: large, slow, high mass, hard to push.
- Splitter: breaks into smaller hunter-style enemy cores when damaged.
- Root: stationary; in advanced levels it creates area pressure.

Enemy AI still uses readable modes:

- `expand`: moves toward neutral or weakly defended mini-bases.
- `contest`: pressures the base network and exposed supplied mini-bases.
- `defend`: retreats toward enemy-owned bases when invaded.
- `attack`: briefly pressures the player core, mostly from hunter-type enemies.
- `recover` / `retreat`: pulls back toward base when health is low or the fight is unfavorable.

Enemy targeting now uses scored candidates instead of direct chasing. Each enemy periodically evaluates neutral mini-bases, supplied player mini-bases, isolated player mini-bases, threatened enemy mini-bases, main-base threats, recovery routes, route interception points, the player main base, and the player core. Scores consider objective value, urgency, safety, distance, danger, player weakness, nearby support, difficulty, and enemy role.

Enemy AI roles now shape utility weights:

- Capturer: prioritizes neutral and isolated bases.
- Defender: protects the main base and important outposts.
- Hunter: attacks weak or overextended players when it has a favorable fight.
- Interceptor: pressures likely routes and cuts supply lines.
- Support: stays nearer allied objectives and reinforces contested areas.

Enemy goals use short commitment timers, so bots hold a chosen objective for 1-2 seconds and only switch early when a substantially better goal appears. This prevents rapid jitter and reduces every enemy piling onto the same target.

### AI Difficulty

Use the AI difficulty selector in the HUD:

- Easy: slower decisions, more randomness, lower aggression, weaker base/clash pressure, rare player hunts.
- Medium: balanced mini-base capture, defense, recovery, and sensible retreat behavior.
- Hard: faster decisions, stronger base scoring, smarter supply-line pressure, earlier retreats, and opportunistic attacks when the player is weak or exposed.
- Hard also reacts earlier to main-base threats, prioritizes supply-line cuts, and uses simple route prediction around player movement between mini-bases.
- Visible enemies show subtle non-directional intent cues: hunter pressure rings, spreader pressure aura pulses, tank blocking rings, retreat/recover rings, and warning rings before enemy pulses fire.
- Enemy cores are hidden unless inside player vision/combat range or temporarily revealed by shockwave.
- Enemy destination/target lines are no longer drawn in the arena, so enemy intent does not leak through offscreen or hidden path lines.

### Fog Removal

- The Pixi renderer no longer calls fog or haze drawing during the frame.
- Fog and haze texture updates should remain `H0/F0` in diagnostics.
- The gameplay map is fully visible.
- Enemy visibility now depends on local player vision/combat range, not full-map fog textures.
- Old fog arrays remain as harmless always-visible compatibility data until the next deeper simulation cleanup.

### Arena And Objectives

- The arena is intentionally simplified for performance and readability.
- Walls, gates, viscosity zones, and energy wells are disabled in this base-capture version.
- Main bases are the win/loss objectives.
- Mini-bases replace most of the old territory-control importance and act as supplied healing stations.
- Supplied mini-bases pulse gently and show connection lines back through the supply network.
- Relay/mini-bases use a small chain/ring motif.
- Isolated bases are visually dimmer and flicker to show that they need connection.

### Active Ability

- Press `Space` or use the shockwave UI button to fire the player shockwave.
- Shockwave emits a large, expanding utility pulse from the player core.
- Enemy cores are revealed only after the expanding shockwave reaches them, then fade in and out for a few seconds.
- Supplied bases and owned supplied mini-bases improve recharge.
- Shockwave also pushes enemy cores away and briefly interrupts clash pressure.

### Strategic Nodes

- Advanced levels spawn larger stationary node dots.
- Hover a core over a node for 3 seconds to capture it.
- Captured nodes pulse every 5 seconds.
- Player and enemy nodes emit lightweight area pulses and visual pressure.

### Win, Loss, And Stars

- Win by capturing an enemy main base.
- Lose if the enemy captures the player main base.
- The timer does not cause instant loss.
- Star scoring is based on win time:
  - under 2:00 = 3 stars,
  - under 3:30 = 2 stars,
  - under 5:00 = 1 star.
- After 5:00, enemy pressure gradually becomes stronger, but the player can still win.

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
- The Pixi background now uses generated static textures: a dark gradient arena shell, a subtle tiled dot grid, and a vignette generated only on resize.
- There are no dynamic fog/haze texture rebuilds in the active frame path.
- Base influence glows are low-count graphics around bases rather than full-screen haze from dots.
- Moving cores leave a capped, fading glow trail. Trails are only sampled while cores move.
- Base glows are generated from bases, mini-bases, and cores instead of thousands of per-dot radial gradients.
- Per-dot frontline drawing is disabled.
- Diagnostics still report dot sample counts, but `Visible Dots` and `Active Sprites` should remain near zero in this simplified renderer.
- The arena is tracked with simple 192px render chunks for visibility, dirty, and fog diagnostics.
- Distant/inactive dot animation is throttled so stationary midgame scenes sync far fewer sprites per frame.
- Cores render through Pixi sprites and lightweight graphics for aura, destination, and collision feedback.
- Ripples, pulses, shockwaves, particles, and collision bursts are rendered with pooled Pixi display objects.
- Pulse and ripple rings use a reusable pre-rendered Pixi ring texture instead of redrawing ring graphics every frame.
- Shockwave, enemy pulse, and node pulse visuals run as active pulse objects that expand over time.
- Active pulses no longer process dot-territory hits in the main gameplay loop.
- Shockwave particle bursts are capped and pooled.
- Effect caps are:
  - `MAX_RIPPLES = 30`
  - `MAX_PARTICLES = 300`
  - `MAX_PULSES = 10`
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
- legacy shockwave dot counters, expected to stay near zero after the base-capture cleanup,
- particles spawned by the last shockwave,
- active pulse queue length,
- dot count,
- visible dot count,
- hidden/unexplored dot count,
- synced dot sprites this frame,
- dirty dot count,
- visible/dirty/fogged chunk counts for legacy diagnostic compatibility,
- render-state build time,
- render-state allocation count,
- dot sprite sync time,
- health bar sync time,
- fog/haze sync time, expected to stay near zero,
- haze and fog texture update counts, expected to remain `H0/F0`,
- fog visual state, now disabled,
- ripple count,
- particle count,
- pulse count,
- active effect count,
- capped DPR,
- legacy haze scale/update cadence,
- legacy haze rebuild cost, expected to stay near zero,
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
- local base supply,
- base proximity,
- shield cooldown/duration,
- player respawn timer,
- AI difficulty,
- enemy health/shield summary,
- selected AI target/mode per enemy,
- player and enemy death counters.

### Visual Direction

- The game now uses a dark atmospheric shell with compact glass controls.
- Blue/cyan and red/orange base glows make base ownership readable.
- Gray/purple clash bursts highlight contested core collisions.
- Larger mini-bases and main-base rings are the primary tactical landmarks.
- Core health rings, shield shells, base pulses, respawn rings, and death bursts make core combat readable without adding shaders.
- The arena is fully visible, with readability coming from bases, cores, capture rings, and lightweight effects.
- Mobile uses the same top command surface with horizontal overflow instead of separate bottom controls.

### Main Files

- `src/app/page.tsx` mounts the game.
- `src/components/GameCanvas.tsx` owns the React shell, home screen, level select, HUD, debug overlay, pause/reset/shockwave controls, and keyboard shortcuts.
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
