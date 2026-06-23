import { Dot, type DotState, type PointerField } from "./Dot";
import { palette, rgba } from "./colors";
import { clamp, distance, randomInt, randomRange, smoothstep } from "./math";

type GameStatus = "playing" | "won" | "lost";
type AgentKind = "player" | "enemy";
type EnemyMode = "expand" | "contest" | "defend" | "attack";
type EnemyType = "spreader" | "hunter" | "tank" | "splitter" | "root";
type AgentType = "player" | EnemyType;
type NodeOwner = "neutral" | AgentKind;
type RippleColor = AgentKind | "shock" | "collision" | "node";
type PulseKind = "shockwave" | "node" | "enemy";
type BlockerKind = "wall" | "gate";
type SpriteKey = "neutralDot" | "playerDot" | "infectedDot" | "contestedDot" | "playerCore" | "enemyCore";

const MAX_RIPPLES = 60;
const MAX_PARTICLES = 300;
const MAX_PULSES = 20;
const MAX_CONTESTED_ZONES = 18;
const MAX_ENEMIES = 7;
const HAZE_SCALE = 0.33;
const HAZE_FRAME_INTERVAL = 4;

type Agent = {
  id: number;
  kind: AgentKind;
  type: AgentType;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  homeX: number;
  homeY: number;
  radius: number;
  fieldRadius: number;
  speed: number;
  mass: number;
  spreadPower: number;
  intensity: number;
  health: number;
  slowTimer: number;
  pulseTimer: number;
  decisionTimer: number;
  modeTimer: number;
  mode: EnemyMode;
  canMove: boolean;
  canPulse: boolean;
  splitDone: boolean;
  active: boolean;
};

type Arena = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  radius: number;
};

type Ripple = {
  x: number;
  y: number;
  age: number;
  duration: number;
  radius: number;
  color: RippleColor;
};

type ActivePulse = {
  x: number;
  y: number;
  age: number;
  duration: number;
  previousRadius: number;
  maxRadius: number;
  owner: AgentKind;
  power: number;
  kind: PulseKind;
};

type ControlNode = {
  id: number;
  x: number;
  y: number;
  radius: number;
  owner: NodeOwner;
  captureBy: AgentKind | null;
  captureProgress: number;
  pulseTimer: number;
};

type ViscosityZone = {
  x: number;
  y: number;
  radius: number;
  strength: number;
  phase: number;
};

type ArenaBlocker = {
  id: number;
  kind: BlockerKind;
  x: number;
  y: number;
  radius: number;
  openProgress: number;
  phase: number;
};

type EnergyWell = {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

type ContestedZone = {
  x: number;
  y: number;
  age: number;
  duration: number;
  radius: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  duration: number;
  size: number;
  kind: AgentKind;
};

type InfluenceSample = {
  infection: number;
  player: number;
};

type EnemySettings = {
  radius: number;
  fieldRadius: number;
  speed: number;
  mass: number;
  spreadPower: number;
  pulseEvery: [number, number];
  canMove: boolean;
};

type LevelConfig = {
  number: number;
  name: string;
  summary: string;
  infectionSources: number;
  enemyTypes: EnemyType[];
  enemyCanMove: boolean;
  enemyCanPulse: boolean;
  enemyModes: EnemyMode[];
  nodes: [number, number];
  viscosityZones: number;
  blockers: number;
  gates: number;
  energyWells: number;
  dotDensity: number;
  enemySpeedScale: number;
  infectionSpreadScale: number;
};

export type GameStats = {
  totalDots: number;
  infectedCount: number;
  cleansedCount: number;
  neutralCount: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  overtimeSeconds: number;
  infectionLevel: number;
  playerCoverage: number;
  shockwaveCharge: number;
  shockwaveReady: boolean;
  nodePlayerCount: number;
  nodeEnemyCount: number;
  enemyMode: EnemyMode;
  enemyCount: number;
  enemyTypes: string;
  level: number;
  maxLevel: number;
  levelName: string;
  levelSummary: string;
  stars: number;
  paused: boolean;
  status: GameStatus;
};

export type GameDebugStats = {
  fps: number;
  frameMs: number;
  updateMs: number;
  drawMs: number;
  dotCount: number;
  rippleCount: number;
  particleCount: number;
  pulseCount: number;
  activeEffectCount: number;
  dpr: number;
  hazeScale: number;
  hazeEvery: number;
  enemyCount: number;
  level: number;
};

const ENEMY_SETTINGS: Record<EnemyType, EnemySettings> = {
  spreader: {
    radius: 17,
    fieldRadius: 112,
    speed: 62,
    mass: 1.15,
    spreadPower: 1.36,
    pulseEvery: [6.8, 8.4],
    canMove: true,
  },
  hunter: {
    radius: 15,
    fieldRadius: 76,
    speed: 112,
    mass: 0.92,
    spreadPower: 0.58,
    pulseEvery: [8.2, 10],
    canMove: true,
  },
  tank: {
    radius: 24,
    fieldRadius: 102,
    speed: 48,
    mass: 3.4,
    spreadPower: 0.92,
    pulseEvery: [8, 10.5],
    canMove: true,
  },
  splitter: {
    radius: 16,
    fieldRadius: 88,
    speed: 78,
    mass: 1,
    spreadPower: 0.82,
    pulseEvery: [7.8, 10.4],
    canMove: true,
  },
  root: {
    radius: 21,
    fieldRadius: 106,
    speed: 0,
    mass: 4.8,
    spreadPower: 1.08,
    pulseEvery: [5.6, 7.2],
    canMove: false,
  },
};

const LEVELS: LevelConfig[] = [
  {
    number: 1,
    name: "First Cleanse",
    summary: "No enemy core. Cleanse the seeded infection field.",
    infectionSources: 5,
    enemyTypes: [],
    enemyCanMove: false,
    enemyCanPulse: false,
    enemyModes: ["expand"],
    nodes: [0, 0],
    viscosityZones: 0,
    blockers: 0,
    gates: 0,
    energyWells: 0,
    dotDensity: 1.08,
    enemySpeedScale: 0,
    infectionSpreadScale: 0.72,
  },
  {
    number: 2,
    name: "Pinned Core",
    summary: "A static enemy core infects nearby territory.",
    infectionSources: 3,
    enemyTypes: ["root"],
    enemyCanMove: false,
    enemyCanPulse: false,
    enemyModes: ["expand"],
    nodes: [0, 0],
    viscosityZones: 1,
    blockers: 0,
    gates: 0,
    energyWells: 0,
    dotDensity: 1.12,
    enemySpeedScale: 0,
    infectionSpreadScale: 0.82,
  },
  {
    number: 3,
    name: "Slow Spreader",
    summary: "A slow core moves outward and grows infection.",
    infectionSources: 2,
    enemyTypes: ["spreader"],
    enemyCanMove: true,
    enemyCanPulse: false,
    enemyModes: ["expand"],
    nodes: [0, 0],
    viscosityZones: 2,
    blockers: 0,
    gates: 0,
    energyWells: 0,
    dotDensity: 1.16,
    enemySpeedScale: 0.82,
    infectionSpreadScale: 0.95,
  },
  {
    number: 4,
    name: "Border Contest",
    summary: "The enemy learns to pressure red/blue frontlines.",
    infectionSources: 2,
    enemyTypes: ["spreader"],
    enemyCanMove: true,
    enemyCanPulse: false,
    enemyModes: ["expand", "contest", "defend"],
    nodes: [0, 0],
    viscosityZones: 3,
    blockers: 1,
    gates: 0,
    energyWells: 1,
    dotDensity: 1.2,
    enemySpeedScale: 0.92,
    infectionSpreadScale: 1,
  },
  {
    number: 5,
    name: "Pulse Pressure",
    summary: "The enemy gains infection pulses and a light hunter escort.",
    infectionSources: 1,
    enemyTypes: ["spreader", "hunter"],
    enemyCanMove: true,
    enemyCanPulse: true,
    enemyModes: ["expand", "contest", "defend", "attack"],
    nodes: [0, 0],
    viscosityZones: 3,
    blockers: 1,
    gates: 1,
    energyWells: 1,
    dotDensity: 1.22,
    enemySpeedScale: 0.95,
    infectionSpreadScale: 1.08,
  },
  {
    number: 6,
    name: "Open War",
    summary: "Nodes, walls, gates, energy wells, and enemy variants enter play.",
    infectionSources: 1,
    enemyTypes: ["spreader", "tank", "splitter", "root"],
    enemyCanMove: true,
    enemyCanPulse: true,
    enemyModes: ["expand", "contest", "defend", "attack"],
    nodes: [3, 5],
    viscosityZones: 4,
    blockers: 2,
    gates: 2,
    energyWells: 2,
    dotDensity: 1.28,
    enemySpeedScale: 1,
    infectionSpreadScale: 1.12,
  },
];

function createPlayer(): Agent {
  return {
    id: 0,
    kind: "player",
    type: "player",
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    homeX: 0,
    homeY: 0,
    radius: 16,
    fieldRadius: 84,
    speed: 156,
    mass: 1.1,
    spreadPower: 1,
    intensity: 1,
    health: 1,
    slowTimer: 0,
    pulseTimer: 0,
    decisionTimer: 0,
    modeTimer: 0,
    mode: "expand",
    canMove: true,
    canPulse: false,
    splitDone: false,
    active: true,
  };
}

function createEnemy(type: EnemyType, id: number, config: LevelConfig): Agent {
  const settings = ENEMY_SETTINGS[type];
  const canMove = config.enemyCanMove && settings.canMove;

  return {
    id,
    kind: "enemy",
    type,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    homeX: 0,
    homeY: 0,
    radius: settings.radius,
    fieldRadius: settings.fieldRadius,
    speed: settings.speed * config.enemySpeedScale,
    mass: settings.mass,
    spreadPower: settings.spreadPower,
    intensity: 0.96,
    health: 1,
    slowTimer: 0,
    pulseTimer: randomRange(settings.pulseEvery[0], settings.pulseEvery[1]),
    decisionTimer: 0,
    modeTimer: 0,
    mode: "expand",
    canMove,
    canPulse: config.enemyCanPulse,
    splitDone: false,
    active: true,
  };
}

function createField(): PointerField {
  return {
    active: true,
    x: 0,
    y: 0,
    radius: 90,
    intensity: 1,
  };
}

export class Game {
  width = 0;
  height = 0;
  dots: Dot[] = [];
  status: GameStatus = "playing";
  durationSeconds = 300;
  elapsedSeconds = 0;
  paused = false;

  private levelIndex = 0;
  private player = createPlayer();
  private enemies: Agent[] = [];
  private playerField = createField();
  private enemyField = createField();
  private destination = {
    active: false,
    x: 0,
    y: 0,
    pulse: 0,
  };
  private preview = {
    active: false,
    x: 0,
    y: 0,
  };
  private arena: Arena = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    right: 0,
    bottom: 0,
    radius: 34,
  };
  private exposure = new Float32Array(0);
  private playerExposure = new Float32Array(0);
  private dotViscosity = new Float32Array(0);
  private frontline = new Float32Array(0);
  private ripples: Ripple[] = [];
  private pulses: ActivePulse[] = [];
  private nodes: ControlNode[] = [];
  private viscosityZones: ViscosityZone[] = [];
  private blockers: ArenaBlocker[] = [];
  private energyWells: EnergyWell[] = [];
  private contestedZones: ContestedZone[] = [];
  private particles: Particle[] = [];
  private time = 0;
  private collisionCooldown = 0;
  private shockwaveCharge = 1;
  private sprites: Partial<Record<SpriteKey, HTMLCanvasElement>> = {};
  private hazeCanvas: HTMLCanvasElement | null = null;
  private hazeCtx: CanvasRenderingContext2D | null = null;
  private hazeCountdown = 0;
  private hazeDirty = true;
  private debugStats: GameDebugStats = {
    fps: 0,
    frameMs: 0,
    updateMs: 0,
    drawMs: 0,
    dotCount: 0,
    rippleCount: 0,
    particleCount: 0,
    pulseCount: 0,
    activeEffectCount: 0,
    dpr: 1,
    hazeScale: HAZE_SCALE,
    hazeEvery: HAZE_FRAME_INTERVAL,
    enemyCount: 0,
    level: 1,
  };

  resize(width: number, height: number) {
    const nextWidth = Math.max(320, width);
    const nextHeight = Math.max(480, height);
    const shouldReset =
      this.dots.length === 0 ||
      Math.abs(nextWidth - this.width) > 96 ||
      Math.abs(nextHeight - this.height) > 96;

    this.width = nextWidth;
    this.height = nextHeight;
    this.updateArena();
    this.invalidateHaze();

    if (shouldReset) {
      this.reset();
    } else {
      this.updateFields();
    }
  }

  reset() {
    this.status = "playing";
    this.paused = false;
    this.elapsedSeconds = 0;
    this.time = 0;
    this.collisionCooldown = 0;
    this.shockwaveCharge = 1;
    this.ripples = [];
    this.pulses = [];
    this.contestedZones = [];
    this.particles = [];
    this.destination.active = false;
    this.preview.active = false;
    this.invalidateHaze();
    this.buildLevel();
  }

  setLevel(level: number) {
    const nextLevelIndex = clamp(Math.round(level), 1, LEVELS.length) - 1;

    if (nextLevelIndex === this.levelIndex) {
      this.reset();
      return;
    }

    this.levelIndex = nextLevelIndex;
    this.reset();
  }

  nextLevel() {
    this.setLevel(this.levelIndex + 2);
  }

  previousLevel() {
    this.setLevel(this.levelIndex);
  }

  setPointer(x: number, y: number) {
    this.setDestination(x, y);
  }

  setDestination(x: number, y: number) {
    if (this.paused || this.status !== "playing") {
      return;
    }

    const target = this.findOpenPoint(x, y, this.player.radius + 10);
    this.destination.active = true;
    this.destination.x = target.x;
    this.destination.y = target.y;
    this.destination.pulse = 0;
    this.player.targetX = target.x;
    this.player.targetY = target.y;
  }

  setPreview(x: number, y: number) {
    if (this.paused || this.status !== "playing") {
      this.preview.active = false;
      return;
    }

    const target = this.findOpenPoint(x, y, this.player.radius + 10);
    this.preview.active = true;
    this.preview.x = target.x;
    this.preview.y = target.y;
  }

  clearPointer() {
    this.preview.active = false;
  }

  togglePause() {
    if (this.status !== "playing") {
      return;
    }

    this.paused = !this.paused;
  }

  activateShockwave() {
    if (this.paused || this.status !== "playing" || this.shockwaveCharge < 1) {
      return false;
    }

    this.sacrificePlayerTerritory();
    this.shockwaveCharge = 0;
    this.addPulse({
      x: this.player.x,
      y: this.player.y,
      owner: "player",
      maxRadius: Math.max(this.arena.width, this.arena.height) * 0.92,
      duration: 0.72,
      power: 0.34,
      kind: "shockwave",
    });
    this.addRipple(this.player.x, this.player.y, "shock", 110);
    return true;
  }

  update(dt: number) {
    if (this.paused) {
      return;
    }

    const safeDt = clamp(dt, 0, 1 / 30);

    if (this.status === "playing") {
      this.time += safeDt;
      this.elapsedSeconds += safeDt;
      this.destination.pulse += safeDt;
      this.collisionCooldown = Math.max(0, this.collisionCooldown - safeDt);
      this.updateGates(safeDt);
      this.updateAgents(safeDt);
      this.resolveCoreCollisions();
      this.updateFields();
      this.updateNodes(safeDt);
      this.updateEnemyPulses(safeDt);
      this.updatePulses(safeDt);
      this.cleanseWithPlayer(safeDt);
      this.infectWithEnemies(safeDt);
      this.spreadPlayer(safeDt);
      this.spreadInfection(safeDt);
      this.rechargeShockwave(safeDt);
      this.resolveStates();
      this.updateFrontlines();
      this.checkOutcome();
      this.hazeDirty = true;
    }

    this.updateRipples(safeDt);
    this.updateContestedZones(safeDt);
    this.updateParticles(safeDt);

    for (const dot of this.dots) {
      dot.updateVisual(safeDt, this.time, this.playerField, this.enemyField);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.ensureSprites();
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawOuterBackground(ctx);
    this.drawArenaBase(ctx);

    ctx.save();
    this.arenaPath(ctx, this.arena.radius);
    ctx.clip();
    this.drawViscosityZones(ctx);
    this.drawEnergyWells(ctx);
    this.drawTerritoryHaze(ctx);
    this.drawFrontlines(ctx);
    this.drawAgentFields(ctx);
    this.drawNodes(ctx);
    this.drawRipples(ctx);
    this.drawPulses(ctx);
    this.drawDots(ctx);
    this.drawParticles(ctx);
    this.drawDestination(ctx);
    this.drawBlockers(ctx);
    this.drawAgents(ctx);
    ctx.restore();

    this.drawArenaFrame(ctx);
  }

  recordFrameMetrics(frameMs: number, updateMs: number, drawMs: number, dpr: number) {
    const fps = frameMs > 0 ? 1000 / frameMs : 0;
    const activeEffectCount =
      this.ripples.length + this.particles.length + this.pulses.length + this.contestedZones.length;

    this.debugStats = {
      fps: Math.round(fps),
      frameMs,
      updateMs,
      drawMs,
      dotCount: this.dots.length,
      rippleCount: this.ripples.length,
      particleCount: this.particles.length,
      pulseCount: this.pulses.length,
      activeEffectCount,
      dpr,
      hazeScale: HAZE_SCALE,
      hazeEvery: HAZE_FRAME_INTERVAL,
      enemyCount: this.getActiveEnemies().length,
      level: this.levelConfig.number,
    };
  }

  getDebugStats(): GameDebugStats {
    return this.debugStats;
  }

  getStats(): GameStats {
    let infectedCount = 0;
    let cleansedCount = 0;
    let infectionSum = 0;

    for (const dot of this.dots) {
      infectionSum += dot.infectionAmount;

      if (dot.infectionAmount > 0.58) {
        infectedCount += 1;
      }

      if (dot.playerAmount > 0.45 && dot.infectionAmount < 0.35) {
        cleansedCount += 1;
      }
    }

    const totalDots = this.dots.length || 1;
    const infectedRatio = infectedCount / totalDots;
    const averageInfection = infectionSum / totalDots;
    const activeEnemies = this.getActiveEnemies();
    const primaryEnemy = activeEnemies[0];
    const config = this.levelConfig;

    return {
      totalDots,
      infectedCount,
      cleansedCount,
      neutralCount: Math.max(0, totalDots - infectedCount - cleansedCount),
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      remainingSeconds: Math.max(0, Math.ceil(this.durationSeconds - this.elapsedSeconds)),
      overtimeSeconds: Math.max(0, Math.floor(this.elapsedSeconds - this.durationSeconds)),
      infectionLevel: clamp(Math.max(infectedRatio, averageInfection) * 100, 0, 100),
      playerCoverage: clamp((cleansedCount / totalDots) * 100, 0, 100),
      shockwaveCharge: clamp(this.shockwaveCharge * 100, 0, 100),
      shockwaveReady: this.shockwaveCharge >= 1,
      nodePlayerCount: this.nodes.filter((node) => node.owner === "player").length,
      nodeEnemyCount: this.nodes.filter((node) => node.owner === "enemy").length,
      enemyMode: primaryEnemy?.mode ?? "expand",
      enemyCount: activeEnemies.length,
      enemyTypes: activeEnemies.map((enemy) => enemy.type).join(", ") || "none",
      level: config.number,
      maxLevel: LEVELS.length,
      levelName: config.name,
      levelSummary: config.summary,
      stars: this.getStars(),
      paused: this.paused,
      status: this.status,
    };
  }

  private get levelConfig() {
    return LEVELS[this.levelIndex] ?? LEVELS[0];
  }

  private updateArena() {
    const isMobile = this.width < 720;
    const sideInset = isMobile ? 16 : 36;
    const topInset = isMobile ? 112 : 136;
    const bottomInset = isMobile ? 124 : 56;

    this.arena = {
      x: sideInset,
      y: topInset,
      width: Math.max(240, this.width - sideInset * 2),
      height: Math.max(260, this.height - topInset - bottomInset),
      right: this.width - sideInset,
      bottom: this.height - bottomInset,
      radius: isMobile ? 28 : 36,
    };
  }

  private buildLevel() {
    const config = this.levelConfig;
    const fieldWidth = this.arena.width;
    const fieldHeight = this.arena.height;
    const baseDensity = this.width < 720 ? 390 : 520;
    const targetDots =
      this.width < 720
        ? clamp(Math.round((fieldWidth * fieldHeight * config.dotDensity) / baseDensity), 560, 980)
        : clamp(Math.round((fieldWidth * fieldHeight * config.dotDensity) / baseDensity), 1120, 1780);
    const spacing = clamp(Math.sqrt((fieldWidth * fieldHeight) / targetDots), 14, 24);
    const cols = Math.max(14, Math.floor(fieldWidth / spacing));
    const rows = Math.max(12, Math.floor(fieldHeight / spacing));
    const actualSpacingX = fieldWidth / Math.max(1, cols - 1);
    const actualSpacingY = fieldHeight / Math.max(1, rows - 1);
    const dots: Dot[] = [];
    const grid = new Map<string, number>();
    let id = 0;

    this.placeAgents();
    this.createArenaModifiers();

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const jitterX = randomRange(-actualSpacingX * 0.06, actualSpacingX * 0.06);
        const jitterY = randomRange(-actualSpacingY * 0.06, actualSpacingY * 0.06);
        const x = this.arena.x + col * actualSpacingX + jitterX;
        const y = this.arena.y + row * actualSpacingY + jitterY;

        if (this.isInsideSolidBlocker(x, y, 3)) {
          continue;
        }

        dots.push(new Dot(id, row, col, x, y));
        grid.set(`${row}:${col}`, id);
        id += 1;
      }
    }

    for (const dot of dots) {
      for (let row = dot.row - 2; row <= dot.row + 2; row += 1) {
        for (let col = dot.col - 2; col <= dot.col + 2; col += 1) {
          if (row === dot.row && col === dot.col) {
            continue;
          }

          const neighbor = grid.get(`${row}:${col}`);

          if (neighbor === undefined) {
            continue;
          }

          const candidate = dots[neighbor];
          const neighborDistance = distance(dot.baseX, dot.baseY, candidate.baseX, candidate.baseY);

          if (neighborDistance <= spacing * 1.72 && !this.blockedBetween(dot.baseX, dot.baseY, candidate.baseX, candidate.baseY)) {
            dot.neighbors.push(neighbor);
          }
        }
      }
    }

    this.dots = dots;
    this.exposure = new Float32Array(dots.length);
    this.playerExposure = new Float32Array(dots.length);
    this.dotViscosity = new Float32Array(dots.length);
    this.frontline = new Float32Array(dots.length);

    for (const dot of this.dots) {
      this.dotViscosity[dot.id] = this.getViscosityAt(dot.baseX, dot.baseY);
    }

    this.createNodes();
    this.seedCornerTerritory("player", Math.max(actualSpacingX, actualSpacingY));

    if (this.enemies.length > 0) {
      for (const enemy of this.enemies) {
        this.seedEnemyTerritory(enemy, Math.max(actualSpacingX, actualSpacingY));
      }
    }

    this.seedInfectionSources(config.infectionSources, Math.max(actualSpacingX, actualSpacingY));
    this.updateFields();
    this.updateFrontlines();
    this.invalidateHaze();
  }

  private placeAgents() {
    const config = this.levelConfig;
    const margin = this.width < 720 ? 38 : 54;
    const playerPosition = this.clampToArena(this.arena.x + margin, this.arena.bottom - margin, margin);
    const anchors = [
      { x: this.arena.right - margin, y: this.arena.y + margin },
      { x: this.arena.right - margin, y: this.arena.bottom - margin },
      { x: this.arena.x + this.arena.width * 0.68, y: this.arena.y + margin },
      { x: this.arena.right - margin, y: this.arena.y + this.arena.height * 0.54 },
      { x: this.arena.x + this.arena.width * 0.56, y: this.arena.y + this.arena.height * 0.25 },
    ];

    this.player = createPlayer();
    this.player.x = playerPosition.x;
    this.player.y = playerPosition.y;
    this.player.targetX = playerPosition.x;
    this.player.targetY = playerPosition.y;
    this.player.homeX = playerPosition.x;
    this.player.homeY = playerPosition.y;
    this.player.fieldRadius = clamp(Math.min(this.width, this.height) * 0.11, 72, 102);
    this.player.speed = this.width < 720 ? 118 : 156;

    this.enemies = config.enemyTypes.map((type, index) => {
      const enemy = createEnemy(type, index + 1, config);
      const anchor = anchors[index % anchors.length];
      const position = this.clampToArena(anchor.x, anchor.y, enemy.radius + 10);
      enemy.x = position.x;
      enemy.y = position.y;
      enemy.targetX = position.x;
      enemy.targetY = position.y;
      enemy.homeX = position.x;
      enemy.homeY = position.y;
      enemy.fieldRadius = clamp(enemy.fieldRadius * (this.width < 720 ? 0.82 : 1), 56, 124);
      enemy.speed *= this.width < 720 ? 0.78 : 1;
      return enemy;
    });
  }

  private createArenaModifiers() {
    const config = this.levelConfig;
    this.createViscosityZones(config.viscosityZones);
    this.createBlockers(config.blockers, "wall");
    this.createBlockers(config.gates, "gate");
    this.createEnergyWells(config.energyWells);
  }

  private createNodes() {
    const [minNodes, maxNodes] = this.levelConfig.nodes;
    const count = maxNodes > 0 ? randomInt(minNodes, maxNodes) : 0;
    const nodes: ControlNode[] = [];
    let attempts = 0;

    while (nodes.length < count && attempts < 160) {
      attempts += 1;
      const radius = this.width < 720 ? 17 : 20;
      const x = randomRange(this.arena.x + 90, this.arena.right - 90);
      const y = randomRange(this.arena.y + 84, this.arena.bottom - 84);
      const tooCloseToCore =
        distance(x, y, this.player.x, this.player.y) < 150 ||
        this.enemies.some((enemy) => distance(x, y, enemy.x, enemy.y) < 145);
      const tooCloseToNode = nodes.some((node) => distance(x, y, node.x, node.y) < 150);
      const blocked = this.isInsideSolidBlocker(x, y, radius + 20);

      if (tooCloseToCore || tooCloseToNode || blocked) {
        continue;
      }

      nodes.push({
        id: nodes.length,
        x,
        y,
        radius,
        owner: "neutral",
        captureBy: null,
        captureProgress: 0,
        pulseTimer: randomRange(2.2, 5),
      });
    }

    this.nodes = nodes;
  }

  private createViscosityZones(count: number) {
    const zones: ViscosityZone[] = [];
    let attempts = 0;

    while (zones.length < count && attempts < 140) {
      attempts += 1;
      const radius = randomRange(this.width < 720 ? 54 : 74, this.width < 720 ? 88 : 132);
      const x = randomRange(this.arena.x + radius, this.arena.right - radius);
      const y = randomRange(this.arena.y + radius, this.arena.bottom - radius);
      const tooCloseToHome =
        distance(x, y, this.player.x, this.player.y) < radius + 70 ||
        this.enemies.some((enemy) => distance(x, y, enemy.x, enemy.y) < radius + 70);

      if (tooCloseToHome) {
        continue;
      }

      zones.push({
        x,
        y,
        radius,
        strength: randomRange(0.6, 1),
        phase: randomRange(0, Math.PI * 2),
      });
    }

    this.viscosityZones = zones;
  }

  private createBlockers(count: number, kind: BlockerKind) {
    const blockers = [...this.blockers];
    let attempts = 0;

    while (blockers.filter((blocker) => blocker.kind === kind).length < count && attempts < 160) {
      attempts += 1;
      const radius =
        kind === "gate"
          ? randomRange(this.width < 720 ? 24 : 34, this.width < 720 ? 34 : 48)
          : randomRange(this.width < 720 ? 32 : 44, this.width < 720 ? 48 : 68);
      const x = randomRange(this.arena.x + radius + 36, this.arena.right - radius - 36);
      const y = randomRange(this.arena.y + radius + 36, this.arena.bottom - radius - 36);
      const tooCloseToHome =
        distance(x, y, this.player.x, this.player.y) < radius + 118 ||
        this.enemies.some((enemy) => distance(x, y, enemy.x, enemy.y) < radius + 96);
      const tooCloseToOther = blockers.some((blocker) => distance(x, y, blocker.x, blocker.y) < radius + blocker.radius + 70);

      if (tooCloseToHome || tooCloseToOther) {
        continue;
      }

      blockers.push({
        id: blockers.length,
        kind,
        x,
        y,
        radius,
        openProgress: kind === "gate" ? 0 : 1,
        phase: randomRange(0, Math.PI * 2),
      });
    }

    this.blockers = blockers;
  }

  private createEnergyWells(count: number) {
    const wells: EnergyWell[] = [];
    let attempts = 0;

    while (wells.length < count && attempts < 140) {
      attempts += 1;
      const radius = this.width < 720 ? 24 : 30;
      const x = randomRange(this.arena.x + radius + 58, this.arena.right - radius - 58);
      const y = randomRange(this.arena.y + radius + 58, this.arena.bottom - radius - 58);
      const blocked = this.isInsideSolidBlocker(x, y, radius + 14);
      const tooCloseToCore =
        distance(x, y, this.player.x, this.player.y) < 110 ||
        this.enemies.some((enemy) => distance(x, y, enemy.x, enemy.y) < 110);
      const tooCloseToWell = wells.some((well) => distance(x, y, well.x, well.y) < 130);

      if (blocked || tooCloseToCore || tooCloseToWell) {
        continue;
      }

      wells.push({
        id: wells.length,
        x,
        y,
        radius,
        phase: randomRange(0, Math.PI * 2),
      });
    }

    this.energyWells = wells;
  }

  private seedCornerTerritory(kind: "player", spacing: number) {
    const radius = spacing * 4.2;

    for (const dot of this.dots) {
      const seedDistance = distance(this.player.x, this.player.y, dot.baseX, dot.baseY);

      if (seedDistance > radius) {
        continue;
      }

      const pressure = smoothstep(radius, 0, seedDistance);
      dot.playerAmount = clamp(Math.max(dot.playerAmount, pressure * 0.9), 0, 1);
      dot.infectionAmount = 0;
      dot.state = pressure > 0.36 ? "player" : "neutral";
    }
  }

  private seedEnemyTerritory(enemy: Agent, spacing: number) {
    const radius = spacing * (enemy.type === "root" ? 4.4 : 4.8);

    for (const dot of this.dots) {
      const seedDistance = distance(enemy.x, enemy.y, dot.baseX, dot.baseY);

      if (seedDistance > radius) {
        continue;
      }

      const pressure = smoothstep(radius, 0, seedDistance);
      dot.infectionAmount = clamp(Math.max(dot.infectionAmount, pressure * 0.94), 0, 1);
      dot.playerAmount = 0;
      dot.state = pressure > 0.34 ? "infected" : dot.state;
    }
  }

  private seedInfectionSources(count: number, spacing: number) {
    if (count <= 0) {
      return;
    }

    const sources: { x: number; y: number; radius: number }[] = [];
    let attempts = 0;

    while (sources.length < count && attempts < 120) {
      attempts += 1;
      const x = randomRange(this.arena.x + 80, this.arena.right - 80);
      const y = randomRange(this.arena.y + 78, this.arena.bottom - 78);
      const tooCloseToPlayer = distance(x, y, this.player.x, this.player.y) < 170;
      const tooCloseToEnemy = this.enemies.some((enemy) => distance(x, y, enemy.x, enemy.y) < 115);
      const tooCloseToSource = sources.some((source) => distance(x, y, source.x, source.y) < 145);

      if (tooCloseToPlayer || tooCloseToEnemy || tooCloseToSource || this.isInsideSolidBlocker(x, y, 26)) {
        continue;
      }

      sources.push({
        x,
        y,
        radius: spacing * randomRange(2.6, 4.4),
      });
    }

    for (const source of sources) {
      for (const dot of this.dots) {
        const seedDistance = distance(source.x, source.y, dot.baseX, dot.baseY);

        if (seedDistance > source.radius) {
          continue;
        }

        const pressure = smoothstep(source.radius, 0, seedDistance);
        dot.infectionAmount = clamp(Math.max(dot.infectionAmount, pressure * randomRange(0.55, 0.95)), 0, 1);
        dot.playerAmount = clamp(dot.playerAmount - pressure * 0.5, 0, 1);
        dot.state = dot.infectionAmount > 0.42 ? "infected" : dot.state;
      }
    }
  }

  private updateAgents(dt: number) {
    this.updateEnemyBrain(dt);
    this.moveAgent(this.player, dt);

    for (const enemy of this.getActiveEnemies()) {
      if (enemy.canMove) {
        this.moveAgent(enemy, dt);
      } else {
        enemy.velocityX = 0;
        enemy.velocityY = 0;
      }
    }

    if (this.destination.active && distance(this.player.x, this.player.y, this.destination.x, this.destination.y) < 12) {
      this.destination.active = false;
    }
  }

  private moveAgent(agent: Agent, dt: number) {
    const sample = this.sampleInfluence(agent.x, agent.y, agent.fieldRadius * 0.7);
    const viscosity = this.getViscosityAt(agent.x, agent.y);
    let terrainModifier =
      agent.kind === "player"
        ? clamp(1 - sample.infection * 0.32 + sample.player * 0.18, 0.54, 1.18)
        : clamp(1 - sample.player * 0.24 + sample.infection * 0.18, 0.54, 1.16);

    if (agent.kind === "player" && sample.player > 0.45) {
      terrainModifier *= 1.1;
    }

    if (agent.kind === "enemy" && sample.player > 0.45) {
      terrainModifier *= 0.9;
    }

    if (agent.kind === "enemy" && sample.infection > 0.45) {
      terrainModifier *= 1.1;
    }

    terrainModifier *= 1 - viscosity * 0.5;

    if (agent.slowTimer > 0) {
      agent.slowTimer = Math.max(0, agent.slowTimer - dt);
      terrainModifier *= 0.48;
    }

    const dx = agent.targetX - agent.x;
    const dy = agent.targetY - agent.y;
    const targetDistance = Math.hypot(dx, dy);

    if (targetDistance < 0.5 || !agent.canMove) {
      agent.velocityX = 0;
      agent.velocityY = 0;
      return;
    }

    let dirX = dx / targetDistance;
    let dirY = dy / targetDistance;
    const steered = this.steerAroundBlockers(agent, dirX, dirY, targetDistance);
    dirX = steered.x;
    dirY = steered.y;

    const maxStep = agent.speed * terrainModifier * dt;
    const step = Math.min(targetDistance, maxStep);
    const next = this.clampToArena(
      agent.x + dirX * step,
      agent.y + dirY * step,
      agent.radius + 8,
    );

    agent.velocityX = (next.x - agent.x) / Math.max(dt, 0.001);
    agent.velocityY = (next.y - agent.y) / Math.max(dt, 0.001);
    agent.x = next.x;
    agent.y = next.y;
    this.resolveAgentBlockers(agent);
  }

  private steerAroundBlockers(agent: Agent, dirX: number, dirY: number, targetDistance: number) {
    let steerX = dirX;
    let steerY = dirY;

    for (const blocker of this.blockers) {
      const blockerRadius = this.getBlockerCollisionRadius(blocker);

      if (blockerRadius <= 0) {
        continue;
      }

      const toX = blocker.x - agent.x;
      const toY = blocker.y - agent.y;
      const forward = toX * dirX + toY * dirY;

      if (forward <= 0 || forward > Math.min(targetDistance, blockerRadius + 84)) {
        continue;
      }

      const lateral = Math.abs(toX * dirY - toY * dirX);

      if (lateral > blockerRadius + agent.radius + 22) {
        continue;
      }

      const side = Math.sign(dirX * toY - dirY * toX) || (agent.kind === "player" ? 1 : -1);
      const oldX = steerX;
      steerX += -dirY * side * 0.78;
      steerY += oldX * side * 0.78;
    }

    const length = Math.max(0.001, Math.hypot(steerX, steerY));
    return {
      x: steerX / length,
      y: steerY / length,
    };
  }

  private updateEnemyBrain(dt: number) {
    for (const enemy of this.getActiveEnemies()) {
      if (!enemy.canMove) {
        continue;
      }

      enemy.decisionTimer -= dt;
      enemy.modeTimer -= dt;

      if (enemy.modeTimer <= 0 || enemy.decisionTimer <= 0) {
        this.chooseEnemyMode(enemy);
      }

      if (enemy.decisionTimer > 0) {
        continue;
      }

      enemy.decisionTimer = enemy.type === "hunter" ? randomRange(0.75, 1.45) : randomRange(1.15, 2.35);
      const target = this.chooseEnemyTarget(enemy);
      enemy.targetX = target.x;
      enemy.targetY = target.y;
    }
  }

  private chooseEnemyMode(enemy: Agent) {
    const allowed = this.levelConfig.enemyModes;
    const playerNearEnemyHome = this.sampleInfluence(enemy.homeX, enemy.homeY, enemy.fieldRadius * 1.25).player;
    const currentEnemySample = this.sampleInfluence(enemy.x, enemy.y, enemy.fieldRadius);
    const attackChance = enemy.type === "hunter" ? 0.24 : 0.08;
    const shouldAttack = allowed.includes("attack") && Math.random() < attackChance && this.elapsedSeconds > 18;
    const canContest = allowed.includes("contest") && this.findBestFrontlineDot(enemy);

    if (allowed.includes("defend") && (playerNearEnemyHome > 0.2 || currentEnemySample.player > 0.55)) {
      enemy.mode = "defend";
      enemy.modeTimer = randomRange(2.4, 4.2);
    } else if (shouldAttack) {
      enemy.mode = "attack";
      enemy.modeTimer = randomRange(1.2, enemy.type === "hunter" ? 2.4 : 1.8);
    } else if (canContest) {
      enemy.mode = "contest";
      enemy.modeTimer = randomRange(2.4, 4.8);
    } else {
      enemy.mode = "expand";
      enemy.modeTimer = randomRange(2.6, 5.2);
    }

    enemy.decisionTimer = 0;
  }

  private chooseEnemyTarget(enemy: Agent) {
    const nodeTarget = this.chooseNodeTarget(enemy);

    if (nodeTarget && (enemy.mode === "expand" || enemy.mode === "contest" || Math.random() < 0.65)) {
      return nodeTarget;
    }

    if (enemy.mode === "attack") {
      const target = this.findOpenPoint(this.player.x, this.player.y, enemy.radius + 10);
      const pressure = enemy.type === "hunter" ? 0.72 : 0.46;
      return {
        x: enemy.x + (target.x - enemy.x) * pressure,
        y: enemy.y + (target.y - enemy.y) * pressure,
      };
    }

    if (enemy.mode === "defend") {
      const invaded = this.findBestDot((dot) => {
        const homeDistance = distance(enemy.homeX, enemy.homeY, dot.baseX, dot.baseY);

        if (homeDistance > enemy.fieldRadius * 2.4) {
          return Number.NEGATIVE_INFINITY;
        }

        return dot.playerAmount * 2 + dot.infectionAmount * 0.5 - homeDistance / 260;
      });

      if (invaded) {
        return this.findOpenPoint(invaded.baseX, invaded.baseY, enemy.radius + 10);
      }

      return this.findOpenPoint(enemy.homeX, enemy.homeY, enemy.radius + 10);
    }

    if (enemy.mode === "contest") {
      const frontline = this.findBestFrontlineDot(enemy);

      if (frontline) {
        return this.findOpenPoint(frontline.baseX, frontline.baseY, enemy.radius + 10);
      }
    }

    const expand = this.findBestDot((dot) => {
      const enemyDistance = distance(enemy.x, enemy.y, dot.baseX, dot.baseY);
      const playerDistance = distance(this.player.x, this.player.y, dot.baseX, dot.baseY);
      const neutralValue = (1 - dot.infectionAmount) * (1 - dot.playerAmount);
      const exposedBlue = dot.playerAmount * (1 - dot.infectionAmount) * (enemy.type === "hunter" ? 1.2 : 1.9);
      const travelValue = 1 - enemyDistance / Math.hypot(this.arena.width, this.arena.height);
      const rootBias = enemy.type === "root" ? -enemyDistance / 600 : 0;

      return neutralValue * 1.6 + exposedBlue + travelValue * 0.58 + playerDistance / 940 + rootBias + randomRange(-0.18, 0.18);
    });

    if (expand) {
      return this.findOpenPoint(expand.baseX, expand.baseY, enemy.radius + 10);
    }

    return this.findOpenPoint(enemy.homeX, enemy.homeY, enemy.radius + 10);
  }

  private chooseNodeTarget(enemy: Agent) {
    let bestNode: ControlNode | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const node of this.nodes) {
      if (node.owner === "enemy" && enemy.mode !== "defend") {
        continue;
      }

      const nodeDistance = distance(enemy.x, enemy.y, node.x, node.y);
      const value = node.owner === "player" ? 3.2 : node.owner === "neutral" ? 2.25 : 1.1;
      const score = value - nodeDistance / Math.hypot(this.arena.width, this.arena.height);

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    return bestNode ? this.findOpenPoint(bestNode.x, bestNode.y, enemy.radius + 10) : null;
  }

  private findBestFrontlineDot(enemy: Agent) {
    return this.findBestDot((dot) => {
      const contest = this.frontline[dot.id] ?? Math.min(dot.playerAmount, dot.infectionAmount);
      const weakBlue = dot.playerAmount > 0.35 && dot.infectionAmount > 0.06 ? dot.playerAmount * 1.4 : 0;
      const enemyDistance = distance(enemy.x, enemy.y, dot.baseX, dot.baseY);

      if (contest < 0.08 && weakBlue <= 0) {
        return Number.NEGATIVE_INFINITY;
      }

      return contest * 4 + weakBlue - enemyDistance / 430 + randomRange(-0.1, 0.1);
    });
  }

  private findBestDot(scoreDot: (dot: Dot) => number) {
    let bestDot: Dot | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const dot of this.dots) {
      const score = scoreDot(dot);

      if (score > bestScore) {
        bestScore = score;
        bestDot = dot;
      }
    }

    return bestDot;
  }

  private resolveCoreCollisions() {
    for (const enemy of this.getActiveEnemies()) {
      this.resolveAgentPairCollision(this.player, enemy, true);
    }

    const enemies = this.getActiveEnemies();

    for (let i = 0; i < enemies.length; i += 1) {
      for (let j = i + 1; j < enemies.length; j += 1) {
        this.resolveAgentPairCollision(enemies[i], enemies[j], false);
      }
    }
  }

  private resolveAgentPairCollision(a: Agent, b: Agent, isPlayerEnemy: boolean) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const coreDistance = Math.max(0.001, Math.hypot(dx, dy));
    const minDistance = a.radius + b.radius + (isPlayerEnemy ? 13 : 8);

    if (coreDistance >= minDistance) {
      return;
    }

    const overlap = minDistance - coreDistance;
    const nx = dx / coreDistance;
    const ny = dy / coreDistance;
    const totalMass = a.mass + b.mass;
    const aShare = b.canMove ? b.mass / totalMass : 1;
    const bShare = a.canMove ? a.mass / totalMass : 0;

    if (a.canMove) {
      const nextA = this.clampToArena(a.x - nx * overlap * aShare, a.y - ny * overlap * aShare, a.radius + 8);
      a.x = nextA.x;
      a.y = nextA.y;
      a.targetX = a.kind === "player" ? a.x : a.targetX;
      a.targetY = a.kind === "player" ? a.y : a.targetY;
    }

    if (b.canMove) {
      const nextB = this.clampToArena(b.x + nx * overlap * bShare, b.y + ny * overlap * bShare, b.radius + 8);
      b.x = nextB.x;
      b.y = nextB.y;
      b.targetX = b.x + nx * 42;
      b.targetY = b.y + ny * 42;
    }

    a.slowTimer = Math.max(a.slowTimer, isPlayerEnemy ? 0.55 : 0.28);
    b.slowTimer = Math.max(b.slowTimer, isPlayerEnemy ? 0.68 : 0.28);

    if (isPlayerEnemy && this.collisionCooldown <= 0) {
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      this.collisionCooldown = 0.55;
      this.addRipple(x, y, "collision", 86);
      this.addContestedZone(x, y, 96);
    }
  }

  private resolveAgentBlockers(agent: Agent) {
    for (const blocker of this.blockers) {
      const blockerRadius = this.getBlockerCollisionRadius(blocker);

      if (blockerRadius <= 0) {
        continue;
      }

      const dx = agent.x - blocker.x;
      const dy = agent.y - blocker.y;
      const agentDistance = Math.max(0.001, Math.hypot(dx, dy));
      const minDistance = agent.radius + blockerRadius + 4;

      if (agentDistance >= minDistance) {
        continue;
      }

      const push = minDistance - agentDistance;
      const next = this.clampToArena(
        agent.x + (dx / agentDistance) * push,
        agent.y + (dy / agentDistance) * push,
        agent.radius + 8,
      );
      agent.x = next.x;
      agent.y = next.y;
      agent.slowTimer = Math.max(agent.slowTimer, 0.12);

      if (agent.kind === "player") {
        this.destination.active = false;
        agent.targetX = agent.x;
        agent.targetY = agent.y;
      }
    }
  }

  private updateFields() {
    const activeEnemies = this.getActiveEnemies();
    let nearestEnemy: Agent | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of activeEnemies) {
      const enemyDistance = distance(this.player.x, this.player.y, enemy.x, enemy.y);

      if (enemyDistance < nearestDistance) {
        nearestDistance = enemyDistance;
        nearestEnemy = enemy;
      }
    }

    const playerSuppression = nearestEnemy
      ? smoothstep(nearestEnemy.fieldRadius * 0.78, 0, nearestDistance) * 0.18
      : 0;

    this.player.intensity = clamp(1 - playerSuppression, 0.72, 1);

    for (const enemy of activeEnemies) {
      const duelDistance = distance(this.player.x, this.player.y, enemy.x, enemy.y);
      const suppression = smoothstep(enemy.fieldRadius * 0.82, 0, duelDistance) * 0.42;
      enemy.intensity = clamp(0.96 - suppression, 0.38, 0.98);
    }

    this.playerField = {
      active: true,
      x: this.player.x,
      y: this.player.y,
      radius: this.player.fieldRadius,
      intensity: this.player.intensity,
    };

    if (!nearestEnemy) {
      this.enemyField = {
        active: false,
        x: 0,
        y: 0,
        radius: 0,
        intensity: 0,
      };
      return;
    }

    this.enemyField = {
      active: true,
      x: nearestEnemy.x,
      y: nearestEnemy.y,
      radius: nearestEnemy.fieldRadius,
      intensity: nearestEnemy.intensity,
    };
  }

  private updateNodes(dt: number) {
    for (const node of this.nodes) {
      const playerInside = distance(this.player.x, this.player.y, node.x, node.y) < node.radius + this.player.radius + 6;
      const enemyInside = this.getActiveEnemies().some(
        (enemy) => distance(enemy.x, enemy.y, node.x, node.y) < node.radius + enemy.radius + 6,
      );
      const capturer = playerInside && !enemyInside ? "player" : enemyInside && !playerInside ? "enemy" : null;

      if (!capturer || capturer === node.owner) {
        node.captureProgress = Math.max(0, node.captureProgress - dt * 0.35);
        node.captureBy = null;
      } else {
        if (node.captureBy !== capturer) {
          node.captureBy = capturer;
          node.captureProgress = 0;
        }

        node.captureProgress += dt / 3;

        if (node.captureProgress >= 1) {
          node.owner = capturer;
          node.captureProgress = 0;
          node.captureBy = null;
          node.pulseTimer = 0.35;
          this.addRipple(node.x, node.y, "node", 96);
        }
      }

      if (node.owner === "neutral") {
        continue;
      }

      node.pulseTimer -= dt;

      if (node.pulseTimer <= 0) {
        node.pulseTimer = 5;
        this.pulseNode(node);
      }
    }
  }

  private pulseNode(node: ControlNode) {
    const radius = this.width < 720 ? 92 : 126;
    const isPlayer = node.owner === "player";

    this.addPulse({
      x: node.x,
      y: node.y,
      owner: isPlayer ? "player" : "enemy",
      maxRadius: radius,
      duration: 0.82,
      power: isPlayer ? 0.24 : 0.21,
      kind: "node",
    });
    this.addRipple(node.x, node.y, isPlayer ? "player" : "enemy", radius);
  }

  private updateEnemyPulses(dt: number) {
    for (const enemy of this.getActiveEnemies()) {
      if (!enemy.canPulse && enemy.type !== "root") {
        continue;
      }

      enemy.pulseTimer -= dt;

      if (enemy.pulseTimer > 0) {
        continue;
      }

      const settings = ENEMY_SETTINGS[enemy.type as EnemyType];
      enemy.pulseTimer = randomRange(settings.pulseEvery[0], settings.pulseEvery[1]);
      this.pulseEnemy(enemy);
    }
  }

  private pulseEnemy(enemy: Agent) {
    const radius = enemy.type === "root" ? enemy.fieldRadius * 1.35 : enemy.fieldRadius * 1.18;
    const power = enemy.type === "spreader" ? 0.24 : enemy.type === "hunter" ? 0.13 : 0.19;

    this.addPulse({
      x: enemy.x,
      y: enemy.y,
      owner: "enemy",
      maxRadius: radius,
      duration: 0.88,
      power,
      kind: "enemy",
    });
    this.addRipple(enemy.x, enemy.y, "enemy", radius * 0.76);

    if (enemy.type === "root" && this.levelConfig.number >= 6) {
      this.growInfectionBranch(enemy);
    }
  }

  private growInfectionBranch(enemy: Agent) {
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x) + randomRange(-0.45, 0.45);
    const length = this.width < 720 ? 210 : 320;
    const width = 0.34;

    for (const dot of this.dots) {
      const dx = dot.baseX - enemy.x;
      const dy = dot.baseY - enemy.y;
      const dotDistance = Math.hypot(dx, dy);

      if (dotDistance <= enemy.radius || dotDistance > length) {
        continue;
      }

      const dotAngle = Math.atan2(dy, dx);
      const angleDelta = Math.abs(Math.atan2(Math.sin(dotAngle - angle), Math.cos(dotAngle - angle)));

      if (angleDelta > width) {
        continue;
      }

      const influence = smoothstep(length, 0, dotDistance) * smoothstep(width, 0, angleDelta);
      dot.infectionAmount = clamp(dot.infectionAmount + influence * 0.22, 0, 1);
      dot.playerAmount = clamp(dot.playerAmount - influence * 0.15, 0, 1);

      if (influence > 0.45 && Math.random() < 0.08) {
        this.addParticle(dot.x, dot.y, "enemy", 1.3);
      }
    }
  }

  private updatePulses(dt: number) {
    for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.pulses[index];
      pulse.age += dt;
      const progress = clamp(pulse.age / pulse.duration, 0, 1);
      const radius = progress * pulse.maxRadius;

      this.applyPulse(pulse, pulse.previousRadius, radius);
      pulse.previousRadius = radius;

      if (pulse.age >= pulse.duration) {
        this.pulses.splice(index, 1);
      }
    }
  }

  private applyPulse(pulse: ActivePulse, previousRadius: number, radius: number) {
    const band = pulse.kind === "shockwave" ? 46 : 34;

    for (const dot of this.dots) {
      const waveDistance = dot.distanceTo(pulse.x, pulse.y);

      if (waveDistance < previousRadius - band || waveDistance > radius + band) {
        continue;
      }

      const edge = 1 - clamp(Math.abs(waveDistance - radius) / band, 0, 1);
      const power = edge * pulse.power;

      if (pulse.owner === "player") {
        dot.infectionAmount = clamp(dot.infectionAmount - power, 0, 1);
        dot.playerAmount = clamp(dot.playerAmount + power * 0.92, 0, 1);
      } else {
        dot.infectionAmount = clamp(dot.infectionAmount + power, 0, 1);
        dot.playerAmount = clamp(dot.playerAmount - power * 0.7, 0, 1);
      }
    }

    if (pulse.owner === "player") {
      for (const enemy of this.getActiveEnemies()) {
        const waveDistance = distance(pulse.x, pulse.y, enemy.x, enemy.y);

        if (waveDistance < previousRadius - band || waveDistance > radius + band) {
          continue;
        }

        const edge = 1 - clamp(Math.abs(waveDistance - radius) / band, 0, 1);
        this.damageEnemy(enemy, edge * (pulse.kind === "shockwave" ? 0.42 : 0.18));
      }
    }
  }

  private cleanseWithPlayer(dt: number) {
    const sample = this.sampleInfluence(this.player.x, this.player.y, this.player.fieldRadius * 0.72);
    const homeBonus = sample.player > 0.45 ? 1.15 : 1;
    const wellBonus = this.getEnergyWellBonus();
    const viscosity = this.getViscosityAt(this.player.x, this.player.y);

    for (const dot of this.dots) {
      const playerDistance = dot.distanceTo(this.player.x, this.player.y);

      if (playerDistance >= this.player.fieldRadius) {
        continue;
      }

      const localViscosity = this.dotViscosity[dot.id] ?? 0;
      const influence = smoothstep(this.player.fieldRadius, 0, playerDistance) * this.player.intensity;
      const cleansePower = influence * dt * 1.02 * homeBonus * wellBonus * (1 + Math.max(viscosity, localViscosity) * 0.9);

      if (dot.infectionAmount > 0) {
        const before = dot.infectionAmount;
        dot.infectionAmount = clamp(dot.infectionAmount - cleansePower, 0, 1);
        dot.playerAmount = clamp(dot.playerAmount + cleansePower * 1.38, 0, 1);

        if (before > 0.1 && dot.infectionAmount <= 0.02) {
          dot.infectionAmount = 0;
          dot.playerAmount = Math.max(dot.playerAmount, 0.84);
          dot.state = "player";
          this.addRipple(dot.x, dot.y, "player");
          this.addParticle(dot.x, dot.y, "player", 1.25);
        }
      } else {
        dot.playerAmount = clamp(dot.playerAmount + influence * dt * 0.74 * homeBonus * wellBonus, 0, 1);
      }
    }

    this.damageEnemiesNearPlayer(dt);
  }

  private damageEnemiesNearPlayer(dt: number) {
    for (const enemy of this.getActiveEnemies()) {
      const playerDistance = distance(this.player.x, this.player.y, enemy.x, enemy.y);

      if (playerDistance >= this.player.fieldRadius + enemy.radius) {
        continue;
      }

      const influence = smoothstep(this.player.fieldRadius + enemy.radius, 0, playerDistance);
      const tankResistance = enemy.type === "tank" ? 0.42 : 1;
      this.damageEnemy(enemy, influence * dt * 0.11 * tankResistance);
    }
  }

  private damageEnemy(enemy: Agent, amount: number) {
    enemy.health = clamp(enemy.health - amount, 0, 1);

    if (enemy.type === "splitter" && !enemy.splitDone && enemy.health <= 0.55) {
      this.splitEnemy(enemy);
    }
  }

  private splitEnemy(enemy: Agent) {
    if (this.enemies.length >= MAX_ENEMIES) {
      enemy.splitDone = true;
      return;
    }

    enemy.splitDone = true;
    enemy.active = false;
    const config = this.levelConfig;
    const childrenToAdd = Math.min(2, MAX_ENEMIES - this.enemies.length);

    for (let index = 0; index < childrenToAdd; index += 1) {
      const child = createEnemy("hunter", this.enemies.length + 1, config);
      const angle = this.time + index * Math.PI + randomRange(-0.35, 0.35);
      const position = this.findOpenPoint(
        enemy.x + Math.cos(angle) * 42,
        enemy.y + Math.sin(angle) * 42,
        child.radius + 10,
      );
      child.radius = 11;
      child.fieldRadius = this.width < 720 ? 58 : 68;
      child.speed = (this.width < 720 ? 86 : 108) * config.enemySpeedScale;
      child.mass = 0.72;
      child.health = 0.62;
      child.x = position.x;
      child.y = position.y;
      child.targetX = position.x;
      child.targetY = position.y;
      child.homeX = position.x;
      child.homeY = position.y;
      child.canPulse = false;
      this.enemies.push(child);
      this.addRipple(child.x, child.y, "enemy", 54);
    }

    this.addContestedZone(enemy.x, enemy.y, 88);
  }

  private infectWithEnemies(dt: number) {
    const overtime = this.getOvertimePressure();

    for (const enemy of this.getActiveEnemies()) {
      const sample = this.sampleInfluence(enemy.x, enemy.y, enemy.fieldRadius * 0.72);
      let territoryModifier = 1;

      if (sample.player > 0.45) {
        territoryModifier *= 0.85;
      }

      if (sample.infection > 0.45) {
        territoryModifier *= 1.15;
      }

      for (const dot of this.dots) {
        const enemyDistance = dot.distanceTo(enemy.x, enemy.y);

        if (enemyDistance >= enemy.fieldRadius) {
          continue;
        }

        const localViscosity = this.dotViscosity[dot.id] ?? 0;
        const influence = smoothstep(enemy.fieldRadius, 0, enemyDistance) * enemy.intensity;
        const infectionPower =
          influence * dt * 0.66 * enemy.spreadPower * territoryModifier * overtime * (1 + localViscosity * 0.9);
        const before = dot.infectionAmount;

        dot.infectionAmount = clamp(dot.infectionAmount + infectionPower, 0, 1);
        dot.playerAmount = clamp(dot.playerAmount - infectionPower * 0.78, 0, 1);

        if (before < 0.52 && dot.infectionAmount >= 0.58) {
          this.addRipple(dot.x, dot.y, "enemy");
          this.addParticle(dot.x, dot.y, "enemy", 1.2);
        }
      }
    }
  }

  private spreadPlayer(dt: number) {
    this.playerExposure.fill(0);

    for (const dot of this.dots) {
      if (dot.playerAmount < 0.4 || dot.infectionAmount > 0.65) {
        continue;
      }

      const viscosity = this.dotViscosity[dot.id] ?? 0;
      const sourcePressure = dot.playerAmount * dt * 0.036 * (1 + viscosity);

      for (const neighborIndex of dot.neighbors) {
        const neighbor = this.dots[neighborIndex];
        const resistance = 1 - neighbor.infectionAmount * 0.72;
        this.playerExposure[neighborIndex] += sourcePressure * resistance;
      }
    }

    for (let index = 0; index < this.dots.length; index += 1) {
      const spread = this.playerExposure[index];

      if (spread <= 0) {
        continue;
      }

      const dot = this.dots[index];
      dot.playerAmount = clamp(dot.playerAmount + spread, 0, 1);

      if (dot.infectionAmount > 0) {
        dot.infectionAmount = clamp(dot.infectionAmount - spread * 0.38, 0, 1);
      }
    }
  }

  private spreadInfection(dt: number) {
    this.exposure.fill(0);

    for (const dot of this.dots) {
      if (dot.infectionAmount < 0.34) {
        continue;
      }

      const viscosity = this.dotViscosity[dot.id] ?? 0;
      const sourcePressure =
        dot.infectionAmount * dt * 0.04 * (1 + viscosity) * this.getOvertimePressure() * this.levelConfig.infectionSpreadScale;

      for (const neighborIndex of dot.neighbors) {
        const neighbor = this.dots[neighborIndex];
        const resistance = 1 - neighbor.playerAmount * 0.46;
        this.exposure[neighborIndex] += sourcePressure * resistance;
      }
    }

    for (let index = 0; index < this.dots.length; index += 1) {
      const dot = this.dots[index];
      let exposure = this.exposure[index];

      if (exposure <= 0) {
        if (dot.infectionAmount === 0 && dot.playerAmount > 0) {
          dot.playerAmount = clamp(dot.playerAmount - dt * 0.004, 0, 1);
        }

        continue;
      }

      const playerInfluence = smoothstep(this.player.fieldRadius, 0, dot.distanceTo(this.player.x, this.player.y));
      let enemyInfluence = 0;

      for (const enemy of this.getActiveEnemies()) {
        enemyInfluence = Math.max(enemyInfluence, smoothstep(enemy.fieldRadius, 0, dot.distanceTo(enemy.x, enemy.y)) * enemy.intensity);
      }

      exposure *= 1 - playerInfluence * this.player.intensity * 0.7;
      exposure *= 1 + enemyInfluence * 0.42;

      dot.infectionAmount = clamp(dot.infectionAmount + exposure, 0, 1);
      dot.playerAmount = clamp(dot.playerAmount - exposure * 0.66, 0, 1);

      if (dot.infectionAmount > 0.42) {
        dot.infectionAmount = clamp(dot.infectionAmount + dt * 0.0025 * this.getOvertimePressure(), 0, 1);
      }
    }
  }

  private rechargeShockwave(dt: number) {
    if (this.shockwaveCharge >= 1) {
      return;
    }

    const sample = this.sampleInfluence(this.player.x, this.player.y, this.player.fieldRadius * 0.72);
    const rechargeBonus = sample.player > 0.45 ? 1.25 : 1;
    const nodeBonus = this.nodes.filter((node) => node.owner === "player").length * 0.08;
    const wellBonus = this.getEnergyWellBonus();
    this.shockwaveCharge = clamp(this.shockwaveCharge + dt * 0.032 * (rechargeBonus + nodeBonus) * wellBonus, 0, 1);
  }

  private sacrificePlayerTerritory() {
    const playerDots = this.dots
      .filter((dot) => dot.playerAmount > 0.45 && dot.infectionAmount < 0.35)
      .sort((a, b) => {
        const frontierA = a.playerAmount - a.infectionAmount;
        const frontierB = b.playerAmount - b.infectionAmount;
        return frontierA - frontierB;
      });
    const count = Math.ceil(playerDots.length * 0.1);

    for (let index = 0; index < count; index += 1) {
      const dot = playerDots[index];
      dot.playerAmount = 0;
      dot.infectionAmount = 0;
      dot.state = "neutral";
    }
  }

  private resolveStates() {
    for (const dot of this.dots) {
      const previousState = dot.state;
      const contested = dot.playerAmount > 0.18 && dot.infectionAmount > 0.18;
      let nextState: DotState = "neutral";

      if (dot.infectionAmount > 0.58) {
        nextState = "infected";
      } else if (dot.playerAmount > 0.22) {
        nextState = "player";
      }

      if (contested) {
        dot.playerAmount = clamp(dot.playerAmount - 0.0015, 0, 1);
        dot.infectionAmount = clamp(dot.infectionAmount - 0.001, 0, 1);
      }

      if (dot.infectionAmount <= 0.01) {
        dot.infectionAmount = 0;
      }

      if (dot.playerAmount <= 0.01) {
        dot.playerAmount = 0;
      }

      if (dot.infectionAmount >= 1) {
        dot.infectionAmount = 1;
        nextState = "infected";
      }

      dot.state = nextState;

      if (previousState !== nextState && nextState !== "neutral") {
        this.addParticle(dot.x, dot.y, nextState === "player" ? "player" : "enemy", 1.1);
      }
    }
  }

  private updateFrontlines() {
    this.frontline.fill(0);

    for (const dot of this.dots) {
      let strength = Math.min(dot.playerAmount, dot.infectionAmount) * 1.4;

      if (strength < 0.12) {
        for (const neighborIndex of dot.neighbors) {
          const neighbor = this.dots[neighborIndex];
          const playerEnemyEdge =
            (dot.playerAmount > 0.42 && neighbor.infectionAmount > 0.42) ||
            (dot.infectionAmount > 0.42 && neighbor.playerAmount > 0.42);

          if (playerEnemyEdge) {
            strength = Math.max(strength, 0.28);
            break;
          }
        }
      }

      this.frontline[dot.id] = clamp(strength, 0, 1);
    }
  }

  private updateGates(dt: number) {
    for (const blocker of this.blockers) {
      if (blocker.kind !== "gate") {
        continue;
      }

      let sampleCount = 0;
      let playerWeight = 0;
      const radius = blocker.radius + 82;

      for (const dot of this.dots) {
        const gateDistance = dot.distanceTo(blocker.x, blocker.y);

        if (gateDistance > radius) {
          continue;
        }

        const weight = smoothstep(radius, 0, gateDistance);
        sampleCount += weight;
        playerWeight += dot.playerAmount * weight;
      }

      const playerRatio = sampleCount > 0 ? playerWeight / sampleCount : 0;
      const target = playerRatio > 0.48 ? 1 : 0;
      const speed = target > blocker.openProgress ? 0.9 : 0.36;
      blocker.openProgress = clamp(blocker.openProgress + (target - blocker.openProgress) * dt * speed, 0, 1);
    }
  }

  private checkOutcome() {
    const stats = this.getStats();
    const infectedRatio = stats.infectedCount / stats.totalDots;
    const playerRatio = stats.cleansedCount / stats.totalDots;

    if (playerRatio >= 0.7) {
      this.status = "won";
      return;
    }

    if (infectedRatio >= 0.75) {
      this.status = "lost";
    }
  }

  private getStars() {
    if (this.status !== "won") {
      return 0;
    }

    if (this.elapsedSeconds <= 120) {
      return 3;
    }

    if (this.elapsedSeconds <= 210) {
      return 2;
    }

    return 1;
  }

  private getOvertimePressure() {
    const overtime = Math.max(0, this.elapsedSeconds - this.durationSeconds);
    return 1 + clamp(overtime / 140, 0, 0.72);
  }

  private updateRipples(dt: number) {
    for (let index = this.ripples.length - 1; index >= 0; index -= 1) {
      const ripple = this.ripples[index];
      ripple.age += dt;

      if (ripple.age >= ripple.duration) {
        this.ripples.splice(index, 1);
      }
    }
  }

  private updateContestedZones(dt: number) {
    for (let index = this.contestedZones.length - 1; index >= 0; index -= 1) {
      const zone = this.contestedZones[index];
      zone.age += dt;

      if (zone.age >= zone.duration) {
        this.contestedZones.splice(index, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;

      if (particle.age >= particle.duration) {
        this.particles.splice(index, 1);
      }
    }
  }

  private addPulse({
    x,
    y,
    owner,
    maxRadius,
    duration,
    power,
    kind,
  }: {
    x: number;
    y: number;
    owner: AgentKind;
    maxRadius: number;
    duration: number;
    power: number;
    kind: PulseKind;
  }) {
    while (this.pulses.length >= MAX_PULSES) {
      this.pulses.shift();
    }

    this.pulses.push({
      x,
      y,
      age: 0,
      duration,
      previousRadius: 0,
      maxRadius,
      owner,
      power,
      kind,
    });
  }

  private addRipple(x: number, y: number, color: Ripple["color"], radius = randomRange(28, 64)) {
    while (this.ripples.length >= MAX_RIPPLES) {
      this.ripples.shift();
    }

    this.ripples.push({
      x,
      y,
      age: 0,
      duration: color === "shock" ? 0.9 : color === "collision" ? 0.7 : 0.76,
      radius,
      color,
    });
  }

  private addParticle(x: number, y: number, kind: AgentKind, size = 1) {
    while (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }

    const angle = randomRange(0, Math.PI * 2);
    const speed = randomRange(12, 34);

    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      duration: randomRange(0.36, 0.7),
      size,
      kind,
    });
  }

  private addContestedZone(x: number, y: number, radius: number) {
    while (this.contestedZones.length >= MAX_CONTESTED_ZONES) {
      this.contestedZones.shift();
    }

    this.contestedZones.push({
      x,
      y,
      age: 0,
      duration: 1.7,
      radius,
    });
  }

  private sampleInfluence(x: number, y: number, radius: number): InfluenceSample {
    let weight = 0;
    let infection = 0;
    let player = 0;

    for (const dot of this.dots) {
      const sampleDistance = dot.distanceTo(x, y);

      if (sampleDistance > radius) {
        continue;
      }

      const influence = smoothstep(radius, 0, sampleDistance);
      weight += influence;
      infection += dot.infectionAmount * influence;
      player += dot.playerAmount * influence;
    }

    if (weight <= 0) {
      return { infection: 0, player: 0 };
    }

    return {
      infection: infection / weight,
      player: player / weight,
    };
  }

  private getEnergyWellBonus() {
    let bonus = 1;

    for (const well of this.energyWells) {
      const wellDistance = distance(this.player.x, this.player.y, well.x, well.y);

      if (wellDistance > well.radius + this.player.radius + 20) {
        continue;
      }

      bonus = Math.max(bonus, 1.35);
    }

    return bonus;
  }

  private getViscosityAt(x: number, y: number) {
    let viscosity = 0;

    for (const zone of this.viscosityZones) {
      const zoneDistance = distance(x, y, zone.x, zone.y);

      if (zoneDistance > zone.radius) {
        continue;
      }

      viscosity = Math.max(viscosity, smoothstep(zone.radius, 0, zoneDistance) * zone.strength);
    }

    return clamp(viscosity, 0, 1);
  }

  private getActiveEnemies() {
    return this.enemies.filter((enemy) => enemy.active);
  }

  private getBlockerCollisionRadius(blocker: ArenaBlocker) {
    if (blocker.kind === "gate") {
      return blocker.radius * (1 - blocker.openProgress);
    }

    return blocker.radius;
  }

  private isInsideSolidBlocker(x: number, y: number, padding: number) {
    return this.blockers.some((blocker) => {
      const blockerRadius = blocker.kind === "gate" ? blocker.radius * 0.92 : blocker.radius;
      return distance(x, y, blocker.x, blocker.y) < blockerRadius + padding;
    });
  }

  private blockedBetween(x1: number, y1: number, x2: number, y2: number) {
    for (const blocker of this.blockers) {
      const blockerRadius = blocker.kind === "gate" ? blocker.radius * 0.88 : blocker.radius * 0.92;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      const projection = clamp(((blocker.x - x1) * dx + (blocker.y - y1) * dy) / (length * length), 0, 1);
      const closestX = x1 + dx * projection;
      const closestY = y1 + dy * projection;

      if (distance(closestX, closestY, blocker.x, blocker.y) < blockerRadius) {
        return true;
      }
    }

    return false;
  }

  private findOpenPoint(x: number, y: number, padding: number) {
    let point = this.clampToArena(x, y, padding);

    for (let pass = 0; pass < 3; pass += 1) {
      for (const blocker of this.blockers) {
        const blockerRadius = this.getBlockerCollisionRadius(blocker);

        if (blockerRadius <= 0) {
          continue;
        }

        const dx = point.x - blocker.x;
        const dy = point.y - blocker.y;
        const pointDistance = Math.max(0.001, Math.hypot(dx, dy));
        const minDistance = blockerRadius + padding + 6;

        if (pointDistance >= minDistance) {
          continue;
        }

        point = this.clampToArena(
          blocker.x + (dx / pointDistance) * minDistance,
          blocker.y + (dy / pointDistance) * minDistance,
          padding,
        );
      }
    }

    return point;
  }

  private clampToArena(x: number, y: number, padding: number) {
    return {
      x: clamp(x, this.arena.x + padding, this.arena.right - padding),
      y: clamp(y, this.arena.y + padding, this.arena.bottom - padding),
    };
  }

  private invalidateHaze() {
    this.hazeDirty = true;
    this.hazeCountdown = 0;
  }

  private ensureSprites() {
    if (this.sprites.neutralDot || typeof document === "undefined") {
      return;
    }

    this.sprites.neutralDot = this.createSprite(38, (ctx, size) => {
      const center = size / 2;
      const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
      glow.addColorStop(0, "rgba(154, 163, 178, 0.54)");
      glow.addColorStop(0.42, "rgba(154, 163, 178, 0.28)");
      glow.addColorStop(1, "rgba(154, 163, 178, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(125, 137, 154, 0.58)";
      ctx.beginPath();
      ctx.arc(center, center, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });

    this.sprites.playerDot = this.createDotSprite(palette.playerHot, palette.player);
    this.sprites.infectedDot = this.createDotSprite(palette.infectedHot, palette.infected);
    this.sprites.contestedDot = this.createDotSprite({ r: 148, g: 126, b: 176 }, { r: 99, g: 106, b: 122 });
    this.sprites.playerCore = this.createCoreSprite(palette.playerHot, palette.player);
    this.sprites.enemyCore = this.createCoreSprite(palette.infectedHot, palette.infected);
  }

  private createDotSprite(hot: typeof palette.playerHot, edge: typeof palette.player) {
    return this.createSprite(52, (ctx, size) => {
      const center = size / 2;
      const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
      glow.addColorStop(0, rgba(hot, 0.58));
      glow.addColorStop(0.42, rgba(edge, 0.24));
      glow.addColorStop(1, rgba(edge, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = rgba(edge, 0.92);
      ctx.beginPath();
      ctx.arc(center, center, size * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
      ctx.beginPath();
      ctx.arc(center - size * 0.04, center - size * 0.05, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private createCoreSprite(hot: typeof palette.playerHot, edge: typeof palette.player) {
    return this.createSprite(128, (ctx, size) => {
      const center = size / 2;
      const field = ctx.createRadialGradient(center, center, 0, center, center, center);
      field.addColorStop(0, rgba(hot, 0.5));
      field.addColorStop(0.46, rgba(edge, 0.2));
      field.addColorStop(1, rgba(edge, 0));
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, size, size);

      const body = ctx.createRadialGradient(center - size * 0.12, center - size * 0.14, 0, center, center, size * 0.24);
      body.addColorStop(0, "rgba(255, 255, 255, 0.94)");
      body.addColorStop(0.46, rgba(hot, 0.92));
      body.addColorStop(1, rgba(edge, 0.96));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(center, center, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private createSprite(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      draw(ctx, size);
    }

    return canvas;
  }

  private ensureHazeCanvas() {
    if (typeof document === "undefined") {
      return null;
    }

    const width = Math.max(1, Math.ceil(this.width * HAZE_SCALE));
    const height = Math.max(1, Math.ceil(this.height * HAZE_SCALE));

    if (!this.hazeCanvas) {
      this.hazeCanvas = document.createElement("canvas");
      this.hazeCtx = this.hazeCanvas.getContext("2d", { alpha: true });
    }

    if (this.hazeCanvas.width !== width || this.hazeCanvas.height !== height) {
      this.hazeCanvas.width = width;
      this.hazeCanvas.height = height;
      this.invalidateHaze();
    }

    return this.hazeCanvas;
  }

  private renderHaze() {
    const canvas = this.ensureHazeCanvas();
    const ctx = this.hazeCtx;

    if (!canvas || !ctx) {
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(HAZE_SCALE, 0, 0, HAZE_SCALE, 0, 0);

    for (const dot of this.dots) {
      if (dot.infectionAmount > 0.08) {
        const radius = 18 + dot.infectionAmount * 46;
        const glow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
        glow.addColorStop(0, rgba(palette.infectedHot, dot.infectionAmount * 0.15));
        glow.addColorStop(0.62, rgba(palette.infected, dot.infectionAmount * 0.065));
        glow.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (dot.playerAmount > 0.08) {
        const radius = 18 + dot.playerAmount * 48;
        const glow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
        glow.addColorStop(0, rgba(palette.playerHot, dot.playerAmount * 0.145));
        glow.addColorStop(0.65, rgba(palette.player, dot.playerAmount * 0.06));
        glow.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const frontline = this.frontline[dot.id] ?? 0;

      if (frontline > 0.12) {
        const radius = 14 + frontline * 28;
        const flicker = 0.72 + Math.sin(this.time * 8 + dot.id) * 0.18;
        const haze = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
        haze.addColorStop(0, `rgba(126, 106, 158, ${frontline * 0.18 * flicker})`);
        haze.addColorStop(1, "rgba(126, 106, 158, 0)");
        ctx.fillStyle = haze;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawOuterBackground(ctx: CanvasRenderingContext2D) {
    const background = ctx.createLinearGradient(0, 0, 0, this.height);
    background.addColorStop(0, "#f5f8fb");
    background.addColorStop(1, "#edf4f8");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawArenaBase(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowColor = "rgba(82, 104, 130, 0.14)";
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 16;
    this.arenaPath(ctx, this.arena.radius);
    const arenaFill = ctx.createLinearGradient(0, this.arena.y, 0, this.arena.bottom);
    arenaFill.addColorStop(0, palette.backgroundTop);
    arenaFill.addColorStop(1, palette.backgroundBottom);
    ctx.fillStyle = arenaFill;
    ctx.fill();
    ctx.restore();
  }

  private drawViscosityZones(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const zone of this.viscosityZones) {
      const pulse = 0.9 + Math.sin(this.time * 0.9 + zone.phase) * 0.08;
      const radius = zone.radius * pulse;
      const fill = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, radius);
      fill.addColorStop(0, `rgba(71, 85, 105, ${0.12 * zone.strength})`);
      fill.addColorStop(0.58, `rgba(71, 85, 105, ${0.07 * zone.strength})`);
      fill.addColorStop(1, "rgba(71, 85, 105, 0)");
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawEnergyWells(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const well of this.energyWells) {
      const pulse = 1 + Math.sin(this.time * 2.2 + well.phase) * 0.08;
      const radius = well.radius * pulse;
      ctx.fillStyle = "rgba(82, 219, 232, 0.09)";
      ctx.beginPath();
      ctx.arc(well.x, well.y, radius * 1.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(30, 174, 233, 0.38)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(well.x, well.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(86, 219, 232, 0.5)";
      ctx.beginPath();
      ctx.arc(well.x, well.y, Math.max(3, radius * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawTerritoryHaze(ctx: CanvasRenderingContext2D) {
    if (this.hazeDirty && this.hazeCountdown <= 0) {
      this.renderHaze();
      this.hazeDirty = false;
      this.hazeCountdown = HAZE_FRAME_INTERVAL;
    } else {
      this.hazeCountdown = Math.max(0, this.hazeCountdown - 1);
    }

    const canvas = this.hazeCanvas;

    if (!canvas) {
      return;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(canvas, 0, 0, this.width, this.height);
    ctx.restore();
  }

  private drawFrontlines(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const dot of this.dots) {
      const frontline = this.frontline[dot.id] ?? 0;

      if (frontline < 0.22) {
        continue;
      }

      const flicker = 0.65 + Math.sin(this.time * 9 + dot.id) * 0.35;
      ctx.fillStyle = `rgba(128, 105, 160, ${frontline * 0.22 * flicker})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.radius + 2 + frontline * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawContestedZones(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const zone of this.contestedZones) {
      const progress = zone.age / zone.duration;
      const alpha = (1 - progress) * 0.2;
      const radius = zone.radius * (0.55 + progress * 0.5);
      const haze = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, radius);
      haze.addColorStop(0, `rgba(98, 111, 129, ${alpha})`);
      haze.addColorStop(1, "rgba(98, 111, 129, 0)");
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawAgentFields(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.getActiveEnemies()) {
      this.drawSoftField(ctx, enemy.x, enemy.y, enemy.fieldRadius * 1.02, "enemy", enemy.intensity * 0.9);
    }

    this.drawSoftField(ctx, this.player.x, this.player.y, this.player.fieldRadius * 1.08, "player", this.player.intensity);
    this.drawContestedZones(ctx);
  }

  private drawSoftField(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    kind: AgentKind,
    intensity: number,
  ) {
    const color = kind === "player" ? palette.playerHot : palette.infectedHot;
    const edge = kind === "player" ? palette.player : palette.infected;
    const field = ctx.createRadialGradient(x, y, 0, x, y, radius);
    field.addColorStop(0, rgba(color, 0.2 * intensity));
    field.addColorStop(0.36, rgba(edge, 0.1 * intensity));
    field.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = field;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawNodes(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const node of this.nodes) {
      const ownerColor =
        node.owner === "player"
          ? palette.playerHot
          : node.owner === "enemy"
            ? palette.infectedHot
            : palette.neutral;
      const pulse = 1 + Math.sin(this.time * 2.4 + node.id) * 0.08;
      const radius = node.radius * pulse;

      ctx.fillStyle = rgba(ownerColor, node.owner === "neutral" ? 0.42 : 0.88);
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();

      if (node.captureBy) {
        ctx.strokeStyle = rgba(node.captureBy === "player" ? palette.playerHot : palette.infectedHot, 0.86);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * node.captureProgress);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawBlockers(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const blocker of this.blockers) {
      const open = blocker.kind === "gate" ? blocker.openProgress : 0;
      const radius = blocker.kind === "gate" ? blocker.radius * (1 - open * 0.18) : blocker.radius;

      ctx.fillStyle =
        blocker.kind === "gate"
          ? `rgba(79, 94, 112, ${0.22 * (1 - open) + 0.05})`
          : "rgba(83, 96, 113, 0.18)";
      ctx.beginPath();
      ctx.arc(blocker.x, blocker.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle =
        blocker.kind === "gate"
          ? `rgba(30, 174, 233, ${0.2 + open * 0.48})`
          : "rgba(83, 96, 113, 0.22)";
      ctx.lineWidth = blocker.kind === "gate" ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.arc(blocker.x, blocker.y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();

      if (blocker.kind === "gate" && open > 0.08) {
        ctx.strokeStyle = `rgba(86, 219, 232, ${open * 0.5})`;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.arc(blocker.x, blocker.y, radius + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  private drawRipples(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const ripple of this.ripples) {
      const progress = ripple.age / ripple.duration;
      const radius = ripple.radius * (0.35 + progress);
      const alpha = (1 - progress) * 0.42;
      const color =
        ripple.color === "player" || ripple.color === "shock"
          ? palette.playerHot
          : ripple.color === "enemy"
            ? palette.infectedHot
            : palette.neutral;

      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = 1.5 + (1 - progress) * 2;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPulses(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const pulse of this.pulses) {
      const progress = pulse.age / pulse.duration;
      const alpha = (1 - progress) * (pulse.owner === "player" ? 0.48 : 0.36);
      const color = pulse.owner === "player" ? palette.playerHot : palette.infectedHot;

      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = pulse.kind === "shockwave" ? 4 : 2.6;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, pulse.previousRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawDots(ctx: CanvasRenderingContext2D) {
    const neutral = this.sprites.neutralDot;
    const player = this.sprites.playerDot;
    const infected = this.sprites.infectedDot;
    const contested = this.sprites.contestedDot;

    ctx.save();

    for (const dot of this.dots) {
      const frontline = this.frontline[dot.id] ?? 0;
      const energy = Math.max(dot.energy, dot.enemyEnergy);
      const contest = Math.min(dot.infectionAmount, dot.playerAmount);
      let sprite = neutral;
      let alpha = 0.5 + energy * 0.18;
      let scale = 2.6;

      if (frontline > 0.18 || contest > 0.16) {
        sprite = contested;
        alpha = clamp(0.42 + Math.max(frontline, contest) * 0.5 + energy * 0.2, 0.35, 0.95);
        scale = 3.9;
      } else if (dot.infectionAmount > dot.playerAmount && dot.infectionAmount > 0.08) {
        sprite = infected;
        alpha = clamp(0.36 + dot.infectionAmount * 0.72 + energy * 0.18, 0.34, 1);
        scale = 3.8;
      } else if (dot.playerAmount > 0.08) {
        sprite = player;
        alpha = clamp(0.36 + dot.playerAmount * 0.68 + energy * 0.18, 0.34, 1);
        scale = 3.65;
      }

      const size = Math.max(4, (dot.radius + frontline * 1.2) * scale);
      ctx.globalAlpha = alpha;

      if (sprite) {
        ctx.drawImage(sprite, dot.x - size / 2, dot.y - size / 2, size, size);
      } else {
        ctx.fillStyle = "rgba(154, 163, 178, 0.5)";
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();

    for (const particle of this.particles) {
      const progress = particle.age / particle.duration;
      const alpha = 1 - progress;
      const color = particle.kind === "player" ? palette.playerHot : palette.infectedHot;
      ctx.fillStyle = rgba(color, alpha * 0.78);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, (1.2 + alpha * 2) * particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawDestination(ctx: CanvasRenderingContext2D) {
    ctx.save();

    if (this.destination.active) {
      const targetDistance = distance(this.player.x, this.player.y, this.destination.x, this.destination.y);
      const pulse = 1 + Math.sin(this.destination.pulse * 7) * 0.12;
      const alpha = clamp(0.2 + targetDistance / 420, 0.2, 0.62);
      ctx.strokeStyle = rgba(palette.player, alpha * 0.62);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      ctx.lineTo(this.destination.x, this.destination.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba(palette.playerHot, alpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.destination.x, this.destination.y, 12 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.preview.active) {
      ctx.strokeStyle = rgba(palette.player, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.preview.x, this.preview.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawAgents(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.getActiveEnemies()) {
      this.drawAgent(ctx, enemy);
    }

    this.drawAgent(ctx, this.player);
  }

  private drawAgent(ctx: CanvasRenderingContext2D, agent: Agent) {
    const isPlayer = agent.kind === "player";
    const core = isPlayer ? palette.playerHot : palette.infectedHot;
    const edge = isPlayer ? palette.player : palette.infected;
    const sprite = isPlayer ? this.sprites.playerCore : this.sprites.enemyCore;
    const pulse = 1 + Math.sin(this.time * (isPlayer ? 3.2 : 2.6) + agent.id) * 0.08;
    const radius = agent.radius * pulse;
    const size = radius * 4.1;

    ctx.save();

    if (sprite) {
      ctx.drawImage(sprite, agent.x - size / 2, agent.y - size / 2, size, size);
    } else {
      ctx.fillStyle = rgba(core, 0.9);
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = rgba(edge, agent.slowTimer > 0 ? 0.72 : 0.44);
    ctx.lineWidth = agent.slowTimer > 0 ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.arc(agent.x, agent.y, radius + 7, 0, Math.PI * 2);
    ctx.stroke();

    if (!isPlayer) {
      this.drawEnemyMark(ctx, agent, radius);
    }

    ctx.restore();
  }

  private drawEnemyMark(ctx: CanvasRenderingContext2D, enemy: Agent, radius: number) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.76)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.lineWidth = 1.5;

    if (enemy.type === "tank") {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, radius + 11, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (enemy.type === "root") {
      for (let index = 0; index < 4; index += 1) {
        const angle = index * (Math.PI / 2) + this.time * 0.35;
        ctx.beginPath();
        ctx.moveTo(enemy.x + Math.cos(angle) * (radius * 0.6), enemy.y + Math.sin(angle) * (radius * 0.6));
        ctx.lineTo(enemy.x + Math.cos(angle) * (radius + 11), enemy.y + Math.sin(angle) * (radius + 11));
        ctx.stroke();
      }
      return;
    }

    const satelliteCount = enemy.type === "splitter" ? 2 : enemy.type === "hunter" ? 1 : 3;

    for (let index = 0; index < satelliteCount; index += 1) {
      const angle = this.time * (enemy.type === "hunter" ? 2.4 : 1.7) + index * ((Math.PI * 2) / satelliteCount);
      ctx.beginPath();
      ctx.arc(enemy.x + Math.cos(angle) * (radius + 8), enemy.y + Math.sin(angle) * (radius + 8), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawArenaFrame(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.arenaPath(ctx, this.arena.radius);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 3;
    ctx.stroke();
    this.arenaPath(ctx, this.arena.radius);
    ctx.strokeStyle = "rgba(122, 144, 168, 0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private arenaPath(ctx: CanvasRenderingContext2D, radius: number) {
    const { x, y, width, height } = this.arena;
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
