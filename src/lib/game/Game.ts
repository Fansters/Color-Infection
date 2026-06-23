import { Dot, type DotState, type PointerField } from "./Dot";
import { clamp, distance, randomInt, randomRange, smoothstep } from "./math";

export type GameStatus = "playing" | "won" | "lost";
export type AgentKind = "player" | "enemy";
export type PulseOwner = AgentKind | "neutral";
export type EnemyMode = "expand" | "contest" | "defend" | "attack" | "recover" | "retreat";
export type EnemyType = "spreader" | "hunter" | "tank" | "splitter" | "root";
export type AgentType = "player" | EnemyType;
export type NodeOwner = "neutral" | AgentKind;
export type RippleColor = AgentKind | "shock" | "collision" | "node";
export type PulseKind = "shockwave" | "node" | "enemy";
export type BlockerKind = "wall" | "gate";
export type AIDifficulty = "easy" | "medium" | "hard";

export const MAX_RIPPLES = 30;
export const MAX_PARTICLES = 300;
export const MAX_PULSES = 10;
export const MAX_PULSE_DOT_HITS_PER_FRAME = 80;
export const MAX_PULSE_PARTICLES_PER_FRAME = 40;
const MAX_CONTESTED_ZONES = 18;
const MAX_ENEMIES = 7;
const DOT_GRID_CELL_SIZE = 78;
const SHOCKWAVE_DURATION = 2.85;
const SHIELD_DURATION = 6;
const SHIELD_COOLDOWN = 12;
export const HAZE_SCALE = 0.33;
export const HAZE_FRAME_INTERVAL = 4;

export type Agent = {
  id: number;
  kind: AgentKind;
  team: AgentKind;
  type: AgentType;
  variant: AgentType;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  homeX: number;
  homeY: number;
  baseRadius: number;
  baseFieldRadius: number;
  radius: number;
  fieldRadius: number;
  speed: number;
  moveSpeed: number;
  mass: number;
  spreadPower: number;
  power: number;
  intensity: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  level: number;
  xp: number;
  influenceRadius: number;
  slowTimer: number;
  pulseTimer: number;
  decisionTimer: number;
  lastDecisionInterval: number;
  modeTimer: number;
  mode: EnemyMode;
  selectedTarget: string;
  targetScore: number;
  canMove: boolean;
  canPulse: boolean;
  splitDone: boolean;
  active: boolean;
  isRespawning: boolean;
  respawnTimer: number;
  invulnerableTimer: number;
};

export type CoreBase = {
  id: number;
  team: AgentKind;
  x: number;
  y: number;
  radius: number;
  pulse: number;
};

export type Arena = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  radius: number;
};

export type Ripple = {
  x: number;
  y: number;
  age: number;
  duration: number;
  radius: number;
  color: RippleColor;
};

export type ActivePulse = {
  id: number;
  x: number;
  y: number;
  age: number;
  duration: number;
  lifetime: number;
  currentRadius: number;
  previousRadius: number;
  maxRadius: number;
  speed: number;
  strength: number;
  owner: PulseOwner;
  kind: PulseKind;
  processedDotIds: Set<number>;
  processedEnemyIds: Set<number>;
  pendingDotHits: PulseDotHit[];
  dotsAffected: number;
  particlesSpawned: number;
};

type PulseDotHit = {
  id: number;
  edge: number;
};

export type ControlNode = {
  id: number;
  x: number;
  y: number;
  radius: number;
  owner: NodeOwner;
  captureBy: AgentKind | null;
  captureProgress: number;
  pulseTimer: number;
};

export type ViscosityZone = {
  x: number;
  y: number;
  radius: number;
  strength: number;
  phase: number;
};

export type ArenaBlocker = {
  id: number;
  kind: BlockerKind;
  x: number;
  y: number;
  radius: number;
  openProgress: number;
  phase: number;
};

export type EnergyWell = {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

export type ContestedZone = {
  x: number;
  y: number;
  age: number;
  duration: number;
  radius: number;
};

export type Particle = {
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

type DifficultySettings = {
  decisionInterval: [number, number];
  aggression: number;
  randomness: number;
  badChoiceChance: number;
  nodeFocus: number;
  huntChance: number;
  retreatHealth: number;
  infectionPressure: number;
  clashPressure: number;
  enemyXpRate: number;
};

const DIFFICULTY_SETTINGS: Record<AIDifficulty, DifficultySettings> = {
  easy: {
    decisionInterval: [2, 3],
    aggression: 0.52,
    randomness: 0.48,
    badChoiceChance: 0.22,
    nodeFocus: 0.58,
    huntChance: 0.08,
    retreatHealth: 0.18,
    infectionPressure: 0.9,
    clashPressure: 0.88,
    enemyXpRate: 0.65,
  },
  medium: {
    decisionInterval: [1.2, 1.8],
    aggression: 1,
    randomness: 0.18,
    badChoiceChance: 0.06,
    nodeFocus: 1,
    huntChance: 0.18,
    retreatHealth: 0.32,
    infectionPressure: 1,
    clashPressure: 1,
    enemyXpRate: 1,
  },
  hard: {
    decisionInterval: [0.5, 1],
    aggression: 1.32,
    randomness: 0.08,
    badChoiceChance: 0.015,
    nodeFocus: 1.38,
    huntChance: 0.34,
    retreatHealth: 0.46,
    infectionPressure: 1.1,
    clashPressure: 1.1,
    enemyXpRate: 1.25,
  },
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
  shieldReady: boolean;
  shieldCooldown: number;
  shieldCooldownRemaining: number;
  shieldActive: boolean;
  shieldTimer: number;
  playerLevel: number;
  playerXp: number;
  playerNextLevelXp: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerShield: number;
  playerMaxShield: number;
  playerRespawnTimer: number;
  nodePlayerCount: number;
  nodeEnemyCount: number;
  enemyMode: EnemyMode;
  enemyCount: number;
  enemyTypes: string;
  aiDifficulty: AIDifficulty;
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
  rendererType: string;
  stageChildren: number;
  dotSpriteCount: number;
  activeParticleSpriteCount: number;
  activeEffectObjectCount: number;
  lastShockwaveFrameCost: number;
  lastShockwaveDotsAffected: number;
  lastShockwaveParticlesSpawned: number;
  activePulseQueueLength: number;
  maxFrameMsLast5s: number;
  hazeRebuildMs: number;
  pixiSyncMs: number;
  pulseProcessMs: number;
  playerLevel: number;
  playerXp: number;
  playerHealth: number;
  playerShield: number;
  shieldCooldownRemaining: number;
  shieldTimer: number;
  playerRespawnTimer: number;
  enemyHealthSummary: string;
  aiDifficulty: AIDifficulty;
  aiTargets: string;
  enemyDeaths: number;
  playerDeaths: number;
};

export type PixiRenderMetrics = {
  rendererType: string;
  stageChildren: number;
  dotSpriteCount: number;
  activeParticleSpriteCount: number;
  activeEffectObjectCount: number;
  hazeRebuildMs: number;
  hazeEvery: number;
  pixiSyncMs: number;
};

export type GameRenderState = {
  revision: number;
  width: number;
  height: number;
  time: number;
  arena: Arena;
  dots: Dot[];
  frontline: Float32Array;
  player: Agent;
  enemies: Agent[];
  nodes: ControlNode[];
  viscosityZones: ViscosityZone[];
  blockers: ArenaBlocker[];
  energyWells: EnergyWell[];
  bases: CoreBase[];
  ripples: Ripple[];
  pulses: ActivePulse[];
  contestedZones: ContestedZone[];
  particles: Particle[];
  destination: { active: boolean; x: number; y: number; pulse: number };
  preview: { active: boolean; x: number; y: number };
  shieldTimer: number;
  debugVisible: boolean;
  status: GameStatus;
  paused: boolean;
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
    team: "player",
    type: "player",
    variant: "player",
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    homeX: 0,
    homeY: 0,
    baseRadius: 16,
    baseFieldRadius: 84,
    radius: 16,
    fieldRadius: 84,
    speed: 156,
    moveSpeed: 156,
    mass: 1.1,
    spreadPower: 1,
    power: 28,
    intensity: 1,
    health: 120,
    maxHealth: 120,
    shield: 40,
    maxShield: 40,
    level: 1,
    xp: 0,
    influenceRadius: 84,
    slowTimer: 0,
    pulseTimer: 0,
    decisionTimer: 0,
    lastDecisionInterval: 0,
    modeTimer: 0,
    mode: "expand",
    selectedTarget: "field",
    targetScore: 0,
    canMove: true,
    canPulse: false,
    splitDone: false,
    active: true,
    isRespawning: false,
    respawnTimer: 0,
    invulnerableTimer: 1.2,
  };
}

function createEnemy(type: EnemyType, id: number, config: LevelConfig): Agent {
  const settings = ENEMY_SETTINGS[type];
  const canMove = config.enemyCanMove && settings.canMove;

  return {
    id,
    kind: "enemy",
    team: "enemy",
    type,
    variant: type,
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    homeX: 0,
    homeY: 0,
    baseRadius: settings.radius,
    baseFieldRadius: settings.fieldRadius,
    radius: settings.radius,
    fieldRadius: settings.fieldRadius,
    speed: settings.speed * config.enemySpeedScale,
    moveSpeed: settings.speed * config.enemySpeedScale,
    mass: settings.mass,
    spreadPower: settings.spreadPower,
    power: 24 + settings.spreadPower * 9,
    intensity: 0.96,
    health: 105 + settings.mass * 10,
    maxHealth: 105 + settings.mass * 10,
    shield: 28,
    maxShield: 28,
    level: 1,
    xp: 0,
    influenceRadius: settings.fieldRadius,
    slowTimer: 0,
    pulseTimer: randomRange(settings.pulseEvery[0], settings.pulseEvery[1]),
    decisionTimer: 0,
    lastDecisionInterval: 0,
    modeTimer: 0,
    mode: "expand",
    selectedTarget: "expand",
    targetScore: 0,
    canMove,
    canPulse: config.enemyCanPulse,
    splitDone: false,
    active: true,
    isRespawning: false,
    respawnTimer: 0,
    invulnerableTimer: 1,
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
  private bases: CoreBase[] = [];
  private contestedZones: ContestedZone[] = [];
  private particles: Particle[] = [];
  private dotGrid = new Map<string, number[]>();
  private pulseQueryBuffer: number[] = [];
  private nextPulseId = 1;
  private pulseProcessMs = 0;
  private lastShockwaveFrameCost = 0;
  private lastShockwaveDotsAffected = 0;
  private lastShockwaveParticlesSpawned = 0;
  private activePulseQueueLength = 0;
  private frameMetricClock = 0;
  private frameMetricWindow: Array<{ time: number; frameMs: number }> = [];
  private maxFrameMsLast5s = 0;
  private time = 0;
  private collisionCooldown = 0;
  private shockwaveCharge = 1;
  private shieldTimer = 0;
  private shieldCooldownRemaining = 0;
  private aiDifficulty: AIDifficulty = "medium";
  private playerDeaths = 0;
  private enemyDeaths = 0;
  private renderRevision = 0;
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
    rendererType: "canvas2d",
    stageChildren: 0,
    dotSpriteCount: 0,
    activeParticleSpriteCount: 0,
    activeEffectObjectCount: 0,
    lastShockwaveFrameCost: 0,
    lastShockwaveDotsAffected: 0,
    lastShockwaveParticlesSpawned: 0,
    activePulseQueueLength: 0,
    maxFrameMsLast5s: 0,
    hazeRebuildMs: 0,
    pixiSyncMs: 0,
    pulseProcessMs: 0,
    playerLevel: 1,
    playerXp: 0,
    playerHealth: 120,
    playerShield: 40,
    shieldCooldownRemaining: 0,
    shieldTimer: 0,
    playerRespawnTimer: 0,
    enemyHealthSummary: "none",
    aiDifficulty: "medium",
    aiTargets: "none",
    enemyDeaths: 0,
    playerDeaths: 0,
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
    this.shieldTimer = 0;
    this.shieldCooldownRemaining = 0;
    this.playerDeaths = 0;
    this.enemyDeaths = 0;
    this.ripples = [];
    this.pulses = [];
    this.contestedZones = [];
    this.particles = [];
    this.pulseProcessMs = 0;
    this.lastShockwaveFrameCost = 0;
    this.lastShockwaveDotsAffected = 0;
    this.lastShockwaveParticlesSpawned = 0;
    this.activePulseQueueLength = 0;
    this.frameMetricClock = 0;
    this.frameMetricWindow = [];
    this.maxFrameMsLast5s = 0;
    this.destination.active = false;
    this.preview.active = false;
    this.buildLevel();
  }

  setDifficulty(difficulty: AIDifficulty) {
    this.aiDifficulty = difficulty;

    for (const enemy of this.enemies) {
      enemy.decisionTimer = 0;
      enemy.modeTimer = 0;
    }
  }

  activateShield() {
    if (
      this.paused ||
      this.status !== "playing" ||
      this.player.isRespawning ||
      this.shieldCooldownRemaining > 0 ||
      this.shieldTimer > 0 ||
      this.levelConfig.number < 3
    ) {
      return false;
    }

    this.shieldTimer = SHIELD_DURATION;
    this.shieldCooldownRemaining = SHIELD_COOLDOWN;
    this.player.shield = Math.min(this.player.maxShield + 36, this.player.shield + this.player.maxShield * 0.65 + 24);
    this.addRipple(this.player.x, this.player.y, "player", this.player.radius + 98);
    return true;
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
    if (this.paused || this.status !== "playing" || this.player.isRespawning) {
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
    if (this.paused || this.status !== "playing" || this.player.isRespawning || this.shockwaveCharge < 1) {
      return false;
    }

    this.sacrificePlayerTerritory();
    this.shockwaveCharge = 0;
    this.lastShockwaveFrameCost = 0;
    this.lastShockwaveDotsAffected = 0;
    this.lastShockwaveParticlesSpawned = 0;
    this.addPulse({
      x: this.player.x,
      y: this.player.y,
      owner: "player",
      maxRadius: this.getShockwaveMaxRadius(),
      duration: SHOCKWAVE_DURATION,
      strength: 0.34 * (this.player.level >= 2 ? 1.5 : 1) * (1 + (this.player.level - 1) * 0.08),
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
      this.updateCoreTimers(safeDt);
      this.updateBases(safeDt);
      this.updateGates(safeDt);
      this.updateAgents(safeDt);
      this.resolveCoreCollisions(safeDt);
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
    }

    this.updateRipples(safeDt);
    this.updateContestedZones(safeDt);
    this.updateParticles(safeDt);

    for (const dot of this.dots) {
      dot.updateVisual(safeDt, this.time, this.playerField, this.enemyField);
    }
  }

  recordFrameMetrics(
    frameMs: number,
    updateMs: number,
    drawMs: number,
    dpr: number,
    pixiMetrics?: PixiRenderMetrics,
  ) {
    const fps = frameMs > 0 ? 1000 / frameMs : 0;
    const activeEffectCount =
      this.ripples.length + this.particles.length + this.pulses.length + this.contestedZones.length;
    this.trackFrameWindow(frameMs);

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
      hazeEvery: pixiMetrics?.hazeEvery ?? HAZE_FRAME_INTERVAL,
      enemyCount: this.getActiveEnemies().length,
      level: this.levelConfig.number,
      rendererType: pixiMetrics?.rendererType ?? "canvas2d",
      stageChildren: pixiMetrics?.stageChildren ?? 0,
      dotSpriteCount: pixiMetrics?.dotSpriteCount ?? this.dots.length,
      activeParticleSpriteCount: pixiMetrics?.activeParticleSpriteCount ?? this.particles.length,
      activeEffectObjectCount: pixiMetrics?.activeEffectObjectCount ?? activeEffectCount,
      lastShockwaveFrameCost: this.lastShockwaveFrameCost,
      lastShockwaveDotsAffected: this.lastShockwaveDotsAffected,
      lastShockwaveParticlesSpawned: this.lastShockwaveParticlesSpawned,
      activePulseQueueLength: this.activePulseQueueLength,
      maxFrameMsLast5s: this.maxFrameMsLast5s,
      hazeRebuildMs: pixiMetrics?.hazeRebuildMs ?? 0,
      pixiSyncMs: pixiMetrics?.pixiSyncMs ?? drawMs,
      pulseProcessMs: this.pulseProcessMs,
      playerLevel: this.player.level,
      playerXp: Math.floor(this.player.xp),
      playerHealth: this.player.health,
      playerShield: this.player.shield,
      shieldCooldownRemaining: this.shieldCooldownRemaining,
      shieldTimer: this.shieldTimer,
      playerRespawnTimer: this.player.respawnTimer,
      enemyHealthSummary: this.getEnemyHealthSummary(),
      aiDifficulty: this.aiDifficulty,
      aiTargets: this.getAiTargetSummary(),
      enemyDeaths: this.enemyDeaths,
      playerDeaths: this.playerDeaths,
    };
  }

  getDebugStats(): GameDebugStats {
    return this.debugStats;
  }

  private getEnemyHealthSummary() {
    const enemies = this.enemies;

    if (enemies.length === 0) {
      return "none";
    }

    return enemies
      .map((enemy) => {
        const hp = enemy.isRespawning ? `R${enemy.respawnTimer.toFixed(0)}` : `${Math.round(enemy.health)}/${Math.round(enemy.shield)}`;
        return `${enemy.type[0]}${enemy.id} L${enemy.level} ${hp}`;
      })
      .join(" | ");
  }

  private getAiTargetSummary() {
    const active = this.getActiveEnemies();

    if (active.length === 0) {
      return "none";
    }

    return active
      .map((enemy) => `${enemy.id}:${enemy.mode}:${enemy.selectedTarget}:${enemy.targetScore.toFixed(1)}@${enemy.lastDecisionInterval.toFixed(1)}s`)
      .join(" | ");
  }

  private trackFrameWindow(frameMs: number) {
    this.frameMetricClock += frameMs / 1000;
    this.frameMetricWindow.push({ time: this.frameMetricClock, frameMs });

    const cutoff = this.frameMetricClock - 5;
    while (this.frameMetricWindow.length > 0 && this.frameMetricWindow[0].time < cutoff) {
      this.frameMetricWindow.shift();
    }

    this.maxFrameMsLast5s = this.frameMetricWindow.reduce((max, sample) => Math.max(max, sample.frameMs), 0);
  }

  getRenderState(debugVisible = false): GameRenderState {
    return {
      revision: this.renderRevision,
      width: this.width,
      height: this.height,
      time: this.time,
      arena: this.arena,
      dots: this.dots,
      frontline: this.frontline,
      player: this.player,
      enemies: this.getActiveEnemies(),
      nodes: this.nodes,
      viscosityZones: this.viscosityZones,
      blockers: this.blockers,
      energyWells: this.energyWells,
      bases: this.bases,
      ripples: this.ripples,
      pulses: this.pulses,
      contestedZones: this.contestedZones,
      particles: this.particles,
      destination: this.destination,
      preview: this.preview,
      shieldTimer: this.shieldTimer,
      debugVisible,
      status: this.status,
      paused: this.paused,
    };
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
      shieldReady:
        this.levelConfig.number >= 3 &&
        this.shieldCooldownRemaining <= 0 &&
        this.shieldTimer <= 0 &&
        !this.player.isRespawning,
      shieldCooldown: SHIELD_COOLDOWN,
      shieldCooldownRemaining: Math.max(0, this.shieldCooldownRemaining),
      shieldActive: this.shieldTimer > 0,
      shieldTimer: Math.max(0, this.shieldTimer),
      playerLevel: this.player.level,
      playerXp: Math.floor(this.player.xp),
      playerNextLevelXp: this.getNextLevelXp(this.player.level),
      playerHealth: Math.max(0, this.player.health),
      playerMaxHealth: this.player.maxHealth,
      playerShield: Math.max(0, this.player.shield),
      playerMaxShield: this.player.maxShield,
      playerRespawnTimer: Math.max(0, this.player.respawnTimer),
      nodePlayerCount: this.nodes.filter((node) => node.owner === "player").length,
      nodeEnemyCount: this.nodes.filter((node) => node.owner === "enemy").length,
      enemyMode: primaryEnemy?.mode ?? "expand",
      enemyCount: activeEnemies.length,
      enemyTypes: activeEnemies.map((enemy) => enemy.type).join(", ") || "none",
      aiDifficulty: this.aiDifficulty,
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

  private getDifficultySettings() {
    return DIFFICULTY_SETTINGS[this.aiDifficulty];
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
    this.rebuildDotGrid();

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
    this.renderRevision += 1;
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
    this.player.baseX = playerPosition.x;
    this.player.baseY = playerPosition.y;
    this.player.fieldRadius = clamp(Math.min(this.width, this.height) * 0.11, 72, 102);
    this.player.baseFieldRadius = this.player.fieldRadius;
    this.player.speed = this.width < 720 ? 118 : 156;
    this.player.moveSpeed = this.player.speed;
    this.applyCoreLevelStats(this.player, true);

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
      enemy.baseX = position.x;
      enemy.baseY = position.y;
      enemy.fieldRadius = clamp(enemy.fieldRadius * (this.width < 720 ? 0.82 : 1), 56, 124);
      enemy.baseFieldRadius = enemy.fieldRadius;
      enemy.speed *= this.width < 720 ? 0.78 : 1;
      enemy.moveSpeed = enemy.speed;
      this.applyCoreLevelStats(enemy, true);
      return enemy;
    });
    this.createBases();
  }

  private createBases() {
    this.bases = [
      {
        id: 0,
        team: "player",
        x: this.player.baseX,
        y: this.player.baseY,
        radius: this.player.radius + 36,
        pulse: randomRange(0, Math.PI * 2),
      },
      ...this.enemies.map((enemy) => ({
        id: enemy.id,
        team: "enemy" as const,
        x: enemy.baseX,
        y: enemy.baseY,
        radius: enemy.radius + 34,
        pulse: randomRange(0, Math.PI * 2),
      })),
    ];
  }

  private applyCoreLevelStats(agent: Agent, refill = false) {
    const level = clamp(Math.round(agent.level), 1, 5);
    const healthRatio = agent.maxHealth > 0 ? agent.health / agent.maxHealth : 1;
    const shieldRatio = agent.maxShield > 0 ? agent.shield / agent.maxShield : 1;

    if (agent.kind === "player") {
      const radiusScale = [1, 1.55, 1.72, 1.9, 2.08][level - 1];
      const healthScale = [1, 1.18, 1.5, 1.72, 2.05][level - 1];
      const shieldScale = [1, 1.16, 1.35, 1.55, 1.82][level - 1];
      const fieldScale = [1, 1.12, 1.22, 1.34, 1.52][level - 1];
      const speedScale = level >= 5 ? 0.9 : 1;
      agent.radius = agent.baseRadius * radiusScale;
      agent.fieldRadius = agent.baseFieldRadius * fieldScale;
      agent.influenceRadius = agent.fieldRadius;
      agent.maxHealth = 120 * healthScale;
      agent.maxShield = 40 * shieldScale;
      agent.mass = 1.1 + level * 0.34;
      agent.power = 28 + level * 11;
      agent.spreadPower = 1 + level * 0.12;
      agent.speed = agent.moveSpeed * speedScale;
    } else {
      const settings = ENEMY_SETTINGS[agent.type as EnemyType];
      const radiusScale = 1 + (level - 1) * 0.12;
      const healthScale = 1 + (level - 1) * 0.22;
      const shieldScale = 1 + (level - 1) * 0.17;
      agent.radius = agent.baseRadius * radiusScale;
      agent.fieldRadius = agent.baseFieldRadius * (1 + (level - 1) * 0.08);
      agent.influenceRadius = agent.fieldRadius;
      agent.maxHealth = (105 + settings.mass * 10) * healthScale;
      agent.maxShield = 28 * shieldScale;
      agent.mass = settings.mass * (1 + (level - 1) * 0.13);
      agent.power = 24 + settings.spreadPower * 9 + level * 8;
      agent.spreadPower = settings.spreadPower * (1 + (level - 1) * 0.08);
      agent.speed = agent.moveSpeed * (agent.type === "tank" ? 0.96 : 1);
    }

    if (refill) {
      agent.health = agent.maxHealth;
      agent.shield = agent.maxShield;
    } else {
      agent.health = clamp(agent.maxHealth * healthRatio, 1, agent.maxHealth);
      agent.shield = clamp(agent.maxShield * shieldRatio, 0, agent.maxShield);
    }
  }

  private getNextLevelXp(level: number) {
    return [0, 80, 190, 340, 540, Number.POSITIVE_INFINITY][clamp(level, 1, 5)] ?? Number.POSITIVE_INFINITY;
  }

  private grantPlayerXp(amount: number) {
    if (amount <= 0 || this.player.level >= 5) {
      this.player.xp += Math.max(0, amount);
      return;
    }

    this.player.xp += amount;

    while (this.player.level < 5 && this.player.xp >= this.getNextLevelXp(this.player.level)) {
      this.player.level += 1;
      this.applyCoreLevelStats(this.player);
      this.player.health = this.player.maxHealth;
      this.player.shield = this.player.maxShield;
      this.addRipple(this.player.x, this.player.y, "player", this.player.radius + 132);
      this.spawnBurst(this.player.x, this.player.y, "player", 34, 1.55);
      this.createBases();
    }
  }

  private maybeLevelEnemy(enemy: Agent, xp: number) {
    if (enemy.level >= 5) {
      return;
    }

    enemy.xp += xp;

    if (enemy.xp >= this.getNextLevelXp(enemy.level) * 0.9) {
      enemy.level += 1;
      this.applyCoreLevelStats(enemy);
      enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.maxHealth * 0.32);
      enemy.shield = Math.min(enemy.maxShield, enemy.shield + enemy.maxShield * 0.5);
      this.addRipple(enemy.x, enemy.y, "enemy", enemy.radius + 96);
      this.createBases();
    }
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

  private updateCoreTimers(dt: number) {
    this.shieldCooldownRemaining = Math.max(0, this.shieldCooldownRemaining - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);

    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer = Math.max(0, this.player.invulnerableTimer - dt);
    }

    if (this.player.isRespawning) {
      this.player.respawnTimer = Math.max(0, this.player.respawnTimer - dt);

      if (this.player.respawnTimer <= 0) {
        this.respawnCore(this.player);
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.invulnerableTimer > 0) {
        enemy.invulnerableTimer = Math.max(0, enemy.invulnerableTimer - dt);
      }

      if (!enemy.isRespawning) {
        this.maybeLevelEnemy(enemy, dt * this.getDifficultySettings().enemyXpRate * (0.55 + this.nodes.filter((node) => node.owner === "enemy").length * 0.12));
        continue;
      }

      enemy.respawnTimer = Math.max(0, enemy.respawnTimer - dt);

      if (enemy.respawnTimer <= 0) {
        this.respawnCore(enemy);
      }
    }
  }

  private updateBases(dt: number) {
    for (const base of this.bases) {
      base.pulse += dt;
    }

    const playerBaseDistance = distance(this.player.x, this.player.y, this.player.baseX, this.player.baseY);

    if (!this.player.isRespawning && playerBaseDistance < this.player.radius + 72) {
      this.player.shield = clamp(this.player.shield + dt * this.player.maxShield * 0.18, 0, this.player.maxShield);
    }

    for (const enemy of this.getActiveEnemies()) {
      const baseDistance = distance(enemy.x, enemy.y, enemy.baseX, enemy.baseY);

      if (baseDistance < enemy.radius + 70) {
        enemy.shield = clamp(enemy.shield + dt * enemy.maxShield * 0.16, 0, enemy.maxShield);
      }
    }
  }

  private updateAgents(dt: number) {
    this.updateEnemyBrain(dt);
    if (!this.player.isRespawning) {
      this.moveAgent(this.player, dt);
    } else {
      this.player.velocityX = 0;
      this.player.velocityY = 0;
    }

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
    if (!agent.active || agent.isRespawning) {
      agent.velocityX = 0;
      agent.velocityY = 0;
      return;
    }

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

      const settings = this.getDifficultySettings();
      const roleSpeed = enemy.type === "hunter" ? 0.78 : enemy.type === "tank" ? 1.18 : 1;
      enemy.decisionTimer = randomRange(settings.decisionInterval[0], settings.decisionInterval[1]) * roleSpeed;
      enemy.lastDecisionInterval = enemy.decisionTimer;
      const target = this.chooseEnemyTarget(enemy);
      enemy.targetX = target.x;
      enemy.targetY = target.y;
    }
  }

  private chooseEnemyMode(enemy: Agent) {
    const allowed = this.levelConfig.enemyModes;
    const difficulty = this.getDifficultySettings();
    const playerNearEnemyHome = this.sampleInfluence(enemy.homeX, enemy.homeY, enemy.fieldRadius * 1.25).player;
    const currentEnemySample = this.sampleInfluence(enemy.x, enemy.y, enemy.fieldRadius);
    const healthRatio = enemy.health / Math.max(1, enemy.maxHealth);
    const playerWeak =
      this.player.health / Math.max(1, this.player.maxHealth) < 0.44 ||
      this.sampleInfluence(this.player.x, this.player.y, this.player.fieldRadius).player < 0.24;
    const attackChance =
      (enemy.type === "hunter" ? 0.24 : enemy.type === "splitter" ? 0.16 : 0.08) *
      difficulty.aggression *
      (playerWeak ? 1.9 : 1);
    const shouldAttack = allowed.includes("attack") && Math.random() < attackChance && this.elapsedSeconds > 18;
    const canContest = allowed.includes("contest") && this.findBestFrontlineDot(enemy);

    if (healthRatio < difficulty.retreatHealth) {
      enemy.mode = healthRatio < 0.22 ? "retreat" : "recover";
      enemy.modeTimer = randomRange(1.4, 2.5);
    } else if (allowed.includes("defend") && (playerNearEnemyHome > 0.2 || currentEnemySample.player > 0.55)) {
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
    const difficulty = this.getDifficultySettings();
    const arenaDiagonal = Math.hypot(this.arena.width, this.arena.height);
    const healthRatio = enemy.health / Math.max(1, enemy.maxHealth);
    const playerHealthRatio = this.player.health / Math.max(1, this.player.maxHealth);
    const playerTerritory = this.sampleInfluence(this.player.x, this.player.y, this.player.fieldRadius).player;
    const playerWeaknessValue = (1 - playerHealthRatio) * 2 + (playerTerritory < 0.22 ? 0.8 : 0);
    const candidates: Array<{ x: number; y: number; label: string; score: number }> = [];

    const addCandidate = (x: number, y: number, label: string, value: number) => {
      const target = this.findOpenPoint(x, y, enemy.radius + 10);
      const targetSample = this.sampleInfluence(target.x, target.y, enemy.fieldRadius * 0.75);
      const targetDistance = distance(enemy.x, enemy.y, target.x, target.y);
      const distanceCost = targetDistance / Math.max(1, arenaDiagonal) * 2.1;
      const safetyValue = targetSample.infection * 0.95 - targetSample.player * (enemy.type === "tank" ? 0.35 : 0.9);
      const supportValue = this.countNearbyEnemies(target.x, target.y, enemy.fieldRadius * 1.4, enemy.id) * 0.28;
      candidates.push({
        x: target.x,
        y: target.y,
        label,
        score: value + safetyValue + supportValue - distanceCost + randomRange(-difficulty.randomness, difficulty.randomness),
      });
    };

    addCandidate(enemy.baseX, enemy.baseY, healthRatio < 0.22 ? "retreat:base" : "recover:base", healthRatio < difficulty.retreatHealth ? 4.4 : 0.7);

    for (const node of this.nodes) {
      if (node.owner === "enemy" && enemy.mode !== "defend" && healthRatio > 0.38) {
        continue;
      }

      const nodeValue =
        node.owner === "player"
          ? 3.2
          : node.owner === "neutral"
            ? 2.1
            : 1.5 + (enemy.mode === "defend" ? 1.5 : 0);
      const roleBonus =
        enemy.type === "hunter" && node.owner === "player"
          ? 0.9
          : enemy.type === "tank" && node.owner === "enemy"
            ? 1.1
            : enemy.type === "spreader" && node.owner === "neutral"
              ? 0.75
              : 0;

      if (this.aiDifficulty === "easy" && node.owner === "neutral" && Math.random() > difficulty.nodeFocus) {
        continue;
      }

      addCandidate(node.x, node.y, `${node.owner}:node`, nodeValue * difficulty.nodeFocus + roleBonus);
    }

    const frontier = this.findBestFrontlineDot(enemy);
    if (frontier) {
      const roleBonus = enemy.type === "tank" ? 1.1 : enemy.type === "spreader" ? 0.65 : 0.25;
      addCandidate(frontier.baseX, frontier.baseY, "contest:frontier", 2.5 + roleBonus + (enemy.mode === "contest" ? 1.1 : 0));
    }

    const expand = this.findBestDot((dot) => {
      const neutralValue = (1 - dot.infectionAmount) * (1 - dot.playerAmount);
      const exposedBlue = dot.playerAmount * (1 - dot.infectionAmount);
      const roleBonus =
        enemy.type === "spreader"
          ? neutralValue * 1.2
          : enemy.type === "hunter"
            ? exposedBlue * 1.1
            : enemy.type === "splitter"
              ? exposedBlue * 0.85
              : 0;
      return neutralValue * 1.8 + exposedBlue * 1.35 + roleBonus - distance(enemy.x, enemy.y, dot.baseX, dot.baseY) / 580;
    });

    if (expand) {
      addCandidate(expand.baseX, expand.baseY, "expand:cluster", 2.2 + (enemy.mode === "expand" ? 0.8 : 0));
    }

    if (this.levelConfig.number >= 3 && this.elapsedSeconds > 18 && !this.player.isRespawning) {
      const favorableFight =
        healthRatio > playerHealthRatio + 0.08 ||
        this.sampleInfluence(enemy.x, enemy.y, enemy.fieldRadius).infection > 0.38 ||
        enemy.type === "hunter";
      const huntAllowed = Math.random() < difficulty.huntChance || enemy.mode === "attack";

      if (favorableFight && huntAllowed) {
        const roleBonus = enemy.type === "hunter" ? 1.4 : enemy.type === "splitter" ? 0.7 : -0.1;
        addCandidate(
          this.player.x,
          this.player.y,
          "attack:player",
          1.6 + playerWeaknessValue * difficulty.aggression + roleBonus,
        );
      }
    }

    if (this.levelConfig.number >= 6 && difficulty.aggression > 0.9) {
      addCandidate(this.player.baseX, this.player.baseY, "pressure:player-base", 1.2 * difficulty.aggression);
    }

    if (candidates.length === 0) {
      const fallback = this.findOpenPoint(enemy.baseX, enemy.baseY, enemy.radius + 10);
      enemy.selectedTarget = "fallback:base";
      enemy.targetScore = 0;
      return fallback;
    }

    candidates.sort((a, b) => b.score - a.score);
    const selected =
      Math.random() < difficulty.badChoiceChance
        ? candidates[Math.min(candidates.length - 1, randomInt(0, Math.min(2, candidates.length - 1)))]
        : candidates[0];

    enemy.selectedTarget = selected.label;
    enemy.targetScore = selected.score;

    if (selected.label.includes("player")) {
      enemy.mode = "attack";
    } else if (selected.label.includes("frontier")) {
      enemy.mode = "contest";
    } else if (selected.label.includes("base") && healthRatio < difficulty.retreatHealth) {
      enemy.mode = "retreat";
    } else if (selected.label.includes("node") && selected.label.startsWith("enemy")) {
      enemy.mode = "defend";
    } else if (selected.label.includes("node") || selected.label.includes("cluster")) {
      enemy.mode = "expand";
    }

    return { x: selected.x, y: selected.y };
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

  private countNearbyEnemies(x: number, y: number, radius: number, exceptId: number) {
    let count = 0;

    for (const enemy of this.getActiveEnemies()) {
      if (enemy.id === exceptId) {
        continue;
      }

      if (distance(x, y, enemy.x, enemy.y) <= radius) {
        count += 1;
      }
    }

    return count;
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

  private resolveCoreCollisions(dt: number) {
    for (const enemy of this.getActiveEnemies()) {
      if (!this.player.isRespawning) {
        this.resolveAgentPairCollision(this.player, enemy, true, dt);
      }
    }

    const enemies = this.getActiveEnemies();

    for (let i = 0; i < enemies.length; i += 1) {
      for (let j = i + 1; j < enemies.length; j += 1) {
        this.resolveAgentPairCollision(enemies[i], enemies[j], false, dt);
      }
    }
  }

  private resolveAgentPairCollision(a: Agent, b: Agent, isPlayerEnemy: boolean, dt: number) {
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

    if (isPlayerEnemy) {
      this.applyClashDamage(a, b, dt);
    }
  }

  private applyClashDamage(player: Agent, enemy: Agent, dt: number) {
    if (
      player.invulnerableTimer > 0 ||
      enemy.invulnerableTimer > 0 ||
      player.isRespawning ||
      enemy.isRespawning
    ) {
      return;
    }

    const playerPower = this.getCombatPower(player, enemy);
    const enemyPower = this.getCombatPower(enemy, player) * this.getDifficultySettings().clashPressure;
    const clashScale = dt * 0.016;
    this.applyCoreDamage(enemy, playerPower * clashScale, player);
    this.applyCoreDamage(player, enemyPower * clashScale, enemy);
  }

  private getCombatPower(agent: Agent, opponent: Agent) {
    const sample = this.sampleInfluence(agent.x, agent.y, agent.fieldRadius * 0.72);
    const ownTerritory = agent.kind === "player" ? sample.player : sample.infection;
    const enemyTerritory = agent.kind === "player" ? sample.infection : sample.player;
    const territoryBonus = ownTerritory > 0.45 ? 1.15 : enemyTerritory > 0.45 ? 0.85 : 1;
    const nodeCount = this.nodes.filter((node) => node.owner === agent.kind).length;
    const nodeBonus = 1 + nodeCount * 0.035;
    const shieldBonus = agent.shield > agent.maxShield * 0.45 ? 1.08 : 1;
    const healthPressure = opponent.health < opponent.maxHealth * 0.35 ? 1.08 : 1;
    return (agent.power + agent.level * 10) * territoryBonus * nodeBonus * shieldBonus * healthPressure;
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
          if (capturer === "player") {
            this.grantPlayerXp(45);
          } else {
            for (const enemy of this.getActiveEnemies()) {
              if (distance(enemy.x, enemy.y, node.x, node.y) < enemy.fieldRadius + node.radius + 20) {
                this.maybeLevelEnemy(enemy, 28 * this.getDifficultySettings().enemyXpRate);
              }
            }
          }
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
      duration: 1.45,
      strength: isPlayer ? 0.24 : 0.21,
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
      duration: 1.55,
      strength: power,
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
    const started = typeof performance !== "undefined" ? performance.now() : 0;
    let dotBudget = MAX_PULSE_DOT_HITS_PER_FRAME;
    let particleBudget = MAX_PULSE_PARTICLES_PER_FRAME;
    let shockwaveProcessedThisFrame = false;

    for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.pulses[index];
      pulse.age += dt;

      if (pulse.currentRadius < pulse.maxRadius) {
        pulse.previousRadius = pulse.currentRadius;
        pulse.currentRadius = Math.min(pulse.maxRadius, pulse.currentRadius + pulse.speed * dt);
        this.queuePulseDotHits(pulse);
        this.applyPulseToEnemies(pulse);
      } else {
        pulse.previousRadius = pulse.currentRadius;
      }

      while (pulse.pendingDotHits.length > 0 && dotBudget > 0) {
        const hit = pulse.pendingDotHits.shift();

        if (!hit) {
          break;
        }

        const spawnedParticle = this.applyPulseDotHit(pulse, hit, particleBudget > 0);
        pulse.dotsAffected += 1;
        dotBudget -= 1;

        if (spawnedParticle) {
          pulse.particlesSpawned += 1;
          particleBudget -= 1;
        }
      }

      if (pulse.kind === "shockwave") {
        shockwaveProcessedThisFrame = true;
        this.lastShockwaveDotsAffected = pulse.dotsAffected;
        this.lastShockwaveParticlesSpawned = pulse.particlesSpawned;
      }

      if (pulse.currentRadius >= pulse.maxRadius && pulse.pendingDotHits.length === 0 && pulse.age >= pulse.lifetime) {
        this.pulses.splice(index, 1);
      }
    }

    this.activePulseQueueLength = this.pulses.reduce((total, pulse) => total + pulse.pendingDotHits.length, 0);
    this.pulseProcessMs = started > 0 ? performance.now() - started : 0;

    if (shockwaveProcessedThisFrame) {
      this.lastShockwaveFrameCost = this.pulseProcessMs;
    }
  }

  private queuePulseDotHits(pulse: ActivePulse) {
    const band = this.getPulseBand(pulse);
    const innerRadius = Math.max(0, pulse.previousRadius - band);
    const outerRadius = Math.min(pulse.maxRadius + band, pulse.currentRadius + band);
    const candidates = this.queryDotsInRadius(pulse.x, pulse.y, outerRadius, innerRadius, this.pulseQueryBuffer);

    for (const dotId of candidates) {
      if (pulse.processedDotIds.has(dotId)) {
        continue;
      }

      const dot = this.dots[dotId];
      const waveDistance = dot.distanceTo(pulse.x, pulse.y);
      const edge = 1 - clamp(Math.abs(waveDistance - pulse.currentRadius) / band, 0, 1);

      if (edge <= 0.02) {
        continue;
      }

      pulse.processedDotIds.add(dotId);
      pulse.pendingDotHits.push({ id: dotId, edge });
    }
  }

  private applyPulseDotHit(pulse: ActivePulse, hit: PulseDotHit, canSpawnParticle: boolean) {
    const dot = this.dots[hit.id];
    const power = hit.edge * pulse.strength;

    if (pulse.owner === "player") {
      dot.infectionAmount = clamp(dot.infectionAmount - power, 0, 1);
      dot.playerAmount = clamp(dot.playerAmount + power * 0.92, 0, 1);

      if (pulse.kind === "shockwave" && this.player.level >= 4) {
        dot.playerAmount = clamp(dot.playerAmount + hit.edge * 0.08, 0, 1);
      }
    } else if (pulse.owner === "enemy") {
      dot.infectionAmount = clamp(dot.infectionAmount + power, 0, 1);
      dot.playerAmount = clamp(dot.playerAmount - power * 0.7, 0, 1);
    }

    if (!canSpawnParticle || pulse.owner === "neutral") {
      return false;
    }

    const chance =
      pulse.kind === "shockwave"
        ? 0.1 + hit.edge * 0.12
        : pulse.kind === "node"
          ? 0.04 + hit.edge * 0.08
          : 0.035 + hit.edge * 0.07;

    if (Math.random() > chance) {
      return false;
    }

    this.addParticle(dot.x, dot.y, pulse.owner, pulse.kind === "shockwave" ? 1.45 : 1.16);
    return true;
  }

  private applyPulseToEnemies(pulse: ActivePulse) {
    if (pulse.owner !== "player") {
      return;
    }

    const band = this.getPulseBand(pulse);

    for (const enemy of this.getActiveEnemies()) {
      if (pulse.processedEnemyIds.has(enemy.id)) {
        continue;
      }

      const waveDistance = distance(pulse.x, pulse.y, enemy.x, enemy.y);

      if (waveDistance < pulse.previousRadius - band || waveDistance > pulse.currentRadius + band) {
        continue;
      }

      const edge = 1 - clamp(Math.abs(waveDistance - pulse.currentRadius) / band, 0, 1);

      if (edge <= 0.02) {
        continue;
      }

      pulse.processedEnemyIds.add(enemy.id);
      this.damageEnemy(enemy, edge * (pulse.kind === "shockwave" ? 0.42 : 0.18));
      enemy.slowTimer = Math.max(enemy.slowTimer, pulse.kind === "shockwave" ? 1.1 : 0.42);

      if (pulse.kind === "shockwave" && enemy.canMove) {
        const dx = enemy.x - pulse.x;
        const dy = enemy.y - pulse.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const push = 52 + edge * 68;
        const target = this.clampToArena(enemy.x + (dx / length) * push, enemy.y + (dy / length) * push, enemy.radius + 10);
        enemy.targetX = target.x;
        enemy.targetY = target.y;
      }
    }
  }

  private getPulseBand(pulse: ActivePulse) {
    return pulse.kind === "shockwave" ? 48 : 34;
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
          this.grantPlayerXp(2.4);
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
    this.applyCoreDamage(enemy, amount * 42, this.player);

    if (enemy.type === "splitter" && !enemy.splitDone && enemy.health <= enemy.maxHealth * 0.55 && enemy.active) {
      this.splitEnemy(enemy);
    }
  }

  private applyCoreDamage(target: Agent, amount: number, source?: Agent) {
    if (amount <= 0 || target.invulnerableTimer > 0 || target.isRespawning || !target.active) {
      return;
    }

    const shieldDamageReduction = target.kind === "player" && this.shieldTimer > 0 ? 0.58 : 1;
    let remaining = amount * shieldDamageReduction;

    if (target.shield > 0) {
      const shieldHit = Math.min(target.shield, remaining);
      target.shield -= shieldHit;
      remaining -= shieldHit;
    }

    if (remaining > 0) {
      target.health = clamp(target.health - remaining, 0, target.maxHealth);
    }

    if (target.health > 0) {
      return;
    }

    if (target.kind === "player") {
      this.destroyPlayerCore();
    } else {
      this.destroyEnemyCore(target, source?.kind === "player");
    }
  }

  private destroyEnemyCore(enemy: Agent, killedByPlayer = true) {
    if (enemy.isRespawning) {
      return;
    }

    enemy.active = false;
    enemy.isRespawning = true;
    enemy.respawnTimer = randomRange(5, 8);
    enemy.velocityX = 0;
    enemy.velocityY = 0;
    enemy.targetX = enemy.baseX;
    enemy.targetY = enemy.baseY;
    enemy.health = 0;
    enemy.shield = 0;
    this.enemyDeaths += 1;
    this.addRipple(enemy.x, enemy.y, "enemy", enemy.radius + 118);
    this.spawnBurst(enemy.x, enemy.y, "enemy", 42, 1.55);
    this.neutralizeNearbyDots(enemy.x, enemy.y, enemy.fieldRadius * 0.85, "enemy", 0.34);

    if (killedByPlayer) {
      this.grantPlayerXp(110 + enemy.level * 38);
    }
  }

  private destroyPlayerCore() {
    if (this.player.isRespawning) {
      return;
    }

    this.playerDeaths += 1;
    this.player.active = false;
    this.player.isRespawning = true;
    this.player.respawnTimer = 4;
    this.player.velocityX = 0;
    this.player.velocityY = 0;
    this.player.health = 0;
    this.player.shield = 0;
    this.destination.active = false;
    this.shieldTimer = 0;
    this.shieldCooldownRemaining = Math.max(this.shieldCooldownRemaining, 4);
    this.shockwaveCharge = Math.max(0.35, this.shockwaveCharge * 0.5);
    this.addRipple(this.player.x, this.player.y, "player", this.player.radius + 124);
    this.spawnBurst(this.player.x, this.player.y, "player", 38, 1.45);
    this.penalizePlayerTerritory();
  }

  private respawnCore(core: Agent) {
    core.active = true;
    core.isRespawning = false;
    core.respawnTimer = 0;
    core.invulnerableTimer = core.kind === "player" ? 2.4 : 1.8;
    core.x = core.baseX;
    core.y = core.baseY;
    core.targetX = core.baseX;
    core.targetY = core.baseY;
    core.health = core.kind === "player" ? core.maxHealth : core.maxHealth * 0.72;
    core.shield = core.maxShield * (core.kind === "player" ? 0.72 : 0.58);
    this.addRipple(core.x, core.y, core.kind, core.radius + 108);
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
      child.x = position.x;
      child.y = position.y;
      child.targetX = position.x;
      child.targetY = position.y;
      child.homeX = position.x;
      child.homeY = position.y;
      child.baseX = position.x;
      child.baseY = position.y;
      child.canPulse = false;
      this.applyCoreLevelStats(child, true);
      child.health = child.maxHealth * 0.62;
      child.shield = child.maxShield * 0.35;
      this.enemies.push(child);
      this.addRipple(child.x, child.y, "enemy", 54);
    }

    this.addContestedZone(enemy.x, enemy.y, 88);
    this.createBases();
  }

  private infectWithEnemies(dt: number) {
    const overtime = this.getOvertimePressure();
    const difficultyPressure = this.getDifficultySettings().infectionPressure;

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
          influence *
          dt *
          0.66 *
          enemy.spreadPower *
          territoryModifier *
          overtime *
          difficultyPressure *
          (1 + localViscosity * 0.9);
        const before = dot.infectionAmount;

        dot.infectionAmount = clamp(dot.infectionAmount + infectionPower, 0, 1);
        dot.playerAmount = clamp(dot.playerAmount - infectionPower * 0.78, 0, 1);

        if (before < 0.52 && dot.infectionAmount >= 0.58) {
          this.maybeLevelEnemy(enemy, 0.9 * this.getDifficultySettings().enemyXpRate);
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
        dot.infectionAmount *
        dt *
        0.04 *
        (1 + viscosity) *
        this.getOvertimePressure() *
        this.levelConfig.infectionSpreadScale *
        this.getDifficultySettings().infectionPressure;

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
    strength,
    kind,
  }: {
    x: number;
    y: number;
    owner: PulseOwner;
    maxRadius: number;
    duration: number;
    strength: number;
    kind: PulseKind;
  }) {
    while (this.pulses.length >= MAX_PULSES) {
      this.pulses.shift();
    }

    const lifetime = Math.max(0.4, duration);

    this.pulses.push({
      id: this.nextPulseId,
      x,
      y,
      age: 0,
      duration: lifetime,
      lifetime,
      currentRadius: 0,
      previousRadius: 0,
      maxRadius,
      speed: maxRadius / lifetime,
      owner,
      strength,
      kind,
      processedDotIds: new Set<number>(),
      processedEnemyIds: new Set<number>(),
      pendingDotHits: [],
      dotsAffected: 0,
      particlesSpawned: 0,
    });
    this.nextPulseId += 1;
  }

  private getShockwaveMaxRadius() {
    const arenaRadius = Math.max(this.arena.width, this.arena.height) * 0.52;
    return this.width < 720 ? clamp(arenaRadius, 260, 390) : clamp(arenaRadius, 480, 760);
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

  private spawnBurst(x: number, y: number, kind: AgentKind, count: number, size = 1) {
    const capped = Math.max(0, Math.min(count, 54, MAX_PARTICLES - this.particles.length));

    for (let index = 0; index < capped; index += 1) {
      this.addParticle(x + randomRange(-8, 8), y + randomRange(-8, 8), kind, randomRange(size * 0.75, size * 1.35));
    }
  }

  private neutralizeNearbyDots(x: number, y: number, radius: number, team: AgentKind, strength: number) {
    const ids = this.queryDotsInRadius(x, y, radius, 0, this.pulseQueryBuffer);

    for (const dotId of ids) {
      const dot = this.dots[dotId];
      const dotDistance = dot.distanceTo(x, y);
      const influence = smoothstep(radius, 0, dotDistance) * strength;

      if (team === "enemy") {
        dot.infectionAmount = clamp(dot.infectionAmount - influence, 0, 1);
      } else {
        dot.playerAmount = clamp(dot.playerAmount - influence, 0, 1);
      }
    }
  }

  private penalizePlayerTerritory() {
    const playerDots = this.dots
      .filter((dot) => dot.playerAmount > 0.42 && dot.infectionAmount < 0.45)
      .sort((a, b) => a.playerAmount - b.playerAmount);
    const count = Math.ceil(playerDots.length * 0.06);

    for (let index = 0; index < count; index += 1) {
      const dot = playerDots[index];
      dot.playerAmount *= 0.25;
      dot.infectionAmount = Math.min(dot.infectionAmount, 0.2);
      dot.state = "neutral";
    }
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

  private rebuildDotGrid() {
    this.dotGrid.clear();

    for (const dot of this.dots) {
      const key = this.getDotGridKey(dot.baseX, dot.baseY);
      const bucket = this.dotGrid.get(key);

      if (bucket) {
        bucket.push(dot.id);
      } else {
        this.dotGrid.set(key, [dot.id]);
      }
    }
  }

  private queryDotsInRadius(x: number, y: number, outerRadius: number, innerRadius: number, out: number[]) {
    out.length = 0;
    const minCellX = Math.floor((x - outerRadius) / DOT_GRID_CELL_SIZE);
    const maxCellX = Math.floor((x + outerRadius) / DOT_GRID_CELL_SIZE);
    const minCellY = Math.floor((y - outerRadius) / DOT_GRID_CELL_SIZE);
    const maxCellY = Math.floor((y + outerRadius) / DOT_GRID_CELL_SIZE);
    const outerRadiusSq = outerRadius * outerRadius;
    const innerRadiusSq = innerRadius * innerRadius;

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const bucket = this.dotGrid.get(`${cellX}:${cellY}`);

        if (!bucket) {
          continue;
        }

        for (const dotId of bucket) {
          const dot = this.dots[dotId];
          const dx = dot.baseX - x;
          const dy = dot.baseY - y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq >= innerRadiusSq && distanceSq <= outerRadiusSq) {
            out.push(dotId);
          }
        }
      }
    }

    return out;
  }

  private getDotGridKey(x: number, y: number) {
    return `${Math.floor(x / DOT_GRID_CELL_SIZE)}:${Math.floor(y / DOT_GRID_CELL_SIZE)}`;
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
}
