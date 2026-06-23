import { Application, Graphics, Sprite, Texture } from "pixi.js";
import {
  HAZE_FRAME_INTERVAL,
  HAZE_SCALE,
  type Agent,
  type AgentKind,
  type Arena,
  type GameRenderState,
  type PixiRenderMetrics,
} from "@/lib/game/Game";
import { palette, rgba, type Rgb } from "@/lib/game/colors";
import { clamp } from "@/lib/game/math";
import { GraphicsPool, SpritePool } from "./pixiEffects";
import { countPixiChildren, createPixiLayers, type PixiLayers } from "./pixiLayers";
import { createPixiTextures, destroyPixiTextures, type DotTextureKey, type PixiTextures } from "./pixiTextures";

function colorToHex(color: Rgb) {
  return (color.r << 16) + (color.g << 8) + color.b;
}

function ownerColor(owner: AgentKind | "neutral") {
  if (owner === "player") {
    return colorToHex(palette.playerHot);
  }

  if (owner === "enemy") {
    return colorToHex(palette.infectedHot);
  }

  return colorToHex(palette.neutral);
}

function drawArenaPath(graphic: Graphics, arena: Arena) {
  graphic.roundRect(arena.x, arena.y, arena.width, arena.height, arena.radius);
}

function pulseScale(time: number, phase: number, amount = 0.08, speed = 1) {
  return 1 + Math.sin(time * speed + phase) * amount;
}

export class PixiRenderer {
  app: Application | null = null;

  private layers: PixiLayers | null = null;
  private textures: PixiTextures | null = null;
  private backgroundGraphics = new Graphics({ label: "backgroundGraphics" });
  private arenaFrameGraphics = new Graphics({ label: "arenaFrameGraphics" });
  private baseGraphics = new Graphics({ label: "baseGraphics" });
  private modifierGraphics = new Graphics({ label: "modifierGraphics" });
  private nodeGraphics = new Graphics({ label: "nodeGraphics" });
  private coreAuraGraphics = new Graphics({ label: "coreAuraGraphics" });
  private coreMarkGraphics = new Graphics({ label: "coreMarkGraphics" });
  private destinationGraphics = new Graphics({ label: "destinationGraphics" });
  private frontlineGraphics = new Graphics({ label: "frontlineGraphics" });
  private dotSprites = new Map<number, Sprite>();
  private coreSprites = new Map<number, Sprite>();
  private ripples: SpritePool | null = null;
  private pulses: SpritePool | null = null;
  private contestedZones: GraphicsPool | null = null;
  private particles: SpritePool | null = null;
  private hazeCanvas: HTMLCanvasElement | null = null;
  private hazeTexture: Texture | null = null;
  private hazeSprite: Sprite | null = null;
  private hazeContext: CanvasRenderingContext2D | null = null;
  private hazeCountdown = 0;
  private pulseHazeBoostFrames = 0;
  private lastHazeRebuildMs = 0;
  private hazeEvery = HAZE_FRAME_INTERVAL;
  private lastRevision = -1;
  private width = 0;
  private height = 0;
  private dpr = 1;

  async init(host: HTMLElement, width: number, height: number, dpr: number) {
    const app = new Application();
    await app.init({
      width,
      height,
      resolution: dpr,
      autoDensity: true,
      antialias: true,
      backgroundAlpha: 0,
      preference: "webgl",
    });

    app.canvas.className = "absolute inset-0 h-full w-full touch-none";
    app.canvas.style.width = `${width}px`;
    app.canvas.style.height = `${height}px`;
    app.canvas.setAttribute(
      "aria-label",
      "Color Infection Pixi arena. Move mouse to preview, click or tap to set destination, press Space for shockwave, press D for diagnostics.",
    );
    app.canvas.setAttribute("role", "application");
    host.appendChild(app.canvas);

    this.app = app;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.textures = createPixiTextures();
    this.layers = createPixiLayers(app.stage);
    this.layers.backgroundLayer.addChild(this.backgroundGraphics, this.arenaFrameGraphics);
    this.layers.territoryLayer.addChild(this.frontlineGraphics);
    this.layers.modifierLayer.addChild(this.baseGraphics, this.modifierGraphics, this.destinationGraphics);
    this.layers.nodeLayer.addChild(this.nodeGraphics);
    this.layers.coreLayer.addChild(this.coreAuraGraphics, this.coreMarkGraphics);
    this.ripples = new SpritePool(this.layers.effectLayer, this.textures.ring);
    this.pulses = new SpritePool(this.layers.effectLayer, this.textures.ring);
    this.contestedZones = new GraphicsPool(this.layers.effectLayer);
    this.particles = new SpritePool(this.layers.effectLayer, this.textures.particle);
  }

  resize(width: number, height: number, dpr: number) {
    if (!this.app) {
      return;
    }

    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.app.renderer.resolution = dpr;
    this.app.renderer.resize(width, height);
    this.app.canvas.style.width = `${width}px`;
    this.app.canvas.style.height = `${height}px`;
    this.resetHazeTexture();
  }

  sync(state: GameRenderState): PixiRenderMetrics {
    if (!this.layers || !this.textures || !this.app) {
      return this.emptyMetrics();
    }

    const syncStarted = typeof performance !== "undefined" ? performance.now() : 0;

    if (state.revision !== this.lastRevision) {
      this.rebuildDots(state);
      this.lastRevision = state.revision;
      this.resetHazeTexture();
    }

    this.drawBackground(state);
    this.drawArenaMask(state.arena);
    this.drawHaze(state);
    this.drawBases(state);
    this.syncDots(state);
    this.drawModifiers(state);
    this.drawNodes(state);
    this.drawCores(state);
    this.drawEffects(state);

    return {
      rendererType: `Pixi ${this.app.renderer.constructor.name || "Renderer"}`,
      stageChildren: countPixiChildren(this.layers),
      dotSpriteCount: this.dotSprites.size,
      activeParticleSpriteCount: this.particles?.activeCount ?? 0,
      activeEffectObjectCount:
        (this.particles?.activeCount ?? 0) +
        (this.ripples?.activeCount ?? 0) +
        (this.pulses?.activeCount ?? 0) +
        (this.contestedZones?.activeCount ?? 0),
      hazeRebuildMs: this.lastHazeRebuildMs,
      hazeEvery: this.hazeEvery,
      pixiSyncMs: syncStarted > 0 ? performance.now() - syncStarted : 0,
    };
  }

  destroy() {
    this.ripples?.destroy();
    this.pulses?.destroy();
    this.contestedZones?.destroy();
    this.particles?.destroy();
    this.dotSprites.clear();
    this.coreSprites.clear();

    if (this.textures) {
      destroyPixiTextures(this.textures);
      this.textures = null;
    }

    this.hazeTexture?.destroy(true);
    this.hazeTexture = null;
    this.hazeSprite = null;
    this.hazeCanvas = null;
    this.hazeContext = null;

    if (this.app) {
      this.app.destroy(true, { children: true, texture: false, textureSource: false });
      this.app = null;
    }

    this.layers = null;
  }

  private emptyMetrics(): PixiRenderMetrics {
    return {
      rendererType: "Pixi Renderer",
      stageChildren: 0,
      dotSpriteCount: 0,
      activeParticleSpriteCount: 0,
      activeEffectObjectCount: 0,
      hazeRebuildMs: 0,
      hazeEvery: HAZE_FRAME_INTERVAL,
      pixiSyncMs: 0,
    };
  }

  private rebuildDots(state: GameRenderState) {
    if (!this.layers || !this.textures) {
      return;
    }

    this.layers.dotLayer.removeChildren();
    this.dotSprites.clear();

    for (const dot of state.dots) {
      const sprite = new Sprite(this.textures.dots.neutral);
      sprite.anchor.set(0.5);
      sprite.position.set(dot.x, dot.y);
      this.layers.dotLayer.addChild(sprite);
      this.dotSprites.set(dot.id, sprite);
    }
  }

  private drawBackground(state: GameRenderState) {
    const arena = state.arena;
    this.backgroundGraphics.clear();
    this.backgroundGraphics.rect(0, 0, state.width, state.height).fill({ color: 0xf5f8fb });
    this.backgroundGraphics
      .rect(0, state.height * 0.38, state.width, state.height * 0.62)
      .fill({ color: 0xedf4f8, alpha: 0.72 });
    drawArenaPath(this.backgroundGraphics, arena);
    this.backgroundGraphics.fill({ color: 0xfbfdff, alpha: 0.96 });

    this.arenaFrameGraphics.clear();
    drawArenaPath(this.arenaFrameGraphics, arena);
    this.arenaFrameGraphics.stroke({ color: 0xffffff, alpha: 0.92, width: 3 });
    drawArenaPath(this.arenaFrameGraphics, arena);
    this.arenaFrameGraphics.stroke({ color: 0x7a90a8, alpha: 0.16, width: 1 });
  }

  private drawArenaMask(arena: Arena) {
    if (!this.layers) {
      return;
    }

    this.layers.arenaMask.clear();
    drawArenaPath(this.layers.arenaMask, arena);
    this.layers.arenaMask.fill({ color: 0xffffff });
  }

  private syncDots(state: GameRenderState) {
    if (!this.textures) {
      return;
    }

    for (const dot of state.dots) {
      const sprite = this.dotSprites.get(dot.id);

      if (!sprite) {
        continue;
      }

      const frontline = state.frontline[dot.id] ?? 0;
      const energy = Math.max(dot.energy, dot.enemyEnergy);
      const contest = Math.min(dot.infectionAmount, dot.playerAmount);
      let textureKey: DotTextureKey = "neutral";
      let alpha = 0.5 + energy * 0.18;
      let scale = 0.16;

      if (frontline > 0.18 || contest > 0.16) {
        textureKey = "contested";
        alpha = clamp(0.42 + Math.max(frontline, contest) * 0.5 + energy * 0.2, 0.35, 0.95);
        scale = 0.25;
      } else if (dot.infectionAmount > dot.playerAmount && dot.infectionAmount > 0.08) {
        textureKey = "infected";
        alpha = clamp(0.36 + dot.infectionAmount * 0.72 + energy * 0.18, 0.34, 1);
        scale = 0.24;
      } else if (dot.playerAmount > 0.08) {
        textureKey = "player";
        alpha = clamp(0.36 + dot.playerAmount * 0.68 + energy * 0.18, 0.34, 1);
        scale = 0.23;
      }

      sprite.texture = this.textures.dots[textureKey];
      sprite.position.set(dot.x, dot.y);
      sprite.alpha = alpha;
      sprite.scale.set(Math.max(0.08, (dot.radius + frontline * 1.2) * scale));
      sprite.visible = true;
    }
  }

  private drawModifiers(state: GameRenderState) {
    this.modifierGraphics.clear();
    this.destinationGraphics.clear();
    this.drawViscosityZones(state);
    this.drawEnergyWells(state);
    this.drawBlockers(state);
    this.drawDestination(state);
    this.drawFrontlines(state);
  }

  private drawBases(state: GameRenderState) {
    this.baseGraphics.clear();

    for (const base of state.bases) {
      const isPlayer = base.team === "player";
      const color = isPlayer ? colorToHex(palette.playerHot) : colorToHex(palette.infectedHot);
      const edge = isPlayer ? colorToHex(palette.player) : colorToHex(palette.infected);
      const pulse = pulseScale(state.time, base.pulse, 0.08, 2);
      const radius = base.radius * pulse;
      this.baseGraphics.circle(base.x, base.y, radius * 1.28).fill({ color: edge, alpha: isPlayer ? 0.07 : 0.06 });
      this.baseGraphics.circle(base.x, base.y, radius * 0.78).fill({ color, alpha: isPlayer ? 0.11 : 0.1 });
      this.baseGraphics.circle(base.x, base.y, radius).stroke({ color, alpha: 0.34, width: 1.6 });
    }
  }

  private drawViscosityZones(state: GameRenderState) {
    for (const zone of state.viscosityZones) {
      const radius = zone.radius * pulseScale(state.time, zone.phase, 0.08, 0.9);
      this.modifierGraphics.circle(zone.x, zone.y, radius).fill({
        color: 0x475569,
        alpha: 0.085 * zone.strength,
      });
      this.modifierGraphics.circle(zone.x, zone.y, radius * 0.52).fill({
        color: 0x475569,
        alpha: 0.04 * zone.strength,
      });
    }
  }

  private drawEnergyWells(state: GameRenderState) {
    for (const well of state.energyWells) {
      const radius = well.radius * pulseScale(state.time, well.phase, 0.08, 2.2);
      this.modifierGraphics.circle(well.x, well.y, radius * 1.75).fill({ color: 0x52dbe8, alpha: 0.09 });
      this.modifierGraphics.circle(well.x, well.y, radius).stroke({ color: 0x1eaee9, alpha: 0.38, width: 1.6 });
      this.modifierGraphics.circle(well.x, well.y, Math.max(3, radius * 0.14)).fill({ color: 0x56dbe8, alpha: 0.5 });
    }
  }

  private drawBlockers(state: GameRenderState) {
    for (const blocker of state.blockers) {
      const open = blocker.kind === "gate" ? blocker.openProgress : 0;
      const radius = blocker.kind === "gate" ? blocker.radius * (1 - open * 0.18) : blocker.radius;
      const fillAlpha = blocker.kind === "gate" ? 0.22 * (1 - open) + 0.05 : 0.18;

      this.modifierGraphics.circle(blocker.x, blocker.y, radius).fill({
        color: blocker.kind === "gate" ? 0x4f5e70 : 0x536071,
        alpha: fillAlpha,
      });
      this.modifierGraphics.circle(blocker.x, blocker.y, radius + 3).stroke({
        color: blocker.kind === "gate" ? 0x1eaee9 : 0x536071,
        alpha: blocker.kind === "gate" ? 0.2 + open * 0.48 : 0.22,
        width: blocker.kind === "gate" ? 2.2 : 1.2,
      });

      if (blocker.kind === "gate" && open > 0.08) {
        this.modifierGraphics.circle(blocker.x, blocker.y, radius + 9).stroke({
          color: 0x56dbe8,
          alpha: open * 0.5,
          width: 1.2,
        });
      }
    }
  }

  private drawDestination(state: GameRenderState) {
    if (state.destination.active) {
      const targetDistance = Math.hypot(
        state.player.x - state.destination.x,
        state.player.y - state.destination.y,
      );
      const pulse = 1 + Math.sin(state.destination.pulse * 7) * 0.12;
      const alpha = clamp(0.2 + targetDistance / 420, 0.2, 0.62);

      this.destinationGraphics
        .moveTo(state.player.x, state.player.y)
        .lineTo(state.destination.x, state.destination.y)
        .stroke({ color: colorToHex(palette.player), alpha: alpha * 0.42, width: 1.4 });
      this.destinationGraphics.circle(state.destination.x, state.destination.y, 12 * pulse).stroke({
        color: colorToHex(palette.playerHot),
        alpha,
        width: 2,
      });
    }

    if (state.preview.active) {
      this.destinationGraphics.circle(state.preview.x, state.preview.y, 10).stroke({
        color: colorToHex(palette.player),
        alpha: 0.22,
        width: 1,
      });
    }
  }

  private drawFrontlines(state: GameRenderState) {
    this.frontlineGraphics.clear();

    for (const dot of state.dots) {
      const frontline = state.frontline[dot.id] ?? 0;

      if (frontline < 0.22) {
        continue;
      }

      const flicker = 0.65 + Math.sin(state.time * 9 + dot.id) * 0.35;
      this.frontlineGraphics.circle(dot.x, dot.y, dot.radius + 2 + frontline * 2.2).fill({
        color: 0x8069a0,
        alpha: frontline * 0.2 * flicker,
      });
    }
  }

  private drawNodes(state: GameRenderState) {
    this.nodeGraphics.clear();

    for (const node of state.nodes) {
      const color = ownerColor(node.owner);
      const radius = node.radius * pulseScale(state.time, node.id, 0.08, 2.4);
      const alpha = node.owner === "neutral" ? 0.42 : 0.88;

      this.nodeGraphics.circle(node.x, node.y, radius).fill({ color, alpha });
      this.nodeGraphics.circle(node.x, node.y, radius + 4).stroke({ color: 0xffffff, alpha: 0.82, width: 2 });

      if (node.captureBy && node.captureProgress > 0.001) {
        const arcRadius = radius + 8;
        const start = -Math.PI / 2;
        const end = start + Math.PI * 2 * node.captureProgress;

        this.nodeGraphics
          .moveTo(node.x + Math.cos(start) * arcRadius, node.y + Math.sin(start) * arcRadius)
          .arc(node.x, node.y, arcRadius, start, end);
        this.nodeGraphics.stroke({ color: ownerColor(node.captureBy), alpha: 0.86, width: 3 });
      }
    }
  }

  private drawCores(state: GameRenderState) {
    if (!this.layers || !this.textures) {
      return;
    }

    this.coreAuraGraphics.clear();
    this.coreMarkGraphics.clear();
    this.syncCoreSprite(state.player, "player");

    for (const enemy of state.enemies) {
      this.syncCoreSprite(enemy, "enemy");
    }

    for (const [id, sprite] of this.coreSprites) {
      const stillVisible = id === 0 || state.enemies.some((enemy) => enemy.id === id);
      sprite.visible = stillVisible;
    }

    for (const enemy of state.enemies) {
      this.drawSoftField(enemy, "enemy", state);
      this.drawEnemyMark(enemy, state.time);
    }

    this.drawSoftField(state.player, "player", state);

    if (state.debugVisible) {
      this.drawEnemyTargetDebug(state);
    }
  }

  private syncCoreSprite(agent: Agent, kind: AgentKind) {
    if (!this.layers || !this.textures) {
      return;
    }

    let sprite = this.coreSprites.get(agent.id);

    if (!sprite) {
      sprite = new Sprite(kind === "player" ? this.textures.cores.player : this.textures.cores.enemy);
      sprite.anchor.set(0.5);
      this.layers.coreLayer.addChild(sprite);
      this.coreSprites.set(agent.id, sprite);
    }

    const pulse = 1 + Math.sin((this.app?.ticker.lastTime ?? 0) * 0.002 + agent.id) * 0.05;
    const size = agent.radius * 4.1 * pulse;
    sprite.texture = kind === "player" ? this.textures.cores.player : this.textures.cores.enemy;
    sprite.position.set(agent.x, agent.y);
    sprite.width = size;
    sprite.height = size;
    sprite.alpha = agent.isRespawning ? 0 : clamp(0.68 + (agent.health / Math.max(1, agent.maxHealth)) * 0.32, 0.3, 1);
    sprite.visible = !agent.isRespawning && agent.active;
  }

  private drawSoftField(agent: Agent, kind: AgentKind, state: GameRenderState) {
    if (agent.isRespawning || !agent.active) {
      return;
    }

    const color = kind === "player" ? colorToHex(palette.playerHot) : colorToHex(palette.infectedHot);
    const edge = kind === "player" ? colorToHex(palette.player) : colorToHex(palette.infected);
    const radius = agent.fieldRadius * (kind === "player" ? 1.08 : 1.02);

    this.coreAuraGraphics.circle(agent.x, agent.y, radius).fill({ color: edge, alpha: 0.055 * agent.intensity });
    this.coreAuraGraphics.circle(agent.x, agent.y, radius * 0.42).fill({ color, alpha: 0.11 * agent.intensity });
    this.coreAuraGraphics.circle(agent.x, agent.y, agent.radius + 7).stroke({
      color: edge,
      alpha: agent.slowTimer > 0 ? 0.72 : 0.44,
      width: agent.slowTimer > 0 ? 2.4 : 1.4,
    });

    this.drawCoreStatusRing(agent, kind, edge, color);

    if (kind === "player" && state.shieldTimer > 0) {
      const pulse = 1 + Math.sin(state.time * 7) * 0.045;
      this.coreAuraGraphics.circle(agent.x, agent.y, (agent.radius + 18) * pulse).stroke({
        color: colorToHex(palette.playerHot),
        alpha: 0.56,
        width: 3.2,
      });
    }
  }

  private drawCoreStatusRing(agent: Agent, kind: AgentKind, edge: number, hot: number) {
    const healthRatio = clamp(agent.health / Math.max(1, agent.maxHealth), 0, 1);
    const shieldRatio = clamp(agent.shield / Math.max(1, agent.maxShield), 0, 1);
    const baseRadius = agent.radius + 12;
    this.coreAuraGraphics.circle(agent.x, agent.y, baseRadius).stroke({ color: 0xffffff, alpha: 0.32, width: 2.2 });
    this.drawArcRing(this.coreAuraGraphics, agent.x, agent.y, baseRadius, -Math.PI / 2, healthRatio, {
      color: edge,
      alpha: 0.78,
      width: 2.4,
    });

    if (shieldRatio > 0.03) {
      this.drawArcRing(this.coreAuraGraphics, agent.x, agent.y, baseRadius + 5, -Math.PI / 2, shieldRatio, {
        color: hot,
        alpha: kind === "player" ? 0.58 : 0.46,
        width: 2.6,
      });
    }

    if (agent.invulnerableTimer > 0) {
      const pulse = 1 + Math.sin((this.app?.ticker.lastTime ?? 0) * 0.01 + agent.id) * 0.06;
      this.coreAuraGraphics.circle(agent.x, agent.y, (baseRadius + 10) * pulse).stroke({
        color: 0xffffff,
        alpha: 0.48,
        width: 1.5,
      });
    }
  }

  private drawArcRing(
    graphic: Graphics,
    x: number,
    y: number,
    radius: number,
    start: number,
    ratio: number,
    style: { color: number; alpha: number; width: number },
  ) {
    const clamped = clamp(ratio, 0, 1);

    if (clamped <= 0.001) {
      return;
    }

    const end = start + Math.PI * 2 * clamped;
    graphic.moveTo(x + Math.cos(start) * radius, y + Math.sin(start) * radius).arc(x, y, radius, start, end);
    graphic.stroke(style);
  }

  private drawEnemyTargetDebug(state: GameRenderState) {
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.isRespawning) {
        continue;
      }

      this.coreMarkGraphics
        .moveTo(enemy.x, enemy.y)
        .lineTo(enemy.targetX, enemy.targetY)
        .stroke({ color: 0xff8a54, alpha: 0.38, width: 1.1 });
      this.coreMarkGraphics.circle(enemy.targetX, enemy.targetY, 8).stroke({ color: 0xff8a54, alpha: 0.48, width: 1.2 });
    }
  }

  private drawEnemyMark(enemy: Agent, time: number) {
    const radius = enemy.radius;

    if (enemy.type === "tank") {
      this.coreMarkGraphics.circle(enemy.x, enemy.y, radius + 11).stroke({ color: 0xffffff, alpha: 0.76, width: 1.5 });
      return;
    }

    if (enemy.type === "root") {
      for (let index = 0; index < 4; index += 1) {
        const angle = index * (Math.PI / 2) + time * 0.35;
        this.coreMarkGraphics
          .moveTo(enemy.x + Math.cos(angle) * (radius * 0.6), enemy.y + Math.sin(angle) * (radius * 0.6))
          .lineTo(enemy.x + Math.cos(angle) * (radius + 11), enemy.y + Math.sin(angle) * (radius + 11));
      }
      this.coreMarkGraphics.stroke({ color: 0xffffff, alpha: 0.76, width: 1.5 });
      return;
    }

    const satelliteCount = enemy.type === "splitter" ? 2 : enemy.type === "hunter" ? 1 : 3;

    for (let index = 0; index < satelliteCount; index += 1) {
      const angle = time * (enemy.type === "hunter" ? 2.4 : 1.7) + index * ((Math.PI * 2) / satelliteCount);
      this.coreMarkGraphics
        .circle(enemy.x + Math.cos(angle) * (radius + 8), enemy.y + Math.sin(angle) * (radius + 8), 3)
        .fill({ color: 0xffffff, alpha: 0.78 });
    }
  }

  private drawEffects(state: GameRenderState) {
    this.ripples?.sync(state.ripples, (sprite, ripple) => {
      const progress = ripple.age / ripple.duration;
      const radius = ripple.radius * (0.35 + progress);
      const alpha = (1 - progress) * 0.42;
      const color =
        ripple.color === "player" || ripple.color === "shock"
          ? colorToHex(palette.playerHot)
          : ripple.color === "enemy"
            ? colorToHex(palette.infectedHot)
            : colorToHex(palette.neutral);

      sprite.position.set(ripple.x, ripple.y);
      sprite.tint = color;
      sprite.alpha = alpha;
      sprite.scale.set(Math.max(0.04, radius / 110));
    });

    this.pulses?.sync(state.pulses, (sprite, pulse) => {
      const progress = clamp(pulse.age / pulse.duration, 0, 1);
      const alpha = (1 - progress) * (pulse.owner === "player" ? 0.48 : 0.36);
      const color =
        pulse.owner === "player"
          ? colorToHex(palette.playerHot)
          : pulse.owner === "enemy"
            ? colorToHex(palette.infectedHot)
            : colorToHex(palette.neutral);
      const radius = Math.max(2, pulse.currentRadius);

      sprite.position.set(pulse.x, pulse.y);
      sprite.tint = color;
      sprite.alpha = alpha;
      sprite.scale.set(Math.max(0.04, radius / 110));
    });

    this.contestedZones?.sync(state.contestedZones, (graphic, zone) => {
      const progress = zone.age / zone.duration;
      const alpha = (1 - progress) * 0.14;
      const radius = zone.radius * (0.55 + progress * 0.5);

      graphic.clear();
      graphic.circle(zone.x, zone.y, radius).fill({ color: 0x626f81, alpha });
    });

    this.particles?.sync(state.particles, (sprite, particle) => {
      const progress = particle.age / particle.duration;
      const alpha = 1 - progress;
      const color = particle.kind === "player" ? colorToHex(palette.playerHot) : colorToHex(palette.infectedHot);
      sprite.position.set(particle.x, particle.y);
      sprite.tint = color;
      sprite.alpha = alpha * 0.78;
      sprite.scale.set((0.12 + alpha * 0.18) * particle.size);
    });
  }

  private resetHazeTexture() {
    this.hazeCountdown = 0;
    this.pulseHazeBoostFrames = 0;
    this.lastHazeRebuildMs = 0;
    this.hazeEvery = HAZE_FRAME_INTERVAL;
    this.hazeTexture?.destroy(true);
    this.hazeTexture = null;
    this.hazeSprite = null;
    this.hazeCanvas = null;
    this.hazeContext = null;
  }

  private ensureHaze(state: GameRenderState) {
    if (!this.layers) {
      return null;
    }

    const width = Math.max(1, Math.ceil(state.width * HAZE_SCALE));
    const height = Math.max(1, Math.ceil(state.height * HAZE_SCALE));

    if (!this.hazeCanvas || this.hazeCanvas.width !== width || this.hazeCanvas.height !== height) {
      this.hazeTexture?.destroy(true);
      this.hazeCanvas = document.createElement("canvas");
      this.hazeCanvas.width = width;
      this.hazeCanvas.height = height;
      this.hazeContext = this.hazeCanvas.getContext("2d");
      this.hazeTexture = Texture.from(this.hazeCanvas);
      this.hazeSprite = new Sprite(this.hazeTexture);
      this.hazeSprite.alpha = 1;
      this.layers.hazeLayer.removeChildren();
      this.layers.hazeLayer.addChild(this.hazeSprite);
      this.hazeCountdown = 0;
    }

    return this.hazeContext;
  }

  private drawHaze(state: GameRenderState) {
    const ctx = this.ensureHaze(state);

    if (!ctx || !this.hazeCanvas || !this.hazeTexture || !this.hazeSprite) {
      return;
    }

    if (state.pulses.length > 0) {
      this.pulseHazeBoostFrames = Math.max(this.pulseHazeBoostFrames, 24);
    } else {
      this.pulseHazeBoostFrames = Math.max(0, this.pulseHazeBoostFrames - 1);
    }

    this.hazeEvery = this.pulseHazeBoostFrames > 0 ? 2 : HAZE_FRAME_INTERVAL;

    if (this.hazeCountdown <= 0) {
      const rebuildStarted = typeof performance !== "undefined" ? performance.now() : 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.hazeCanvas.width, this.hazeCanvas.height);
      ctx.setTransform(HAZE_SCALE, 0, 0, HAZE_SCALE, 0, 0);

      for (const dot of state.dots) {
        if (dot.infectionAmount > 0.08) {
          this.drawCanvasGlow(ctx, dot.x, dot.y, 18 + dot.infectionAmount * 46, palette.infectedHot, palette.infected, dot.infectionAmount);
        }

        if (dot.playerAmount > 0.08) {
          this.drawCanvasGlow(ctx, dot.x, dot.y, 18 + dot.playerAmount * 48, palette.playerHot, palette.player, dot.playerAmount);
        }

        const frontline = state.frontline[dot.id] ?? 0;

        if (frontline > 0.12) {
          const radius = 14 + frontline * 28;
          const flicker = 0.72 + Math.sin(state.time * 8 + dot.id) * 0.18;
          const haze = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
          haze.addColorStop(0, `rgba(126, 106, 158, ${frontline * 0.16 * flicker})`);
          haze.addColorStop(1, "rgba(126, 106, 158, 0)");
          ctx.fillStyle = haze;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      this.hazeTexture.source.update();
      this.lastHazeRebuildMs = rebuildStarted > 0 ? performance.now() - rebuildStarted : 0;
      this.hazeCountdown = this.hazeEvery;
    } else {
      this.hazeCountdown -= 1;
    }

    this.hazeSprite.width = state.width;
    this.hazeSprite.height = state.height;
  }

  private drawCanvasGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hot: Rgb,
    edge: Rgb,
    amount: number,
  ) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, rgba(hot, amount * 0.145));
    glow.addColorStop(0.64, rgba(edge, amount * 0.06));
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
