import { Application, Graphics, Sprite, Text, Texture } from "pixi.js";
import {
  FOG_EXPLORED_OPACITY,
  FOG_SCALE,
  FOG_UNEXPLORED_OPACITY,
  HAZE_FRAME_INTERVAL,
  HAZE_SCALE,
  CHUNK_SIZE,
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

type DotSpriteVisualState = {
  alpha: number;
  chunkKey: string;
  scale: number;
  textureKey: DotTextureKey;
  visible: boolean;
  x: number;
  y: number;
};

type DotSyncMetrics = Pick<
  PixiRenderMetrics,
  | "visibleDotCount"
  | "hiddenDotCount"
  | "activeDotSpriteCount"
  | "syncedDotSprites"
  | "dirtyDotCount"
  | "visibleChunkCount"
  | "dirtyChunkCount"
  | "foggedChunkCount"
  | "syncDotsMs"
>;

type CoreBarVisualState = {
  health: number;
  shield: number;
};

type HealTextState = {
  age: number;
  amount: number;
  duration: number;
  text: Text;
  x: number;
  y: number;
};

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
  private coreHealthBarGraphics = new Graphics({ label: "coreHealthBarGraphics" });
  private destinationGraphics = new Graphics({ label: "destinationGraphics" });
  private frontlineGraphics = new Graphics({ label: "frontlineGraphics" });
  private dotSprites = new Map<number, Sprite>();
  private dotSpriteState = new Map<number, DotSpriteVisualState>();
  private activeDotSpriteCount = 0;
  private coreSprites = new Map<number, Sprite>();
  private coreBarState = new Map<number, CoreBarVisualState>();
  private healTextPool: Text[] = [];
  private activeHealTexts: HealTextState[] = [];
  private lastPlayerHealthForFloat = 0;
  private pendingPlayerHealFloat = 0;
  private lastHealFloatAt = -999;
  private ripples: SpritePool | null = null;
  private pulses: SpritePool | null = null;
  private contestedZones: GraphicsPool | null = null;
  private particles: SpritePool | null = null;
  private hazeCanvas: HTMLCanvasElement | null = null;
  private hazeTexture: Texture | null = null;
  private hazeSprite: Sprite | null = null;
  private hazeContext: CanvasRenderingContext2D | null = null;
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogTexture: Texture | null = null;
  private fogSprite: Sprite | null = null;
  private fogContext: CanvasRenderingContext2D | null = null;
  private lastFogRevision = -1;
  private hazeCountdown = 0;
  private pulseHazeBoostFrames = 0;
  private lastHazeRebuildMs = 0;
  private hazeTextureUpdates = 0;
  private fogTextureUpdates = 0;
  private hazeEvery = HAZE_FRAME_INTERVAL;
  private lastRevision = -1;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private lastDotSyncMetrics: DotSyncMetrics = {
    visibleDotCount: 0,
    hiddenDotCount: 0,
    activeDotSpriteCount: 0,
    syncedDotSprites: 0,
    dirtyDotCount: 0,
    visibleChunkCount: 0,
    dirtyChunkCount: 0,
    foggedChunkCount: 0,
    syncDotsMs: 0,
  };
  private lastSyncHealthBarsMs = 0;
  private lastSyncFogHazeMs = 0;

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
    this.layers.coreLayer.addChild(this.coreAuraGraphics, this.coreMarkGraphics, this.coreHealthBarGraphics);
    this.layers.debugLayer.sortableChildren = false;
    this.ripples = new SpritePool(this.layers.effectLayer, this.textures.ring);
    this.pulses = new SpritePool(this.layers.effectLayer, this.textures.ring);
    this.contestedZones = new GraphicsPool(this.layers.effectLayer);
    this.particles = new SpritePool(this.layers.effectLayer, this.textures.particle);
    this.createHealTextPool();
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
    this.resetFogTexture();
  }

  sync(state: GameRenderState): PixiRenderMetrics {
    if (!this.layers || !this.textures || !this.app) {
      return this.emptyMetrics();
    }

    const syncStarted = typeof performance !== "undefined" ? performance.now() : 0;

    if (state.revision !== this.lastRevision) {
      this.rebuildDots();
      this.lastRevision = state.revision;
      this.resetHazeTexture();
      this.resetFogTexture();
    }

    this.lastSyncFogHazeMs = 0;
    this.lastSyncHealthBarsMs = 0;
    this.hazeTextureUpdates = 0;
    this.fogTextureUpdates = 0;

    this.drawBackground(state);
    this.drawArenaMask(state.arena);
    this.disableFogLayers();
    this.drawBases(state);
    this.lastDotSyncMetrics = this.syncDots(state);
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
      visibleDotCount: this.lastDotSyncMetrics.visibleDotCount,
      hiddenDotCount: this.lastDotSyncMetrics.hiddenDotCount,
      activeDotSpriteCount: this.lastDotSyncMetrics.activeDotSpriteCount,
      syncedDotSprites: this.lastDotSyncMetrics.syncedDotSprites,
      dirtyDotCount: this.lastDotSyncMetrics.dirtyDotCount,
      visibleChunkCount: this.lastDotSyncMetrics.visibleChunkCount,
      dirtyChunkCount: this.lastDotSyncMetrics.dirtyChunkCount,
      foggedChunkCount: this.lastDotSyncMetrics.foggedChunkCount,
      hazeTextureUpdates: this.hazeTextureUpdates,
      fogTextureUpdates: this.fogTextureUpdates,
      renderStateBuildMs: state.debugVisible ? 0 : 0,
      renderStateAllocationCount: 0,
      syncDotsMs: this.lastDotSyncMetrics.syncDotsMs,
      syncHealthBarsMs: this.lastSyncHealthBarsMs,
      syncFogHazeMs: this.lastSyncFogHazeMs,
      fogVisualsEnabled: state.fogVisualsEnabled,
    };
  }

  destroy() {
    this.ripples?.destroy();
    this.pulses?.destroy();
    this.contestedZones?.destroy();
    this.particles?.destroy();
    this.dotSprites.clear();
    this.dotSpriteState.clear();
    this.activeDotSpriteCount = 0;
    this.coreSprites.clear();
    this.coreBarState.clear();
    this.healTextPool = [];
    this.activeHealTexts = [];

    if (this.textures) {
      destroyPixiTextures(this.textures);
      this.textures = null;
    }

    this.hazeTexture?.destroy(true);
    this.hazeTexture = null;
    this.hazeSprite = null;
    this.hazeCanvas = null;
    this.hazeContext = null;
    this.fogTexture?.destroy(true);
    this.fogTexture = null;
    this.fogSprite = null;
    this.fogCanvas = null;
    this.fogContext = null;
    this.lastFogRevision = -1;

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
      visibleDotCount: 0,
      hiddenDotCount: 0,
      activeDotSpriteCount: 0,
      syncedDotSprites: 0,
      dirtyDotCount: 0,
      visibleChunkCount: 0,
      dirtyChunkCount: 0,
      foggedChunkCount: 0,
      hazeTextureUpdates: 0,
      fogTextureUpdates: 0,
      renderStateBuildMs: 0,
      renderStateAllocationCount: 0,
      syncDotsMs: 0,
      syncHealthBarsMs: 0,
      syncFogHazeMs: 0,
      fogVisualsEnabled: false,
    };
  }

  private rebuildDots() {
    if (!this.layers || !this.textures) {
      return;
    }

    this.layers.dotLayer.removeChildren();
    this.dotSprites.clear();
    this.dotSpriteState.clear();
    this.activeDotSpriteCount = 0;
  }

  private createHealTextPool() {
    if (!this.layers) {
      return;
    }

    this.healTextPool = [];
    this.activeHealTexts = [];

    for (let index = 0; index < 8; index += 1) {
      const text = new Text({
        text: "",
        style: {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: 13,
          fontWeight: "700",
          fill: 0x4ade80,
          stroke: { color: 0x06101a, width: 3 },
        },
      });
      text.anchor.set(0.5);
      text.visible = false;
      this.layers.coreLayer.addChild(text);
      this.healTextPool.push(text);
    }
  }

  private spawnHealText(x: number, y: number, amount: number) {
    const text = this.healTextPool.find((candidate) => !candidate.visible);

    if (!text) {
      return;
    }

    text.text = `+${Math.max(1, Math.round(amount))}`;
    text.position.set(x, y);
    text.alpha = 1;
    text.scale.set(1);
    text.visible = true;
    this.activeHealTexts.push({
      age: 0,
      amount,
      duration: 0.9,
      text,
      x,
      y,
    });
  }

  private updateHealTexts(dt: number) {
    for (let index = this.activeHealTexts.length - 1; index >= 0; index -= 1) {
      const floating = this.activeHealTexts[index];
      floating.age += dt;
      const progress = clamp(floating.age / floating.duration, 0, 1);

      floating.text.position.set(floating.x, floating.y - progress * 22);
      floating.text.alpha = 1 - progress;
      floating.text.scale.set(1 + progress * 0.12);

      if (progress >= 1) {
        floating.text.visible = false;
        this.activeHealTexts.splice(index, 1);
      }
    }
  }

  private trackPlayerHealing(player: Agent, time: number) {
    if (this.lastPlayerHealthForFloat <= 0) {
      this.lastPlayerHealthForFloat = player.health;
      return;
    }

    const gained = player.health - this.lastPlayerHealthForFloat;
    this.lastPlayerHealthForFloat = player.health;

    if (gained <= 0.001 || player.healthRegenPerSec <= 0) {
      return;
    }

    this.pendingPlayerHealFloat += gained;

    if (time - this.lastHealFloatAt < 0.82) {
      return;
    }

    const amount = Math.max(this.pendingPlayerHealFloat, Math.min(player.healthRegenPerSec, player.maxHealth - player.health + this.pendingPlayerHealFloat));
    this.spawnHealText(player.x, player.y - player.bodyRadius - 38, amount);
    this.pendingPlayerHealFloat = 0;
    this.lastHealFloatAt = time;
  }

  private drawBackground(state: GameRenderState) {
    const arena = state.arena;
    this.backgroundGraphics.clear();
    this.backgroundGraphics.rect(0, 0, state.width, state.height).fill({ color: 0x0b1624 });
    this.backgroundGraphics
      .rect(0, 0, state.width, state.height)
      .fill({ color: 0x172539, alpha: 0.66 });
    drawArenaPath(this.backgroundGraphics, arena);
    this.backgroundGraphics.fill({ color: 0xeef3f7, alpha: 0.92 });

    this.arenaFrameGraphics.clear();
    drawArenaPath(this.arenaFrameGraphics, arena);
    this.arenaFrameGraphics.stroke({ color: 0xffffff, alpha: 0.08, width: 1 });
    drawArenaPath(this.arenaFrameGraphics, arena);
    this.arenaFrameGraphics.stroke({ color: 0x86a9c7, alpha: 0.12, width: 1 });
  }

  private drawArenaMask(arena: Arena) {
    if (!this.layers) {
      return;
    }

    this.layers.arenaMask.clear();
    drawArenaPath(this.layers.arenaMask, arena);
    this.layers.arenaMask.fill({ color: 0xffffff });
  }

  private syncDots(state: GameRenderState): DotSyncMetrics {
    const started = typeof performance !== "undefined" ? performance.now() : 0;
    const hadActiveSprites = this.activeDotSpriteCount > 0;

    if (hadActiveSprites) {
      if (this.layers) {
        this.layers.dotLayer.removeChildren();
      }

      for (const sprite of this.dotSprites.values()) {
        sprite.visible = false;
      }

      this.dotSpriteState.clear();
    }

    this.activeDotSpriteCount = 0;

    return {
      visibleDotCount: 0,
      hiddenDotCount: state.dots.length,
      activeDotSpriteCount: this.activeDotSpriteCount,
      syncedDotSprites: hadActiveSprites ? state.dots.length : 0,
      dirtyDotCount: 0,
      visibleChunkCount: 0,
      dirtyChunkCount: 0,
      foggedChunkCount: Math.ceil(state.width / CHUNK_SIZE) * Math.ceil(state.height / CHUNK_SIZE),
      syncDotsMs: started > 0 ? performance.now() - started : 0,
    };
  }

  private drawModifiers(state: GameRenderState) {
    this.modifierGraphics.clear();
    this.destinationGraphics.clear();
    this.drawViscosityZones(state);
    this.drawEnergyWells(state);
    this.drawBlockers(state);
    this.drawDestination(state);
    this.drawFrontlines();
  }

  private drawBases(state: GameRenderState) {
    this.baseGraphics.clear();

    for (const base of state.bases) {
      const isPlayer = base.team === "player";
      const color = isPlayer ? colorToHex(palette.playerHot) : colorToHex(palette.infectedHot);
      const edge = isPlayer ? colorToHex(palette.player) : colorToHex(palette.infected);
      const pulse = pulseScale(state.time, base.pulse, 0.08, 2);
      const radius = base.radius * pulse;
      const recoveryRadius = base.radius + (isPlayer ? 92 : 84);
      this.baseGraphics.circle(base.x, base.y, recoveryRadius).fill({
        color: edge,
        alpha: isPlayer ? 0.09 : 0.075,
      });
      this.baseGraphics.circle(base.x, base.y, recoveryRadius).stroke({
        color,
        alpha: isPlayer ? 0.24 : 0.2,
        width: 1.4,
      });
      this.baseGraphics.circle(base.x, base.y, radius * 1.28).fill({ color: edge, alpha: isPlayer ? 0.07 : 0.06 });
      this.baseGraphics.circle(base.x, base.y, radius * 0.78).fill({ color, alpha: isPlayer ? 0.11 : 0.1 });
      this.baseGraphics.circle(base.x, base.y, radius).stroke({ color, alpha: 0.34, width: 1.6 });

      if (base.captureBy && base.captureProgress > 0.001) {
        const captureColor = ownerColor(base.captureBy);
        const arcRadius = radius + 10;
        const start = -Math.PI / 2;
        const end = start + Math.PI * 2 * base.captureProgress;
        this.baseGraphics.circle(base.x, base.y, arcRadius + 4).stroke({ color: 0xffffff, alpha: 0.22, width: 5 });
        this.baseGraphics
          .moveTo(base.x + Math.cos(start) * arcRadius, base.y + Math.sin(start) * arcRadius)
          .arc(base.x, base.y, arcRadius, start, end);
        this.baseGraphics.stroke({ color: captureColor, alpha: 0.92, width: 4 });
      }
    }
  }

  private drawViscosityZones(state: GameRenderState) {
    for (const zone of state.viscosityZones) {
      if (!this.isAreaExplored(state, zone.x, zone.y, zone.radius)) {
        continue;
      }

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
      if (!this.isAreaExplored(state, well.x, well.y, well.radius + 42)) {
        continue;
      }

      const radius = well.radius * pulseScale(state.time, well.phase, 0.08, 2.2);
      this.modifierGraphics.circle(well.x, well.y, radius * 1.75).fill({ color: 0x52dbe8, alpha: 0.09 });
      this.modifierGraphics.circle(well.x, well.y, radius).stroke({ color: 0x1eaee9, alpha: 0.38, width: 1.6 });
      this.modifierGraphics.circle(well.x, well.y, Math.max(3, radius * 0.14)).fill({ color: 0x56dbe8, alpha: 0.5 });
    }
  }

  private drawBlockers(state: GameRenderState) {
    for (const blocker of state.blockers) {
      if (!this.isAreaExplored(state, blocker.x, blocker.y, blocker.radius + 42)) {
        continue;
      }

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

  private drawFrontlines() {
    this.frontlineGraphics.clear();
  }

  private drawNodes(state: GameRenderState) {
    this.nodeGraphics.clear();

    for (const node of state.nodes) {
      if (!this.isAreaExplored(state, node.x, node.y, node.radius + 54)) {
        continue;
      }

      const color = ownerColor(node.owner);
      const radius = node.radius * pulseScale(state.time, node.id, 0.08, 2.4);
      const alpha = node.owner === "neutral" ? 0.42 : 0.88;

      this.nodeGraphics.circle(node.x, node.y, radius + 32).fill({ color, alpha: node.owner === "neutral" ? 0.035 : 0.08 });
      this.nodeGraphics.circle(node.x, node.y, radius).fill({ color, alpha });
      this.nodeGraphics.circle(node.x, node.y, radius + 7).stroke({ color: 0xffffff, alpha: 0.78, width: 2.2 });
      this.nodeGraphics.circle(node.x, node.y, radius + 32).stroke({ color, alpha: node.owner === "neutral" ? 0.14 : 0.28, width: 1.4 });

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
    this.coreHealthBarGraphics.clear();
    this.syncCoreSprite(state.player, "player");

    for (const enemy of state.enemies) {
      this.syncCoreSprite(enemy, "enemy", this.shouldShowEnemyCore(enemy, state));
    }

    for (const [id, sprite] of this.coreSprites) {
      const stillVisible = id === 0 || state.enemies.some((enemy) => enemy.id === id);

      if (!stillVisible) {
        sprite.visible = false;
      }
    }

    for (const enemy of state.enemies) {
      if (!this.shouldShowEnemyCore(enemy, state)) {
        continue;
      }

      this.drawSoftField(enemy, "enemy", state);
      this.drawEnemyMark(enemy, state);
    }

    this.drawSoftField(state.player, "player", state);
    const barsStarted = typeof performance !== "undefined" ? performance.now() : 0;
    this.drawCoreHealthBars(state);
    this.lastSyncHealthBarsMs = barsStarted > 0 ? performance.now() - barsStarted : 0;

    if (state.debugVisible) {
      this.drawEnemyTargetDebug(state);
    }
  }

  private syncCoreSprite(agent: Agent, kind: AgentKind, visible = true) {
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
    const hitPulse = agent.hitFlashTimer > 0 ? 1 + agent.hitFlashTimer * 0.18 : 1;
    const size = agent.bodyRadius * 4.1 * pulse * hitPulse;
    sprite.texture = kind === "player" ? this.textures.cores.player : this.textures.cores.enemy;
    sprite.position.set(agent.x, agent.y);
    sprite.width = size;
    sprite.height = size;
    sprite.alpha = agent.isRespawning
      ? 0
      : clamp(0.68 + (agent.health / Math.max(1, agent.maxHealth)) * 0.32 + agent.hitFlashTimer * 0.22, 0.3, 1);
    sprite.tint = agent.hitFlashTimer > 0 ? 0xffffff : 0xffffff;
    sprite.visible = visible && !agent.isRespawning && agent.active;
  }

  private shouldShowEnemyCore(enemy: Agent, state: GameRenderState) {
    if (!enemy.active || enemy.isRespawning) {
      return false;
    }

    const playerDistance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);

    return (
      playerDistance < state.player.visionRadius + enemy.visionRadius * 0.45 ||
      enemy.hitFlashTimer > 0.01 ||
      enemy.shieldFlashTimer > 0.01 ||
      enemy.isInCombat ||
      enemy.combatState !== "idle" ||
      enemy.selectedTarget.includes("player")
    );
  }

  private drawCoreHealthBars(state: GameRenderState) {
    const dt = clamp((this.app?.ticker.deltaMS ?? 16.7) / 1000, 0, 0.05);
    this.trackPlayerHealing(state.player, state.time);
    this.drawCoreHealthBar(state.player, true);

    for (const enemy of state.enemies) {
      const playerDistance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
      const show =
        this.shouldShowEnemyCore(enemy, state) ||
        enemy.hitFlashTimer > 0.01 ||
        enemy.shieldFlashTimer > 0.01 ||
        enemy.isInCombat ||
        playerDistance < state.player.combatRadius + enemy.combatRadius + 84;

      if (show) {
        this.drawCoreHealthBar(enemy, false);
      }
    }

    this.updateHealTexts(dt);
  }

  private drawCoreHealthBar(agent: Agent, alwaysVisible: boolean) {
    if (agent.isRespawning || !agent.active) {
      return;
    }

    const targetHealth = clamp(agent.health / Math.max(1, agent.maxHealth), 0, 1);
    const targetShield = clamp(agent.shield / Math.max(1, agent.maxShield), 0, 1);
    const previous = this.coreBarState.get(agent.id) ?? { health: targetHealth, shield: targetShield };
    const health = previous.health + (targetHealth - previous.health) * 0.18;
    const shield = previous.shield + (targetShield - previous.shield) * 0.2;
    this.coreBarState.set(agent.id, { health, shield });

    const width = clamp(agent.bodyRadius * 3.6, 48, 72);
    const x = agent.x - width / 2;
    const y = agent.y - agent.bodyRadius - (alwaysVisible ? 28 : 24);
    const healthColor = health > 0.6 ? 0x4ade80 : health > 0.3 ? 0xfbbf24 : 0xff5f5f;
    const shieldAlpha = shield > 0.03 ? 0.86 + agent.shieldFlashTimer * 0.12 : 0.24;

    this.coreHealthBarGraphics.roundRect(x - 3, y - 4, width + 6, 13, 5).fill({
      color: 0x050914,
      alpha: alwaysVisible ? 0.62 : 0.52,
    });
    this.coreHealthBarGraphics.roundRect(x, y, width, 4, 2).fill({ color: 0x172033, alpha: 0.84 });
    this.coreHealthBarGraphics.roundRect(x, y, Math.max(1, width * health), 4, 2).fill({
      color: healthColor,
      alpha: 0.98,
    });
    this.coreHealthBarGraphics.roundRect(x, y + 6, width, 3, 1.5).fill({ color: 0x1e293b, alpha: 0.78 });
    this.coreHealthBarGraphics.roundRect(x, y + 6, Math.max(1, width * shield), 3, 1.5).fill({
      color: 0xe9ddff,
      alpha: shieldAlpha,
    });
  }

  private drawSoftField(agent: Agent, kind: AgentKind, state: GameRenderState) {
    if (agent.isRespawning || !agent.active) {
      return;
    }

    const color = kind === "player" ? colorToHex(palette.playerHot) : colorToHex(palette.infectedHot);
    const edge = kind === "player" ? colorToHex(palette.player) : colorToHex(palette.infected);
    const influenceRadius = agent.influenceRadius;
    const combatAlpha =
      agent.combatState === "clash"
        ? 0.42
        : agent.combatState === "overpower"
          ? 0.52
          : agent.combatState === "break"
            ? 0.28
            : agent.combatState === "contact"
              ? 0.3
              : 0.22;
    const combatWidth =
      agent.combatState === "overpower" ? 3 : agent.combatState === "clash" ? 2.5 : agent.combatState === "contact" ? 2.1 : 1.8;

    this.coreAuraGraphics.circle(agent.x, agent.y, influenceRadius).fill({ color: edge, alpha: 0.026 * agent.intensity });
    this.coreAuraGraphics.circle(agent.x, agent.y, influenceRadius).stroke({ color: edge, alpha: 0.11 * agent.intensity, width: 1 });
    this.coreAuraGraphics.circle(agent.x, agent.y, influenceRadius * 0.48).fill({ color, alpha: 0.045 * agent.intensity });
    this.coreAuraGraphics.circle(agent.x, agent.y, agent.combatRadius).stroke({
      color: edge,
      alpha: combatAlpha,
      width: combatWidth,
    });
    this.coreAuraGraphics.circle(agent.x, agent.y, agent.combatRadius + 2).stroke({
      color: 0xffffff,
      alpha: agent.combatState === "idle" ? 0.08 : 0.18,
      width: 0.8,
    });
    this.coreAuraGraphics.circle(agent.x, agent.y, agent.bodyRadius + 7).stroke({
      color: edge,
      alpha: agent.slowTimer > 0 ? 0.72 : 0.44,
      width: agent.slowTimer > 0 ? 2.4 : 1.4,
    });

    this.drawCoreStatusRing(agent, kind, edge, color);

    if ((kind === "player" && state.shieldTimer > 0) || agent.shieldFlashTimer > 0.01) {
      const pulse = 1 + Math.sin(state.time * 7) * 0.045 + agent.shieldFlashTimer * 0.08;
      this.coreAuraGraphics.circle(agent.x, agent.y, (agent.combatRadius + 8) * pulse).stroke({
        color: colorToHex(palette.playerHot),
        alpha: kind === "player" && state.shieldTimer > 0 ? 0.56 + agent.shieldFlashTimer * 0.18 : 0.3 + agent.shieldFlashTimer * 0.35,
        width: kind === "player" && state.shieldTimer > 0 ? 3.2 : 2.4,
      });
    }

    if (agent.hitFlashTimer > 0.01) {
      this.coreAuraGraphics.circle(agent.x, agent.y, agent.bodyRadius + 5 + agent.hitFlashTimer * 5).fill({
        color: 0xffffff,
        alpha: agent.hitFlashTimer * 0.22,
      });
    }
  }

  private drawCoreStatusRing(agent: Agent, kind: AgentKind, edge: number, hot: number) {
    const healthRatio = clamp(agent.health / Math.max(1, agent.maxHealth), 0, 1);
    const shieldRatio = clamp(agent.shield / Math.max(1, agent.maxShield), 0, 1);
    const healthPulse = agent.healthPulseTimer > 0 ? Math.sin(agent.healthPulseTimer * 24) * 2.2 : 0;
    const baseRadius = agent.bodyRadius + 12 - Math.max(0, healthPulse);
    this.coreAuraGraphics.circle(agent.x, agent.y, baseRadius).stroke({ color: 0xffffff, alpha: 0.32 + agent.hitFlashTimer * 0.12, width: 2.2 });
    this.drawArcRing(this.coreAuraGraphics, agent.x, agent.y, baseRadius, -Math.PI / 2, healthRatio, {
      color: edge,
      alpha: 0.78 + agent.hitFlashTimer * 0.14,
      width: 2.4 + agent.healthPulseTimer * 0.8,
    });

    if (shieldRatio > 0.03) {
      this.drawArcRing(this.coreAuraGraphics, agent.x, agent.y, baseRadius + 5, -Math.PI / 2, shieldRatio, {
        color: hot,
        alpha: (kind === "player" ? 0.58 : 0.46) + agent.shieldFlashTimer * 0.22,
        width: 2.6 + agent.shieldFlashTimer * 1.1,
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

  private drawEnemyMark(enemy: Agent, state: GameRenderState) {
    const time = state.time;
    const radius = enemy.bodyRadius;
    const enemyColor = colorToHex(palette.infectedHot);

    if (enemy.type === "spreader") {
      const pulse = pulseScale(time, enemy.id, 0.07, 2.6);
      this.coreMarkGraphics.circle(enemy.x, enemy.y, enemy.influenceRadius * 1.18 * pulse).stroke({
        color: enemyColor,
        alpha: 0.12,
        width: 2,
      });
    }

    if ((enemy.canPulse || enemy.type === "root") && enemy.pulseTimer < 1.25) {
      const warning = clamp(1 - enemy.pulseTimer / 1.25, 0, 1);
      this.coreMarkGraphics.circle(enemy.x, enemy.y, enemy.influenceRadius * (1.1 + warning * 0.22)).stroke({
        color: enemyColor,
        alpha: 0.16 + warning * 0.32,
        width: 1.4 + warning * 1.2,
      });
    }

    if (enemy.mode === "attack" && enemy.selectedTarget.includes("player")) {
      this.coreMarkGraphics
        .moveTo(enemy.x, enemy.y)
        .lineTo(enemy.targetX, enemy.targetY)
        .stroke({ color: enemyColor, alpha: enemy.type === "hunter" ? 0.34 : 0.2, width: enemy.type === "hunter" ? 1.4 : 1 });
    }

    if (enemy.mode === "retreat" || enemy.mode === "recover") {
      this.coreMarkGraphics
        .moveTo(enemy.x, enemy.y)
        .lineTo(enemy.baseX, enemy.baseY)
        .stroke({ color: 0xffb06f, alpha: 0.24, width: 1.2 });
    }

    if (enemy.type === "tank") {
      this.coreMarkGraphics.circle(enemy.x, enemy.y, enemy.combatRadius + 5).stroke({ color: 0xffffff, alpha: 0.44, width: 3.2 });
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

  private isAreaExplored(state: GameRenderState, x: number, y: number, radius: number) {
    if (Math.hypot(x - state.player.x, y - state.player.y) < state.player.visionRadius + radius) {
      return true;
    }

    const radiusSq = radius * radius;

    for (let index = 0; index < state.dots.length; index += 1) {
      if ((state.playerFog[index] ?? 0) <= 0.035) {
        continue;
      }

      const dot = state.dots[index];
      const dx = dot.baseX - x;
      const dy = dot.baseY - y;

      if (dx * dx + dy * dy <= radiusSq) {
        return true;
      }
    }

    return false;
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
      const color =
        particle.kind === "player" || particle.kind === "clashPlayer"
          ? colorToHex(palette.playerHot)
          : particle.kind === "enemy" || particle.kind === "clashEnemy"
            ? colorToHex(palette.infectedHot)
            : 0x9b8ac8;
      sprite.position.set(particle.x, particle.y);
      sprite.tint = color;
      sprite.alpha = alpha * (particle.kind === "clashEven" ? 0.62 : 0.82);
      sprite.scale.set((0.12 + alpha * 0.2) * particle.size);
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

  private resetFogTexture() {
    this.fogTexture?.destroy(true);
    this.fogTexture = null;
    this.fogSprite = null;
    this.fogCanvas = null;
    this.fogContext = null;
    this.lastFogRevision = -1;
  }

  private disableFogLayers() {
    if (this.hazeSprite) {
      this.hazeSprite.visible = false;
    }

    if (this.fogSprite) {
      this.fogSprite.visible = false;
    }
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

  private ensureFog(state: GameRenderState) {
    if (!this.layers) {
      return null;
    }

    const width = Math.max(1, Math.ceil(state.width * FOG_SCALE));
    const height = Math.max(1, Math.ceil(state.height * FOG_SCALE));

    if (!this.fogCanvas || this.fogCanvas.width !== width || this.fogCanvas.height !== height) {
      this.fogTexture?.destroy(true);
      this.fogCanvas = document.createElement("canvas");
      this.fogCanvas.width = width;
      this.fogCanvas.height = height;
      this.fogContext = this.fogCanvas.getContext("2d");
      this.fogTexture = Texture.from(this.fogCanvas);
      this.fogSprite = new Sprite(this.fogTexture);
      this.fogSprite.alpha = 1;
      this.layers.debugLayer.removeChildren();
      this.layers.debugLayer.addChild(this.fogSprite);
      this.lastFogRevision = -1;
    }

    if (this.fogSprite) {
      this.fogSprite.width = state.width;
      this.fogSprite.height = state.height;
    }

    return this.fogContext;
  }

  private drawHaze(state: GameRenderState) {
    if (!state.fogVisualsEnabled) {
      if (this.hazeSprite) {
        this.hazeSprite.visible = false;
      }
      return;
    }

    const ctx = this.ensureHaze(state);

    if (!ctx || !this.hazeCanvas || !this.hazeTexture || !this.hazeSprite) {
      return;
    }

    this.hazeSprite.visible = true;

    if (state.pulses.length > 0) {
      this.pulseHazeBoostFrames = Math.max(this.pulseHazeBoostFrames, 24);
    } else {
      this.pulseHazeBoostFrames = Math.max(0, this.pulseHazeBoostFrames - 1);
    }

    this.hazeEvery = this.pulseHazeBoostFrames > 0 ? 2 : Math.max(8, HAZE_FRAME_INTERVAL);

    if (this.hazeCountdown <= 0) {
      const rebuildStarted = typeof performance !== "undefined" ? performance.now() : 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.hazeCanvas.width, this.hazeCanvas.height);
      ctx.setTransform(HAZE_SCALE, 0, 0, HAZE_SCALE, 0, 0);

      for (const base of state.bases) {
        const isPlayer = base.team === "player";
        this.drawCanvasGlow(
          ctx,
          base.x,
          base.y,
          base.radius + (isPlayer ? 210 : 230),
          isPlayer ? palette.playerHot : palette.infectedHot,
          isPlayer ? palette.player : palette.infected,
          isPlayer ? 0.72 : 0.78,
        );
      }

      for (const node of state.nodes) {
        if (node.owner === "neutral") {
          continue;
        }

        const isPlayer = node.owner === "player";
        this.drawCanvasGlow(
          ctx,
          node.x,
          node.y,
          132,
          isPlayer ? palette.playerHot : palette.infectedHot,
          isPlayer ? palette.player : palette.infected,
          0.48,
        );
      }

      this.drawCanvasGlow(ctx, state.player.x, state.player.y, state.player.influenceRadius * 1.9, palette.playerHot, palette.player, 0.56);

      for (const enemy of state.enemies) {
        this.drawCanvasGlow(ctx, enemy.x, enemy.y, enemy.influenceRadius * 1.9, palette.infectedHot, palette.infected, 0.56);
      }

      this.hazeTexture.source.update();
      this.hazeTextureUpdates += 1;
      this.lastHazeRebuildMs = rebuildStarted > 0 ? performance.now() - rebuildStarted : 0;
      this.hazeCountdown = this.hazeEvery;
    } else {
      this.hazeCountdown -= 1;
    }

    this.hazeSprite.width = state.width;
    this.hazeSprite.height = state.height;
  }

  private drawFog(state: GameRenderState) {
    if (!state.fogVisualsEnabled) {
      if (this.fogSprite) {
        this.fogSprite.visible = false;
      }
      return;
    }

    const ctx = this.ensureFog(state);

    if (!ctx || !this.fogCanvas || !this.fogTexture || !this.fogSprite) {
      return;
    }

    this.fogSprite.visible = true;

    if (this.lastFogRevision === state.fogRevision) {
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
    ctx.fillStyle = `rgba(15, 23, 42, ${FOG_UNEXPLORED_OPACITY})`;
    ctx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
    ctx.setTransform(FOG_SCALE, 0, 0, FOG_SCALE, 0, 0);
    ctx.globalCompositeOperation = "destination-out";

    const exploredClearRatio = clamp(1 - FOG_EXPLORED_OPACITY / Math.max(0.001, FOG_UNEXPLORED_OPACITY), 0, 1);

    for (const dot of state.dots) {
      const explored = state.playerFog[dot.id] ?? 0;
      if (explored <= 0.025) {
        continue;
      }

      const exploredRadius = 28 + explored * 46;
      const exploredClear = ctx.createRadialGradient(dot.baseX, dot.baseY, 0, dot.baseX, dot.baseY, exploredRadius);
      exploredClear.addColorStop(0, `rgba(255, 255, 255, ${exploredClearRatio * explored})`);
      exploredClear.addColorStop(0.72, `rgba(255, 255, 255, ${exploredClearRatio * explored * 0.48})`);
      exploredClear.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = exploredClear;
      ctx.beginPath();
      ctx.arc(dot.baseX, dot.baseY, exploredRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const dot of state.dots) {
      const visible = state.playerVisibility[dot.id] ?? 0;

      if (visible <= 0.025) {
        continue;
      }

      const visibleRadius = 34 + visible * 64;
      const clear = ctx.createRadialGradient(dot.baseX, dot.baseY, 0, dot.baseX, dot.baseY, visibleRadius);
      clear.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, 0.92 + visible * 0.08)})`);
      clear.addColorStop(0.65, `rgba(255, 255, 255, ${0.52 + visible * 0.18})`);
      clear.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = clear;
      ctx.beginPath();
      ctx.arc(dot.baseX, dot.baseY, visibleRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";

    this.fogTexture.source.update();
    this.fogTextureUpdates += 1;
    this.lastFogRevision = state.fogRevision;
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
