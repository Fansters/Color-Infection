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
export type CombatState = "idle" | "contact" | "clash" | "overpower" | "break";
export type ParticleKind = AgentKind | "clashPlayer" | "clashEnemy" | "clashEven";
export type RecoveryState = "combat" | "recoveryDelay" | "regenOwnTerritory" | "regenBase" | "noSupply";
export type TerritorySupply = "own" | "enemy" | "neutral" | "base" | "miniBase";
export type UpgradeChoiceId = "power" | "shield" | "speed";
export type BotRole = "capturer" | "defender" | "hunter" | "interceptor" | "support";
export type AIGoalType =
  | "captureNeutralBase"
  | "capturePlayerOutpost"
  | "defendMainBase"
  | "defendOutpost"
  | "recaptureLostBase"
  | "cutSupplyLine"
  | "attackPlayer"
  | "interceptPlayer"
  | "retreat"
  | "recoverAtBase";
export type UpgradeChoice = {
  id: UpgradeChoiceId;
  label: string;
  description: string;
};

export const MAX_RIPPLES = 30;
export const MAX_PARTICLES = 300;
export const MAX_PULSES = 10;
export const MAX_PULSE_DOT_HITS_PER_FRAME = 80;
export const MAX_PULSE_PARTICLES_PER_FRAME = 40;
export const XP_DOT_CLEANSED = 1;
export const XP_NODE_CAPTURED = 50;
export const XP_ENEMY_KILL = 100;
export const XP_DAMAGE_CAP_PER_SECOND = 5;
const MAX_CONTESTED_ZONES = 18;
const MAX_ENEMIES = 7;
const DOT_GRID_CELL_SIZE = 78;
const SHOCKWAVE_DURATION = 2.85;
const SHIELD_DURATION = 6;
const SHIELD_COOLDOWN = 12;
export const HAZE_SCALE = 0.33;
export const HAZE_FRAME_INTERVAL = 4;
export const FOG_SCALE = 0.3;
export const FOG_UPDATE_EVERY_FRAMES = 5;
export const FOG_REVEAL_STEP_DISTANCE = 12;
export const FOG_UNEXPLORED_OPACITY = 0.96;
export const FOG_EXPLORED_OPACITY = 0.45;
export const FOG_VISIBLE_OPACITY = 0;
const CORE_SPEED_SCALE = 0.5;
const DIRECT_CLEANSE_SCALE = 14;
const DIRECT_INFECT_SCALE = 12;
const FOG_REVEAL_SCALE = 1.35;
const COMBAT_LOCKOUT_SECONDS = 3;
const BASE_REGEN_DELAY_SECONDS = 0.75;
const SUPPLY_LINK_RADIUS = 330;
const BASE_CAPTURE_SECONDS = 4.5;
const NODE_CAPTURE_SECONDS = 3;
const FRIENDLY_BOT_CAPTURE_MULTIPLIER = 0.25;
const MAX_FRIENDLY_BOTS = 3;
const BOT_SPAWN_COOLDOWN = 18;
const HINT_COOLDOWN_SECONDS = 5.5;
export const ENEMY_REVEAL_SECONDS = 3.2;
const MAX_CORE_LEVEL = 10;
export const CHUNK_SIZE = 192;

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
  baseCombatRadius: number;
  baseInfluenceRadius: number;
  baseVisionRadius: number;
  bodyRadius: number;
  collisionRadius: number;
  combatRadius: number;
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
  visionRadius: number;
  slowTimer: number;
  contactTimer: number;
  breakTimer: number;
  hitFlashTimer: number;
  shieldFlashTimer: number;
  healthPulseTimer: number;
  effectTickTimer: number;
  combatState: CombatState;
  lastDamageTakenAt: number;
  lastDamageDealtAt: number;
  lastClashAt: number;
  isInCombat: boolean;
  combatLockoutTimer: number;
  recoveryState: RecoveryState;
  healthRegenPerSec: number;
  shieldRegenPerSec: number;
  localTerritory: TerritorySupply;
  baseProximity: number;
  pulseTimer: number;
  decisionTimer: number;
  lastDecisionInterval: number;
  modeTimer: number;
  mode: EnemyMode;
  role: BotRole;
  goalType: AIGoalType | "none";
  goalCommitmentTimer: number;
  targetNodeId: number | null;
  selectedTarget: string;
  targetScore: number;
  revealTimer: number;
  isMinion: boolean;
  canCaptureMain: boolean;
  captureRate: number;
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
  captureBy: AgentKind | null;
  captureProgress: number;
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
  supplied: boolean;
  supplyParentId: number | null;
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
  kind: ParticleKind;
};

type InfluenceSample = {
  infection: number;
  player: number;
};

type EnemySettings = {
  radius: number;
  combatRadius: number;
  fieldRadius: number;
  speed: number;
  mass: number;
  shield: number;
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
  elapsedSeconds: number;
  remainingSeconds: number;
  overtimeSeconds: number;
  playerBaseCapture: number;
  enemyBaseCapture: number;
  fogVisualsEnabled: boolean;
  shockwaveCharge: number;
  shockwaveReady: boolean;
  shieldReady: boolean;
  shieldCooldown: number;
  shieldCooldownRemaining: number;
  shieldActive: boolean;
  shieldTimer: number;
  botReady: boolean;
  botCooldownRemaining: number;
  friendlyBotCount: number;
  playerLevel: number;
  playerXp: number;
  playerNextLevelXp: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerShield: number;
  playerMaxShield: number;
  playerRespawnTimer: number;
  playerRecoveryState: RecoveryState;
  playerRecoveryDelayRemaining: number;
  playerHealthRegenPerSec: number;
  playerShieldRegenPerSec: number;
  playerLocalTerritory: TerritorySupply;
  nodePlayerCount: number;
  nodeEnemyCount: number;
  nodePlayerSuppliedCount: number;
  nodeEnemySuppliedCount: number;
  hint: string | null;
  upgradePending: boolean;
  pendingUpgradeCount: number;
  upgradeChoices: UpgradeChoice[];
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
  recoveryState: RecoveryState;
  combatLockoutRemaining: number;
  recoveryDelayRemaining: number;
  healthRegenPerSec: number;
  shieldRegenPerSec: number;
  localTerritory: TerritorySupply;
  baseProximity: number;
  enemyHealthSummary: string;
  aiDifficulty: AIDifficulty;
  aiTargets: string;
  baseSupplySummary: string;
  enemyDeaths: number;
  playerDeaths: number;
  visibleDotCount: number;
  hiddenDotCount: number;
  activeDotSpriteCount: number;
  syncedDotSprites: number;
  dirtyDotCount: number;
  visibleChunkCount: number;
  dirtyChunkCount: number;
  foggedChunkCount: number;
  hazeTextureUpdates: number;
  fogTextureUpdates: number;
  renderStateBuildMs: number;
  renderStateAllocationCount: number;
  syncDotsMs: number;
  syncHealthBarsMs: number;
  syncFogHazeMs: number;
  unaccountedFrameMs: number;
  fogVisualsEnabled: boolean;
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
  visibleDotCount: number;
  hiddenDotCount: number;
  activeDotSpriteCount: number;
  syncedDotSprites: number;
  dirtyDotCount: number;
  visibleChunkCount: number;
  dirtyChunkCount: number;
  foggedChunkCount: number;
  hazeTextureUpdates: number;
  fogTextureUpdates: number;
  renderStateBuildMs: number;
  renderStateAllocationCount: number;
  syncDotsMs: number;
  syncHealthBarsMs: number;
  syncFogHazeMs: number;
  fogVisualsEnabled: boolean;
};

export type GameRenderState = {
  revision: number;
  fogRevision: number;
  width: number;
  height: number;
  time: number;
  arena: Arena;
  dots: Dot[];
  frontline: Float32Array;
  playerFog: Float32Array;
  playerVisibility: Float32Array;
  enemyFog: Float32Array;
  player: Agent;
  friendlyBots: Agent[];
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
  destination: { active: boolean; blocked: boolean; x: number; y: number; pulse: number };
  preview: { active: boolean; blocked: boolean; x: number; y: number };
  shieldTimer: number;
  enemyRevealTimer: number;
  debugVisible: boolean;
  status: GameStatus;
  paused: boolean;
  fogVisualsEnabled: boolean;
};

const ENEMY_SETTINGS: Record<EnemyType, EnemySettings> = {
  spreader: {
    radius: 17,
    combatRadius: 29,
    fieldRadius: 112,
    speed: 62,
    mass: 1.15,
    shield: 20,
    spreadPower: 1.36,
    pulseEvery: [6.8, 8.4],
    canMove: true,
  },
  hunter: {
    radius: 15,
    combatRadius: 27,
    fieldRadius: 76,
    speed: 112,
    mass: 0.92,
    shield: 20,
    spreadPower: 0.58,
    pulseEvery: [8.2, 10],
    canMove: true,
  },
  tank: {
    radius: 24,
    combatRadius: 36,
    fieldRadius: 102,
    speed: 48,
    mass: 3.4,
    shield: 40,
    spreadPower: 0.92,
    pulseEvery: [8, 10.5],
    canMove: true,
  },
  splitter: {
    radius: 16,
    combatRadius: 28,
    fieldRadius: 88,
    speed: 78,
    mass: 1,
    shield: 24,
    spreadPower: 0.82,
    pulseEvery: [7.8, 10.4],
    canMove: true,
  },
  root: {
    radius: 21,
    combatRadius: 34,
    fieldRadius: 106,
    speed: 0,
    mass: 4.8,
    shield: 32,
    spreadPower: 1.08,
    pulseEvery: [5.6, 7.2],
    canMove: false,
  },
};

const LEVELS: LevelConfig[] = [
  {
    number: 1,
    name: "First Cleanse",
    summary: "No enemy core. Learn movement, capture zones, and base control.",
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
    summary: "A static enemy core guards the far base while you learn safe captures.",
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
    summary: "A slow core starts taking mini-bases and pressuring supply.",
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
    summary: "The enemy begins contesting the mini-base network.",
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
    summary: "Enemy pulses and a light hunter escort create timing pressure.",
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
    baseCombatRadius: 28,
    baseInfluenceRadius: 42,
    baseVisionRadius: 114,
    bodyRadius: 16,
    collisionRadius: 18,
    combatRadius: 28,
    radius: 16,
    fieldRadius: 42,
    speed: 156,
    moveSpeed: 156,
    mass: 1.1,
    spreadPower: 1,
    power: 20,
    intensity: 1,
    health: 100,
    maxHealth: 100,
    shield: 20,
    maxShield: 20,
    level: 1,
    xp: 0,
    influenceRadius: 42,
    visionRadius: 114,
    slowTimer: 0,
    contactTimer: 0,
    breakTimer: 0,
    hitFlashTimer: 0,
    shieldFlashTimer: 0,
    healthPulseTimer: 0,
    effectTickTimer: 0,
    combatState: "idle",
    lastDamageTakenAt: -999,
    lastDamageDealtAt: -999,
    lastClashAt: -999,
    isInCombat: false,
    combatLockoutTimer: 0,
    recoveryState: "noSupply",
    healthRegenPerSec: 0,
    shieldRegenPerSec: 0,
    localTerritory: "neutral",
    baseProximity: 0,
    pulseTimer: 0,
    decisionTimer: 0,
    lastDecisionInterval: 0,
    modeTimer: 0,
    mode: "expand",
    role: "capturer",
    goalType: "none",
    goalCommitmentTimer: 0,
    targetNodeId: null,
    selectedTarget: "field",
    targetScore: 0,
    revealTimer: 0,
    isMinion: false,
    canCaptureMain: true,
    captureRate: 1,
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
    baseCombatRadius: settings.combatRadius,
    baseInfluenceRadius: settings.fieldRadius * 0.5,
    baseVisionRadius: settings.fieldRadius * 1.24,
    bodyRadius: settings.radius,
    collisionRadius: settings.radius + 2,
    combatRadius: settings.combatRadius,
    radius: settings.radius,
    fieldRadius: settings.fieldRadius * 0.5,
    speed: settings.speed * config.enemySpeedScale,
    moveSpeed: settings.speed * config.enemySpeedScale,
    mass: settings.mass,
    spreadPower: settings.spreadPower,
    power: 20,
    intensity: 0.96,
    health: 100,
    maxHealth: 100,
    shield: settings.shield,
    maxShield: settings.shield,
    level: 1,
    xp: 0,
    influenceRadius: settings.fieldRadius * 0.5,
    visionRadius: settings.fieldRadius * 1.24,
    slowTimer: 0,
    contactTimer: 0,
    breakTimer: 0,
    hitFlashTimer: 0,
    shieldFlashTimer: 0,
    healthPulseTimer: 0,
    effectTickTimer: 0,
    combatState: "idle",
    lastDamageTakenAt: -999,
    lastDamageDealtAt: -999,
    lastClashAt: -999,
    isInCombat: false,
    combatLockoutTimer: 0,
    recoveryState: "noSupply",
    healthRegenPerSec: 0,
    shieldRegenPerSec: 0,
    localTerritory: "neutral",
    baseProximity: 0,
    pulseTimer: randomRange(settings.pulseEvery[0], settings.pulseEvery[1]),
    decisionTimer: 0,
    lastDecisionInterval: 0,
    modeTimer: 0,
    mode: "expand",
    role: getEnemyRole(type),
    goalType: "captureNeutralBase",
    goalCommitmentTimer: 0,
    targetNodeId: null,
    selectedTarget: "expand",
    targetScore: 0,
    revealTimer: 0,
    isMinion: false,
    canCaptureMain: true,
    captureRate: 1,
    canMove,
    canPulse: config.enemyCanPulse,
    splitDone: false,
    active: true,
    isRespawning: false,
    respawnTimer: 0,
    invulnerableTimer: 0,
  };
}

function getEnemyRole(type: EnemyType): BotRole {
  switch (type) {
    case "hunter":
      return "hunter";
    case "tank":
      return "defender";
    case "splitter":
      return "interceptor";
    case "root":
      return "support";
    case "spreader":
    default:
      return "capturer";
  }
}

function createFriendlyBot(id: number, player: Agent): Agent {
  const bot = createPlayer();
  bot.id = -100 - id;
  bot.role = id % 3 === 0 ? "support" : id % 2 === 0 ? "interceptor" : "capturer";
  bot.goalType = "captureNeutralBase";
  bot.selectedTarget = "spawn";
  bot.baseRadius = 8;
  bot.baseCombatRadius = 17;
  bot.baseInfluenceRadius = 22;
  bot.baseVisionRadius = 74;
  bot.bodyRadius = 8;
  bot.collisionRadius = 10;
  bot.combatRadius = 17;
  bot.radius = 8;
  bot.fieldRadius = 22;
  bot.speed = Math.max(42, player.speed * 0.82);
  bot.moveSpeed = bot.speed;
  bot.mass = 0.46;
  bot.power = 7;
  bot.health = 34;
  bot.maxHealth = 34;
  bot.shield = 8;
  bot.maxShield = 8;
  bot.level = Math.max(1, Math.min(3, Math.floor(player.level / 3)));
  bot.influenceRadius = 22;
  bot.visionRadius = 74;
  bot.recoveryState = "noSupply";
  bot.revealTimer = 0;
  bot.isMinion = true;
  bot.canCaptureMain = false;
  bot.captureRate = FRIENDLY_BOT_CAPTURE_MULTIPLIER;
  bot.canMove = true;
  bot.canPulse = false;
  bot.invulnerableTimer = 0.5;
  return bot;
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
  private friendlyBots: Agent[] = [];
  private nextFriendlyBotId = 1;
  private playerField = createField();
  private enemyField = createField();
  private destination = {
    active: false,
    blocked: false,
    x: 0,
    y: 0,
    pulse: 0,
  };
  private preview = {
    active: false,
    blocked: false,
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
  private playerFog = new Float32Array(0);
  private playerVisibility = new Float32Array(0);
  private enemyFog = new Float32Array(0);
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
  private boundaryRippleCooldown = 0;
  private fogRevision = 0;
  private fogFrameCounter = 0;
  private playerVisibleDotIds: number[] = [];
  private lastPlayerFogReveal = { x: 0, y: 0, ready: false };
  private lastPlayerVisibility = { x: 0, y: 0, ready: false };
  private enemyFogRevealState = new Map<number, { x: number; y: number; ready: boolean }>();
  private shockwaveCharge = 1;
  private shieldTimer = 0;
  private shieldCooldownRemaining = 0;
  private botCooldownRemaining = 0;
  private enemyRevealTimer = 0;
  private aiDifficulty: AIDifficulty = "medium";
  private fogVisualsEnabled = false;
  private hintText: string | null = null;
  private hintKey: string | null = null;
  private hintCooldown = 0;
  private shownHints = new Set<string>();
  private pendingUpgradeChoices: UpgradeChoice[] = [];
  private pendingUpgradeCount = 0;
  private playerUpgradeBonuses = {
    power: 0,
    shield: 0,
    speed: 0,
    radius: 1,
  };
  private playerDeaths = 0;
  private enemyDeaths = 0;
  private renderRevision = 0;
  private renderStateBuildMs = 0;
  private renderStateAllocationCount = 0;
  private visualFrame = 0;
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
    playerHealth: 100,
    playerShield: 20,
    shieldCooldownRemaining: 0,
    shieldTimer: 0,
    playerRespawnTimer: 0,
    enemyHealthSummary: "none",
    aiDifficulty: "medium",
    aiTargets: "none",
    baseSupplySummary: "none",
    enemyDeaths: 0,
    playerDeaths: 0,
    recoveryState: "noSupply",
    combatLockoutRemaining: 0,
    recoveryDelayRemaining: 0,
    healthRegenPerSec: 0,
    shieldRegenPerSec: 0,
    localTerritory: "neutral",
    baseProximity: 0,
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
    unaccountedFrameMs: 0,
    fogVisualsEnabled: false,
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
    this.botCooldownRemaining = 0;
    this.enemyRevealTimer = 0;
    this.friendlyBots = [];
    this.nextFriendlyBotId = 1;
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
    this.hintText = null;
    this.hintKey = null;
    this.hintCooldown = 0;
    this.shownHints.clear();
    this.pendingUpgradeChoices = [];
    this.pendingUpgradeCount = 0;
    this.playerUpgradeBonuses = {
      power: 0,
      shield: 0,
      speed: 0,
      radius: 1,
    };
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
    this.player.breakTimer = Math.max(this.player.breakTimer, 0.3);
    this.player.shieldFlashTimer = Math.max(this.player.shieldFlashTimer, 0.42);
    this.player.shield = Math.min(this.player.maxShield + 24, this.player.shield + this.player.maxShield * 0.65 + 16);
    this.addRipple(this.player.x, this.player.y, "player", this.player.radius + 98);
    return true;
  }

  spawnFriendlyBot() {
    if (
      this.paused ||
      this.status !== "playing" ||
      this.player.isRespawning ||
      this.botCooldownRemaining > 0 ||
      this.friendlyBots.filter((bot) => bot.active).length >= MAX_FRIENDLY_BOTS
    ) {
      return false;
    }

    const bot = createFriendlyBot(this.nextFriendlyBotId, this.player);
    this.nextFriendlyBotId += 1;
    const angle = this.time * 1.7 + this.nextFriendlyBotId * 2.1;
    const spawnDistance = this.player.bodyRadius + bot.bodyRadius + 18;
    const point = this.clampToArena(
      this.player.x + Math.cos(angle) * spawnDistance,
      this.player.y + Math.sin(angle) * spawnDistance,
      bot.collisionRadius + 8,
    );
    bot.x = point.x;
    bot.y = point.y;
    bot.targetX = point.x;
    bot.targetY = point.y;
    bot.baseX = this.player.baseX;
    bot.baseY = this.player.baseY;
    bot.homeX = point.x;
    bot.homeY = point.y;
    this.friendlyBots.push(bot);
    this.botCooldownRemaining = BOT_SPAWN_COOLDOWN;
    this.addRipple(bot.x, bot.y, "player", 58);
    this.spawnBurst(bot.x, bot.y, "player", 12, 0.8);
    this.showHint("bot-spawned", "Support bot deployed. Bots capture mini-bases slowly.", false);
    return true;
  }

  chooseUpgrade(choiceId: UpgradeChoiceId) {
    if (this.pendingUpgradeCount <= 0 || this.pendingUpgradeChoices.length === 0) {
      return false;
    }

    const choice = this.pendingUpgradeChoices.find((candidate) => candidate.id === choiceId);

    if (!choice) {
      return false;
    }

    const previousHealth = this.player.health;
    const previousShield = this.player.shield;

    if (choice.id === "power") {
      this.playerUpgradeBonuses.power += 7;
    } else if (choice.id === "shield") {
      this.playerUpgradeBonuses.shield += 12;
    } else if (choice.id === "speed") {
      this.playerUpgradeBonuses.speed = clamp(this.playerUpgradeBonuses.speed + 0.05, 0, 0.5);
    }

    this.pendingUpgradeCount = Math.max(0, this.pendingUpgradeCount - 1);
    if (this.pendingUpgradeCount <= 0) {
      this.pendingUpgradeChoices = [];
    }
    this.applyCoreLevelStats(this.player);
    this.player.health = Math.max(this.player.health, previousHealth);
    this.player.shield = Math.min(this.player.maxShield, Math.max(this.player.shield, previousShield + (choice.id === "shield" ? 12 : 0)));
    if (this.hintKey === "choose-upgrade") {
      this.hintText = null;
      this.hintKey = null;
      this.hintCooldown = 0;
    }
    this.showHint("upgrade-applied", `${choice.label} installed.`, false);
    this.addRipple(this.player.x, this.player.y, "player", this.player.radius + 108);
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

  getLevelSummaries() {
    return LEVELS.map((level) => ({
      number: level.number,
      name: level.name,
      summary: level.summary,
      enemyTypes: level.enemyTypes,
    }));
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

    const target = this.findOpenPoint(x, y, this.player.collisionRadius + 10);
    this.destination.active = true;
    this.destination.blocked = !this.isInsideArenaBounds(x, y, this.player.collisionRadius + 10);
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

    const target = this.findOpenPoint(x, y, this.player.collisionRadius + 10);
    this.preview.active = true;
    this.preview.blocked = !this.isInsideArenaBounds(x, y, this.player.collisionRadius + 10);
    this.preview.x = target.x;
    this.preview.y = target.y;
  }

  clearPointer() {
    this.preview.active = false;
    this.preview.blocked = false;
  }

  togglePause() {
    if (this.status !== "playing") {
      return;
    }

    this.paused = !this.paused;
  }

  setPaused(paused: boolean) {
    if (this.status !== "playing") {
      return;
    }

    this.paused = paused;
  }

  activateShockwave() {
    if (this.paused || this.status !== "playing" || this.player.isRespawning || this.shockwaveCharge < 1) {
      return false;
    }

    this.sacrificePlayerTerritory();
    this.shockwaveCharge = 0;
    this.enemyRevealTimer = ENEMY_REVEAL_SECONDS;
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
    this.player.breakTimer = Math.max(this.player.breakTimer, 0.32);
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
      this.boundaryRippleCooldown = Math.max(0, this.boundaryRippleCooldown - safeDt);
      this.updateCoreTimers(safeDt);
      this.updateBases(safeDt);
      this.updateGates(safeDt);
      this.updateAgents(safeDt);
      this.resolveCoreCollisions(safeDt);
      this.damageEnemiesNearPlayer(safeDt);
      this.updateFields();
      this.updateNodes(safeDt);
      this.updateEnemyPulses(safeDt);
      this.updatePulses(safeDt);
      this.rechargeShockwave(safeDt);
      this.updateHints(safeDt);
      this.checkOutcome();
    }

    this.updateRipples(safeDt);
    this.updateContestedZones(safeDt);
    this.updateParticles(safeDt);

    this.visualFrame += 1;

    this.enemyRevealTimer = Math.max(0, this.enemyRevealTimer - safeDt);
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
    const unaccountedFrameMs = Math.max(0, frameMs - updateMs - drawMs);
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
      recoveryState: this.player.recoveryState,
      combatLockoutRemaining: this.player.combatLockoutTimer,
      recoveryDelayRemaining: this.getRecoveryDelayRemaining(this.player),
      healthRegenPerSec: this.player.healthRegenPerSec,
      shieldRegenPerSec: this.player.shieldRegenPerSec,
      localTerritory: this.player.localTerritory,
      baseProximity: this.player.baseProximity,
      enemyHealthSummary: this.getEnemyHealthSummary(),
      aiDifficulty: this.aiDifficulty,
      aiTargets: this.getAiTargetSummary(),
      baseSupplySummary: this.getBaseSupplySummary(),
      enemyDeaths: this.enemyDeaths,
      playerDeaths: this.playerDeaths,
      visibleDotCount: pixiMetrics?.visibleDotCount ?? 0,
      hiddenDotCount: pixiMetrics?.hiddenDotCount ?? 0,
      activeDotSpriteCount: pixiMetrics?.activeDotSpriteCount ?? 0,
      syncedDotSprites: pixiMetrics?.syncedDotSprites ?? 0,
      dirtyDotCount: pixiMetrics?.dirtyDotCount ?? 0,
      visibleChunkCount: pixiMetrics?.visibleChunkCount ?? 0,
      dirtyChunkCount: pixiMetrics?.dirtyChunkCount ?? 0,
      foggedChunkCount: pixiMetrics?.foggedChunkCount ?? 0,
      hazeTextureUpdates: pixiMetrics?.hazeTextureUpdates ?? 0,
      fogTextureUpdates: pixiMetrics?.fogTextureUpdates ?? 0,
      renderStateBuildMs: this.renderStateBuildMs,
      renderStateAllocationCount: this.renderStateAllocationCount,
      syncDotsMs: pixiMetrics?.syncDotsMs ?? 0,
      syncHealthBarsMs: pixiMetrics?.syncHealthBarsMs ?? 0,
      syncFogHazeMs: pixiMetrics?.syncFogHazeMs ?? 0,
      unaccountedFrameMs,
      fogVisualsEnabled: this.fogVisualsEnabled,
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

  private getBaseSupplySummary() {
    if (this.nodes.length === 0) {
      return "none";
    }

    const playerOwned = this.nodes.filter((node) => node.owner === "player");
    const enemyOwned = this.nodes.filter((node) => node.owner === "enemy");
    return `P ${playerOwned.filter((node) => node.supplied).length}/${playerOwned.length} E ${enemyOwned.filter((node) => node.supplied).length}/${enemyOwned.length}`;
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
    const started = typeof performance !== "undefined" ? performance.now() : 0;
    this.renderStateAllocationCount = 1;
    const state = {
      revision: this.renderRevision,
      fogRevision: this.fogRevision,
      width: this.width,
      height: this.height,
      time: this.time,
      arena: this.arena,
      dots: this.dots,
      frontline: this.frontline,
      playerFog: this.playerFog,
      playerVisibility: this.playerVisibility,
      enemyFog: this.enemyFog,
      player: this.player,
      friendlyBots: this.friendlyBots.filter((bot) => bot.active),
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
      enemyRevealTimer: this.enemyRevealTimer,
      debugVisible,
      status: this.status,
      paused: this.paused,
      fogVisualsEnabled: this.fogVisualsEnabled,
    };

    this.renderStateBuildMs = started > 0 ? performance.now() - started : 0;
    return state;
  }

  getStats(): GameStats {
    const totalDots = this.dots.length || 1;
    const activeEnemies = this.getActiveEnemies();
    const primaryEnemy = activeEnemies[0];
    const config = this.levelConfig;
    const playerBaseCapture = this.bases.find((base) => base.team === "player")?.captureProgress ?? 0;
    const enemyBaseCapture = this.bases
      .filter((base) => base.team === "enemy")
      .reduce((max, base) => Math.max(max, base.captureProgress), 0);

    return {
      totalDots,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      remainingSeconds: Math.max(0, Math.ceil(this.durationSeconds - this.elapsedSeconds)),
      overtimeSeconds: Math.max(0, Math.floor(this.elapsedSeconds - this.durationSeconds)),
      playerBaseCapture: clamp(playerBaseCapture * 100, 0, 100),
      enemyBaseCapture: clamp(enemyBaseCapture * 100, 0, 100),
      fogVisualsEnabled: this.fogVisualsEnabled,
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
      botReady:
        this.botCooldownRemaining <= 0 &&
        !this.player.isRespawning &&
        this.friendlyBots.filter((bot) => bot.active).length < MAX_FRIENDLY_BOTS,
      botCooldownRemaining: Math.max(0, this.botCooldownRemaining),
      friendlyBotCount: this.friendlyBots.filter((bot) => bot.active).length,
      playerLevel: this.player.level,
      playerXp: Math.floor(this.player.xp),
      playerNextLevelXp: this.player.level >= MAX_CORE_LEVEL ? this.getPlayerXpCap() : this.getNextLevelXp(this.player.level),
      playerHealth: Math.max(0, this.player.health),
      playerMaxHealth: this.player.maxHealth,
      playerShield: Math.max(0, this.player.shield),
      playerMaxShield: this.player.maxShield,
      playerRespawnTimer: Math.max(0, this.player.respawnTimer),
      playerRecoveryState: this.player.recoveryState,
      playerRecoveryDelayRemaining: this.getRecoveryDelayRemaining(this.player),
      playerHealthRegenPerSec: this.player.healthRegenPerSec,
      playerShieldRegenPerSec: this.player.shieldRegenPerSec,
      playerLocalTerritory: this.player.localTerritory,
      nodePlayerCount: this.nodes.filter((node) => node.owner === "player").length,
      nodeEnemyCount: this.nodes.filter((node) => node.owner === "enemy").length,
      nodePlayerSuppliedCount: this.nodes.filter((node) => node.owner === "player" && node.supplied).length,
      nodeEnemySuppliedCount: this.nodes.filter((node) => node.owner === "enemy" && node.supplied).length,
      hint: this.hintText,
      upgradePending: this.pendingUpgradeChoices.length > 0,
      pendingUpgradeCount: this.pendingUpgradeCount,
      upgradeChoices: this.pendingUpgradeChoices,
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
    const sideInset = 0;
    const topInset = 80;
    const bottomInset = 0;

    this.arena = {
      x: sideInset,
      y: topInset,
      width: Math.max(240, this.width - sideInset * 2),
      height: Math.max(260, this.height - topInset - bottomInset),
      right: this.width - sideInset,
      bottom: this.height - bottomInset,
      radius: 0,
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
    this.playerFog = new Float32Array(dots.length);
    this.playerVisibility = new Float32Array(dots.length);
    this.enemyFog = new Float32Array(dots.length);
    this.playerFog.fill(1);
    this.playerVisibility.fill(1);
    this.enemyFog.fill(1);
    this.playerVisibleDotIds = [];
    this.lastPlayerFogReveal = { x: 0, y: 0, ready: false };
    this.lastPlayerVisibility = { x: 0, y: 0, ready: false };
    this.enemyFogRevealState.clear();
    this.fogRevision += 1;
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
    this.revealInitialFog();
    this.updateFields();
    this.updateFrontlines();
    this.renderRevision += 1;
  }

  private placeAgents() {
    const config = this.levelConfig;
    const margin = this.width < 720 ? 38 : 54;
    const playerPosition = this.clampToArena(this.arena.x + margin, this.arena.bottom - margin, margin);
    const enemyBasePosition = this.clampToArena(this.arena.right - margin, this.arena.y + margin, margin);

    this.player = createPlayer();
    this.player.x = playerPosition.x;
    this.player.y = playerPosition.y;
    this.player.targetX = playerPosition.x;
    this.player.targetY = playerPosition.y;
    this.player.homeX = playerPosition.x;
    this.player.homeY = playerPosition.y;
    this.player.baseX = playerPosition.x;
    this.player.baseY = playerPosition.y;
    const playerLegacyFieldRadius = clamp(Math.min(this.width, this.height) * 0.11, 72, 102);
    this.player.baseInfluenceRadius = playerLegacyFieldRadius * 0.5;
    this.player.baseVisionRadius = Math.max(playerLegacyFieldRadius * 1.35, this.player.baseInfluenceRadius + 72);
    this.player.speed = (this.width < 720 ? 118 : 156) * CORE_SPEED_SCALE;
    this.player.moveSpeed = this.player.speed;
    this.applyCoreLevelStats(this.player, true);

    this.enemies = config.enemyTypes.map((type, index) => {
      const enemy = createEnemy(type, index + 1, config);
      const spawnAngle = -Math.PI * 0.75 + index * 0.72;
      const spawnDistance = this.width < 720 ? 32 : 48;
      const position = this.clampToArena(
        enemyBasePosition.x + Math.cos(spawnAngle) * spawnDistance,
        enemyBasePosition.y + Math.sin(spawnAngle) * spawnDistance,
        enemy.collisionRadius + 10,
      );
      enemy.x = position.x;
      enemy.y = position.y;
      enemy.targetX = position.x;
      enemy.targetY = position.y;
      enemy.homeX = position.x;
      enemy.homeY = position.y;
      enemy.baseX = enemyBasePosition.x;
      enemy.baseY = enemyBasePosition.y;
      const enemyLegacyFieldRadius = clamp(ENEMY_SETTINGS[type].fieldRadius * (this.width < 720 ? 0.82 : 1), 56, 124);
      enemy.baseInfluenceRadius = enemyLegacyFieldRadius * 0.5;
      enemy.baseVisionRadius = Math.max(enemyLegacyFieldRadius * 1.26, enemy.baseInfluenceRadius + 64);
      enemy.speed *= (this.width < 720 ? 0.78 : 1) * CORE_SPEED_SCALE;
      enemy.moveSpeed = enemy.speed;
      this.applyCoreLevelStats(enemy, true);
      return enemy;
    });
    this.createBases();
  }

  private createBases() {
    const enemyAnchor = this.enemies[0] ?? this.player;
    const enemyBase = {
      id: -1,
      team: "enemy" as const,
      x: this.enemies.length > 0 ? enemyAnchor.baseX : this.arena.right - 92,
      y: this.enemies.length > 0 ? enemyAnchor.baseY : this.arena.y + 92,
      radius: Math.max(this.player.radius + 38, ...this.enemies.map((enemy) => enemy.radius + 34)),
      pulse: randomRange(0, Math.PI * 2),
      captureBy: null,
      captureProgress: 0,
    };

    this.bases = [
      {
        id: 0,
        team: "player",
        x: this.player.baseX,
        y: this.player.baseY,
        radius: this.player.radius + 36,
        pulse: randomRange(0, Math.PI * 2),
        captureBy: null,
        captureProgress: 0,
      },
      enemyBase,
    ];
    this.updateBaseSupply();
  }

  private applyCoreLevelStats(agent: Agent, refill = false) {
    const level = clamp(Math.round(agent.level), 1, MAX_CORE_LEVEL);
    const healthRatio = agent.maxHealth > 0 ? agent.health / agent.maxHealth : 1;
    const shieldRatio = agent.maxShield > 0 ? agent.shield / agent.maxShield : 1;

    if (agent.kind === "player") {
      const levelOffset = level - 1;
      agent.bodyRadius = agent.baseRadius + levelOffset * 1.15;
      agent.collisionRadius = agent.bodyRadius + 2;
      agent.combatRadius = agent.baseCombatRadius + levelOffset * 3;
      agent.radius = agent.bodyRadius;
      agent.influenceRadius = agent.baseInfluenceRadius * (1 + 0.05 * levelOffset);
      agent.visionRadius = agent.baseVisionRadius * (1 + 0.035 * levelOffset);
      agent.fieldRadius = agent.influenceRadius;
      agent.maxHealth = 100 + levelOffset * 16 + this.getMiniBaseHealthBonus(agent.kind);
      agent.maxShield = 20 + levelOffset * 3.5;
      agent.mass = 1.1 + levelOffset * 0.18;
      agent.power = 20 + levelOffset * 3.5;
      agent.spreadPower = 1 + levelOffset * 0.08;
      agent.speed = agent.moveSpeed;
    } else {
      const settings = ENEMY_SETTINGS[agent.type as EnemyType];
      const levelOffset = level - 1;
      agent.bodyRadius = agent.baseRadius + levelOffset * 1.05;
      agent.collisionRadius = agent.bodyRadius + (agent.type === "tank" ? 4 : 2);
      agent.combatRadius = agent.baseCombatRadius + levelOffset * 3;
      agent.radius = agent.bodyRadius;
      agent.influenceRadius = agent.baseInfluenceRadius * (1 + 0.05 * levelOffset);
      agent.visionRadius = agent.baseVisionRadius * (1 + 0.03 * levelOffset);
      agent.fieldRadius = agent.influenceRadius;
      agent.maxHealth = 100 + levelOffset * 16 + this.getMiniBaseHealthBonus(agent.kind);
      agent.maxShield = settings.shield + levelOffset * 3.5;
      agent.mass = settings.mass * (1 + levelOffset * 0.1);
      agent.power = 20 + levelOffset * 3.5;
      agent.spreadPower = settings.spreadPower * (1 + levelOffset * 0.06);
      agent.speed = agent.moveSpeed * (agent.type === "tank" ? 0.96 : 1);
    }

    if (refill) {
      agent.health = agent.maxHealth;
      agent.shield = agent.maxShield;
    } else {
      agent.health = clamp(agent.maxHealth * healthRatio, 1, agent.maxHealth);
      agent.shield = clamp(agent.maxShield * shieldRatio, 0, agent.maxShield);
    }

    if (agent.kind === "player") {
      this.applyPlayerUpgradeBonuses();
    }
  }

  private applyPlayerUpgradeBonuses() {
    const player = this.player;
    const healthRatio = player.maxHealth > 0 ? player.health / player.maxHealth : 1;
    const shieldRatio = player.maxShield > 0 ? player.shield / player.maxShield : 1;

    player.maxShield += this.playerUpgradeBonuses.shield;
    player.shield = clamp(player.maxShield * shieldRatio, 0, player.maxShield);
    player.speed = player.moveSpeed * (1 + this.playerUpgradeBonuses.speed);
    player.power += this.playerUpgradeBonuses.power;
    player.combatRadius *= this.playerUpgradeBonuses.radius;
    player.influenceRadius *= this.playerUpgradeBonuses.radius;
    player.fieldRadius = player.influenceRadius;
    player.health = clamp(player.maxHealth * healthRatio, 1, player.maxHealth);
  }

  private queueUpgradeChoice() {
    this.pendingUpgradeCount += 1;

    if (this.pendingUpgradeChoices.length === 0) {
      this.pendingUpgradeChoices = [
        { id: "power", label: "Clash Power", description: "+7 core combat power" },
        { id: "shield", label: "Shield Cell", description: "+12 max shield" },
        { id: "speed", label: "Drive", description: "+0.05 move speed" },
      ];
    }
    this.showHint("choose-upgrade", "Choose an upgrade.", false);
  }

  private getMiniBaseHealthBonus(team: AgentKind) {
    return this.nodes.filter((node) => node.owner === team).length * 10;
  }

  private getNextLevelXp(level: number) {
    return [0, 80, 180, 320, 500, 720, 980, 1280, 1620, 2000, Number.POSITIVE_INFINITY][
      clamp(level, 1, MAX_CORE_LEVEL)
    ] ?? Number.POSITIVE_INFINITY;
  }

  private getPlayerXpCap() {
    return 2000;
  }

  private grantPlayerXp(amount: number) {
    if (amount <= 0) {
      return;
    }

    const xpCap = this.getPlayerXpCap();
    this.player.xp = clamp(this.player.xp + amount, 0, xpCap);

    while (this.player.level < MAX_CORE_LEVEL && this.player.xp >= this.getNextLevelXp(this.player.level)) {
      this.player.level += 1;
      this.applyCoreLevelStats(this.player);
      this.player.health = clamp(this.player.health + this.player.maxHealth * 0.2, 1, this.player.maxHealth);
      this.player.shield = clamp(this.player.shield + this.player.maxShield * 0.5, 0, this.player.maxShield);
      this.addRipple(this.player.x, this.player.y, "player", this.player.radius + 132);
      this.spawnBurst(this.player.x, this.player.y, "player", 34, 1.55);
      this.createBases();
      this.queueUpgradeChoice();
    }

    if (this.player.level >= MAX_CORE_LEVEL) {
      this.player.xp = xpCap;
    }
  }

  private maybeLevelEnemy(enemy: Agent, xp: number) {
    if (enemy.level >= MAX_CORE_LEVEL) {
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
    this.viscosityZones = [];
    this.blockers = [];
    this.energyWells = [];
  }

  private createNodes() {
    const radius = this.width < 720 ? 22 : 28;
    const left = this.arena.x;
    const top = this.arena.y;
    const width = this.arena.width;
    const height = this.arena.height;
    const placements = [
      { x: left + width * 0.16, y: top + height * 0.2 },
      { x: left + width * 0.3, y: top + height * 0.68 },
      { x: left + width * 0.47, y: top + height * 0.86 },
      { x: left + width * 0.48, y: top + height * 0.17 },
      { x: left + width * 0.72, y: top + height * 0.32 },
      { x: left + width * 0.88, y: top + height * 0.86 },
    ];

    this.nodes = placements.map((placement, id) => ({
      id,
      x: clamp(placement.x, this.arena.x + 76, this.arena.right - 76),
      y: clamp(placement.y, this.arena.y + 76, this.arena.bottom - 76),
      radius,
      owner: "neutral",
      supplied: false,
      supplyParentId: null,
      captureBy: null,
      captureProgress: 0,
      pulseTimer: randomRange(2.2, 5),
    }));
    this.updateBaseSupply();
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
    this.botCooldownRemaining = Math.max(0, this.botCooldownRemaining - dt);
    this.player.breakTimer = Math.max(0, this.player.breakTimer - dt);
    this.player.hitFlashTimer = Math.max(0, this.player.hitFlashTimer - dt);
    this.player.shieldFlashTimer = Math.max(0, this.player.shieldFlashTimer - dt);
    this.player.healthPulseTimer = Math.max(0, this.player.healthPulseTimer - dt);
    this.player.effectTickTimer = Math.max(0, this.player.effectTickTimer - dt);
    this.player.contactTimer = Math.max(0, this.player.contactTimer - dt * 0.9);

    if (this.player.breakTimer > 0) {
      this.player.combatState = "break";
    } else if (this.player.contactTimer <= 0.02) {
      this.player.combatState = "idle";
    }

    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer = Math.max(0, this.player.invulnerableTimer - dt);
    }

    this.updateCoreRecovery(this.player, dt);

    if (this.player.isRespawning) {
      this.player.respawnTimer = Math.max(0, this.player.respawnTimer - dt);

      if (this.player.respawnTimer <= 0) {
        this.respawnCore(this.player);
      }
    }

    for (const enemy of this.enemies) {
      enemy.revealTimer = Math.max(0, enemy.revealTimer - dt);
      enemy.breakTimer = Math.max(0, enemy.breakTimer - dt);
      enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
      enemy.shieldFlashTimer = Math.max(0, enemy.shieldFlashTimer - dt);
      enemy.healthPulseTimer = Math.max(0, enemy.healthPulseTimer - dt);
      enemy.effectTickTimer = Math.max(0, enemy.effectTickTimer - dt);
      enemy.contactTimer = Math.max(0, enemy.contactTimer - dt * 0.9);

      if (enemy.breakTimer > 0) {
        enemy.combatState = "break";
      } else if (enemy.contactTimer <= 0.02) {
        enemy.combatState = "idle";
      }

      if (enemy.invulnerableTimer > 0) {
        enemy.invulnerableTimer = Math.max(0, enemy.invulnerableTimer - dt);
      }

      this.updateCoreRecovery(enemy, dt);

      if (!enemy.isRespawning) {
        this.maybeLevelEnemy(enemy, dt * this.getDifficultySettings().enemyXpRate * (0.55 + this.nodes.filter((node) => node.owner === "enemy").length * 0.12));
        continue;
      }

      enemy.respawnTimer = Math.max(0, enemy.respawnTimer - dt);

      if (enemy.respawnTimer <= 0) {
        this.respawnCore(enemy);
      }
    }

    for (const bot of this.friendlyBots) {
      bot.breakTimer = Math.max(0, bot.breakTimer - dt);
      bot.hitFlashTimer = Math.max(0, bot.hitFlashTimer - dt);
      bot.shieldFlashTimer = Math.max(0, bot.shieldFlashTimer - dt);
      bot.healthPulseTimer = Math.max(0, bot.healthPulseTimer - dt);
      bot.effectTickTimer = Math.max(0, bot.effectTickTimer - dt);
      bot.contactTimer = Math.max(0, bot.contactTimer - dt * 0.9);

      if (bot.breakTimer > 0) {
        bot.combatState = "break";
      } else if (bot.contactTimer <= 0.02) {
        bot.combatState = "idle";
      }

      if (bot.invulnerableTimer > 0) {
        bot.invulnerableTimer = Math.max(0, bot.invulnerableTimer - dt);
      }

      this.updateCoreRecovery(bot, dt);
    }

    this.friendlyBots = this.friendlyBots.filter((bot) => bot.active || bot.isRespawning);
  }

  private updateBases(dt: number) {
    for (const base of this.bases) {
      base.pulse += dt;
      const capturePadding = 28;
      const playerInside =
        !this.player.isRespawning &&
        this.player.active &&
        distance(this.player.x, this.player.y, base.x, base.y) < base.radius + this.player.collisionRadius + capturePadding;
      const enemyInside = this.getActiveEnemies().some(
        (enemy) => distance(enemy.x, enemy.y, base.x, base.y) < base.radius + enemy.collisionRadius + capturePadding,
      );
      const ownerInside = base.team === "player" ? playerInside : enemyInside;
      const opponentInside = base.team === "player" ? enemyInside : playerInside;

      if (ownerInside && opponentInside) {
        if (base.captureBy) {
          base.captureProgress = Math.max(0, base.captureProgress - dt * 0.05);
        }
        continue;
      }

      const capturer: AgentKind | null = opponentInside ? (base.team === "player" ? "enemy" : "player") : null;

      if (!capturer) {
        base.captureProgress = Math.max(0, base.captureProgress - dt * (ownerInside ? 0.45 : 0.16));
        base.captureBy = null;
        continue;
      }

      if (base.captureBy !== capturer) {
        base.captureBy = capturer;
        base.captureProgress = 0;
      }

      base.captureProgress = clamp(base.captureProgress + dt / BASE_CAPTURE_SECONDS, 0, 1);
    }
  }

  private updateCoreRecovery(agent: Agent, dt: number) {
    agent.combatLockoutTimer = Math.max(0, agent.combatLockoutTimer - dt);
    agent.isInCombat = agent.combatLockoutTimer > 0;
    agent.healthRegenPerSec = 0;
    agent.shieldRegenPerSec = 0;
    agent.baseProximity = this.getBaseProximity(agent);
    agent.localTerritory = this.getLocalTerritorySupply(agent);

    if (agent.isRespawning || !agent.active) {
      agent.recoveryState = "combat";
      return;
    }

    const timeSinceCombat = this.time - Math.max(agent.lastDamageTakenAt, agent.lastDamageDealtAt, agent.lastClashAt);
    const baseEligible = agent.baseProximity > 0 && timeSinceCombat >= BASE_REGEN_DELAY_SECONDS;

    if (agent.isInCombat) {
      agent.recoveryState = "combat";
      return;
    }

    if (!baseEligible && timeSinceCombat < COMBAT_LOCKOUT_SECONDS) {
      agent.recoveryState = "recoveryDelay";
      return;
    }

    const baseRegen = baseEligible;
    const territory = baseRegen ? "base" : agent.localTerritory;
    const regen = this.getRecoveryRates(territory);

    agent.recoveryState = baseRegen ? "regenBase" : regen.health > 0 || regen.shield > 0 ? "regenOwnTerritory" : "noSupply";
    agent.healthRegenPerSec = regen.health;
    agent.shieldRegenPerSec = regen.shield;

    if (regen.health <= 0 && regen.shield <= 0) {
      return;
    }

    const shieldMissing = Math.max(0, agent.maxShield - agent.shield);
    const shieldRestored = Math.min(shieldMissing, regen.shield * dt);
    agent.shield = clamp(agent.shield + shieldRestored, 0, agent.maxShield);

    const shieldStillLow = agent.shield < agent.maxShield - 0.01;
    const healthRate = shieldStillLow ? regen.health * 0.25 : regen.health;
    agent.health = clamp(agent.health + healthRate * dt, 0, agent.maxHealth);
  }

  private getRecoveryRates(territory: TerritorySupply) {
    if (territory === "base") {
      return { health: 20, shield: 25 };
    }

    if (territory === "miniBase") {
      return { health: 6, shield: 10 };
    }

    if (territory === "own") {
      return { health: 2, shield: 6 };
    }

    if (territory === "neutral") {
      return { health: 0, shield: 1 };
    }

    return { health: 0, shield: 0 };
  }

  private getRecoveryDelayRemaining(agent: Agent) {
    if (agent.recoveryState !== "recoveryDelay") {
      return 0;
    }

    const timeSinceCombat = this.time - Math.max(agent.lastDamageTakenAt, agent.lastDamageDealtAt, agent.lastClashAt);
    const targetDelay = agent.baseProximity > 0 ? BASE_REGEN_DELAY_SECONDS : COMBAT_LOCKOUT_SECONDS;
    return clamp(targetDelay - timeSinceCombat, 0, targetDelay);
  }

  private getBaseProximity(agent: Agent) {
    const baseRadius = agent.kind === "player" ? 126 : 118;
    const baseDistance = distance(agent.x, agent.y, agent.baseX, agent.baseY);
    return clamp(1 - baseDistance / Math.max(1, baseRadius + agent.bodyRadius), 0, 1);
  }

  private getLocalTerritorySupply(agent: Agent): TerritorySupply {
    if (this.getBaseProximity(agent) > 0) {
      return "base";
    }

    for (const node of this.nodes) {
      if (node.owner !== agent.kind) {
        continue;
      }

      if (distance(agent.x, agent.y, node.x, node.y) <= node.radius + agent.bodyRadius + 58) {
        return "miniBase";
      }
    }

    return "neutral";
  }

  private showHint(key: string, text: string, once = true) {
    if (once && this.shownHints.has(key)) {
      return;
    }

    if (this.hintCooldown > 0 && this.hintText !== text) {
      return;
    }

    if (once) {
      this.shownHints.add(key);
    }

    this.hintText = text;
    this.hintKey = key;
    this.hintCooldown = HINT_COOLDOWN_SECONDS;
  }

  dismissHint() {
    if (this.hintKey) {
      this.shownHints.add(this.hintKey);
    }

    this.hintText = null;
    this.hintKey = null;
    this.hintCooldown = 0;
  }

  private updateHints(dt: number) {
    this.hintCooldown = Math.max(0, this.hintCooldown - dt);

    if (this.hintCooldown <= 0) {
      this.hintText = null;
      this.hintKey = null;
    }

    if (this.elapsedSeconds > 1.8) {
      this.showHint("mini-base-intro", "Capture mini-bases to heal closer to enemy territory.");
    }

    if (this.elapsedSeconds > 7) {
      this.showHint("enemy-main-goal", "Capture the enemy main base to win.");
    }

    const playerBaseThreat = this.bases.some(
      (base) => base.team === "player" && base.captureBy === "enemy" && base.captureProgress > 0.08,
    );

    if (playerBaseThreat) {
      this.showHint("player-base-threat", "Enemy is contesting your base.", false);
    }

    if (
      this.player.health < this.player.maxHealth * 0.55 &&
      (this.player.recoveryState === "noSupply" || this.player.recoveryState === "recoveryDelay")
    ) {
      this.showHint("return-supply", "Return to a captured base to recover.", false);
    }
  }

  private markCoreCombat(target: Agent, source?: Agent) {
    target.lastDamageTakenAt = this.time;
    target.combatLockoutTimer = COMBAT_LOCKOUT_SECONDS;
    target.isInCombat = true;

    if (!source || source.isMinion) {
      return;
    }

    source.lastDamageDealtAt = this.time;
    source.combatLockoutTimer = COMBAT_LOCKOUT_SECONDS;
    source.isInCombat = true;
  }

  private revealInitialFog() {
    this.playerFog.fill(1);
    this.playerVisibility.fill(1);
    this.enemyFog.fill(1);
    this.lastPlayerFogReveal = { x: this.player.x, y: this.player.y, ready: true };
    this.lastPlayerVisibility = { x: this.player.x, y: this.player.y, ready: true };

    this.fogRevision += 1;
  }

  private updateFog() {
    let changed = false;
    this.fogFrameCounter = (this.fogFrameCounter + 1) % FOG_UPDATE_EVERY_FRAMES;
    const framePulse = this.fogFrameCounter === 0;

    if (!this.player.isRespawning && this.player.active) {
      if (this.shouldRefreshVisibility(this.player.x, this.player.y, this.lastPlayerVisibility)) {
        changed = this.updateCurrentVisibility(this.player, this.playerVisibility, this.playerVisibleDotIds, FOG_REVEAL_SCALE) || changed;
        this.lastPlayerVisibility = { x: this.player.x, y: this.player.y, ready: true };
      }

      if (this.shouldRefreshFog(framePulse, this.player.x, this.player.y, this.lastPlayerFogReveal)) {
        changed = this.revealFogForAgent(this.player, "player", FOG_REVEAL_SCALE) || changed;
        this.lastPlayerFogReveal = { x: this.player.x, y: this.player.y, ready: true };
      }
    } else {
      changed = this.clearVisibility(this.playerVisibility, this.playerVisibleDotIds) || changed;
    }

    for (const enemy of this.getActiveEnemies()) {
      const lastReveal = this.enemyFogRevealState.get(enemy.id) ?? { x: enemy.x, y: enemy.y, ready: false };

      if (this.shouldRefreshFog(framePulse, enemy.x, enemy.y, lastReveal)) {
        changed = this.revealFogForAgent(enemy, "enemy", FOG_REVEAL_SCALE) || changed;
        this.enemyFogRevealState.set(enemy.id, { x: enemy.x, y: enemy.y, ready: true });
      }
    }

    if (changed) {
      this.fogRevision += 1;
    }
  }

  private shouldRefreshVisibility(x: number, y: number, lastVisibility: { x: number; y: number; ready: boolean }) {
    if (!lastVisibility.ready) {
      return true;
    }

    return distance(x, y, lastVisibility.x, lastVisibility.y) >= 3;
  }

  private shouldRefreshFog(framePulse: boolean, x: number, y: number, lastReveal: { x: number; y: number; ready: boolean }) {
    if (!lastReveal.ready) {
      return true;
    }

    if (distance(x, y, lastReveal.x, lastReveal.y) >= FOG_REVEAL_STEP_DISTANCE) {
      return true;
    }

    return framePulse;
  }

  private clearVisibility(visibility: Float32Array, ids: number[]) {
    let changed = false;

    for (const dotId of ids) {
      if (visibility[dotId] > 0) {
        visibility[dotId] = 0;
        changed = true;
      }
    }

    ids.length = 0;
    return changed;
  }

  private updateCurrentVisibility(agent: Agent, visibility: Float32Array, ids: number[], radiusScale = FOG_REVEAL_SCALE) {
    let changed = this.clearVisibility(visibility, ids);
    const radius = agent.visionRadius * radiusScale + agent.bodyRadius * 1.5;
    const visibleIds = this.queryDotsInRadius(agent.x, agent.y, radius, 0, this.pulseQueryBuffer);

    for (const dotId of visibleIds) {
      const dot = this.dots[dotId];
      const visibleAmount = clamp(smoothstep(radius, radius * 0.14, dot.distanceTo(agent.x, agent.y)), 0, 1);

      if (visibleAmount <= 0.025) {
        continue;
      }

      visibility[dotId] = visibleAmount;
      ids.push(dotId);
      changed = true;
    }

    return changed;
  }

  private revealFogForAgent(agent: Agent, kind: AgentKind, radiusScale = FOG_REVEAL_SCALE) {
    const fog = kind === "player" ? this.playerFog : this.enemyFog;
    const radius = agent.visionRadius * radiusScale + agent.bodyRadius * 1.5;
    const ids = this.queryDotsInRadius(agent.x, agent.y, radius, 0, this.pulseQueryBuffer);
    let changed = false;

    for (const dotId of ids) {
      const dot = this.dots[dotId];
      const visibility = smoothstep(radius, radius * 0.12, dot.distanceTo(agent.x, agent.y));

      if (visibility <= 0.025 || fog[dotId] >= 1) {
        continue;
      }

      fog[dotId] = 1;
      changed = true;
    }

    return changed;
  }

  private getFogAt(_kind: AgentKind, _x: number, _y: number, _radius = 48) {
    void _kind;
    void _x;
    void _y;
    void _radius;
    return 1;
  }

  private isPlayerVisibleToEnemy(_enemy: Agent) {
    if (this.player.isRespawning || !this.player.active) {
      return false;
    }

    if (distance(_enemy.x, _enemy.y, this.player.x, this.player.y) <= _enemy.visionRadius * 1.45 + this.player.bodyRadius) {
      return true;
    }

    return this.bases.some(
      (base) =>
        base.team === "enemy" &&
        (base.captureProgress > 0.03 ||
          distance(this.player.x, this.player.y, base.x, base.y) < base.radius + this.player.combatRadius + 38),
    );
  }

  private updateAgents(dt: number) {
    this.updateEnemyBrain(dt);
    this.updateFriendlyBotBrain(dt);
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

    for (const bot of this.friendlyBots) {
      if (bot.active && bot.canMove) {
        this.moveAgent(bot, dt);
      }
    }

    if (this.destination.active && distance(this.player.x, this.player.y, this.destination.x, this.destination.y) < 12) {
      this.destination.active = false;
    }
  }

  private updateFriendlyBotBrain(dt: number) {
    for (const bot of this.friendlyBots) {
      if (!bot.active || bot.isRespawning) {
        continue;
      }

      bot.decisionTimer -= dt;
      bot.goalCommitmentTimer = Math.max(0, bot.goalCommitmentTimer - dt);

      if (bot.decisionTimer > 0 && bot.goalCommitmentTimer > 0) {
        continue;
      }

      bot.decisionTimer = randomRange(0.8, 1.25);
      bot.goalCommitmentTimer = randomRange(1.1, 1.7);
      const target = this.chooseFriendlyBotTarget(bot);
      bot.targetX = target.x;
      bot.targetY = target.y;
    }
  }

  private chooseFriendlyBotTarget(bot: Agent) {
    const arenaDiagonal = Math.max(1, Math.hypot(this.arena.width, this.arena.height));
    let best = {
      x: this.player.x,
      y: this.player.y,
      label: "escort:player",
      score: 0,
    };

    const addTarget = (x: number, y: number, label: string, value: number) => {
      const target = this.findOpenPoint(x, y, bot.collisionRadius + 8);
      const distCost = distance(bot.x, bot.y, target.x, target.y) / arenaDiagonal;
      const score = value - distCost * 1.8 + randomRange(-0.05, 0.05);

      if (score > best.score) {
        best = { x: target.x, y: target.y, label, score };
      }
    };

    for (const node of this.nodes) {
      const value =
        node.owner === "neutral"
          ? 3.1
          : node.owner === "enemy"
            ? 2.55 + (node.supplied ? 0.5 : 0)
            : node.supplied
              ? 0.25
              : 1.2;
      addTarget(node.x, node.y, node.owner === "neutral" ? "capture:neutral-mini" : "capture:enemy-mini", value);
    }

    const nearbyEnemy = this.getActiveEnemies()
      .filter((enemy) => distance(enemy.x, enemy.y, bot.x, bot.y) < bot.visionRadius + 160)
      .sort((a, b) => distance(a.x, a.y, bot.x, bot.y) - distance(b.x, b.y, bot.x, bot.y))[0];

    if (nearbyEnemy) {
      addTarget(nearbyEnemy.x, nearbyEnemy.y, "attack:enemy-core", bot.role === "interceptor" ? 2.25 : 1.45);
    }

    if (bot.health < bot.maxHealth * 0.42) {
      addTarget(bot.baseX, bot.baseY, "recover:base", 3.8);
    }

    bot.selectedTarget = best.label;
    bot.targetScore = best.score;
    bot.goalType = best.label.includes("recover") ? "recoverAtBase" : best.label.includes("enemy-core") ? "attackPlayer" : "captureNeutralBase";
    return { x: best.x, y: best.y };
  }

  private moveAgent(agent: Agent, dt: number) {
    if (!agent.active || agent.isRespawning) {
      agent.velocityX = 0;
      agent.velocityY = 0;
      return;
    }

    const sample = this.sampleInfluence(agent.x, agent.y, agent.influenceRadius * 0.9);
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
    const intendedX = agent.x + dirX * step;
    const intendedY = agent.y + dirY * step;
    const next = this.clampToArena(
      intendedX,
      intendedY,
      agent.collisionRadius + 8,
    );

    agent.velocityX = (next.x - agent.x) / Math.max(dt, 0.001);
    agent.velocityY = (next.y - agent.y) / Math.max(dt, 0.001);
    agent.x = next.x;
    agent.y = next.y;
    if (
      this.boundaryRippleCooldown <= 0 &&
      (Math.abs(next.x - intendedX) > 0.01 || Math.abs(next.y - intendedY) > 0.01)
    ) {
      this.boundaryRippleCooldown = 0.38;
      this.addRipple(next.x, next.y, "collision", agent.bodyRadius + 32);
      this.addParticle(next.x, next.y, agent.kind, 0.7);
    }
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

      if (lateral > blockerRadius + agent.collisionRadius + 22) {
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
    const healthRatio = enemy.health / Math.max(1, enemy.maxHealth);
    const playerKnown = this.isPlayerVisibleToEnemy(enemy);
    const enemyMainThreat = this.bases.some(
      (base) =>
        base.team === "enemy" &&
        (base.captureProgress > 0.08 ||
          distance(this.player.x, this.player.y, base.x, base.y) < base.radius + this.player.combatRadius + 90),
    );
    const playerHasForwardBase = this.nodes.some((node) => node.owner === "player" && node.supplied);
    const playerWeak =
      playerKnown &&
      (this.player.health / Math.max(1, this.player.maxHealth) < 0.44 ||
        this.sampleInfluence(this.player.x, this.player.y, this.player.influenceRadius).player < 0.24);
    const attackChance =
      (enemy.type === "hunter" ? 0.24 : enemy.type === "splitter" ? 0.16 : 0.08) *
      difficulty.aggression *
      (playerWeak ? 1.9 : 1);
    const shouldAttack = playerKnown && allowed.includes("attack") && Math.random() < attackChance && this.elapsedSeconds > 18;
    const canContest = allowed.includes("contest") && (playerHasForwardBase || this.findBestFrontlineDot(enemy));

    if (healthRatio < difficulty.retreatHealth) {
      enemy.mode = healthRatio < 0.22 ? "retreat" : "recover";
      enemy.modeTimer = randomRange(1.4, 2.5);
    } else if (allowed.includes("defend") && enemyMainThreat) {
      enemy.mode = "defend";
      enemy.modeTimer = randomRange(1.2, 2.6);
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
    const playerKnown = this.isPlayerVisibleToEnemy(enemy);
    const playerBase = this.bases.find((base) => base.team === "player");
    const enemyBase = this.bases.find((base) => base.team === "enemy");
    const playerWeaknessValue =
      playerKnown && !this.player.isRespawning
        ? (1 - playerHealthRatio) * 2.4 +
          (this.player.localTerritory !== "base" && this.player.localTerritory !== "miniBase" ? 0.55 : 0)
        : 0;
    const occupiedTargets = new Map<string, number>();

    for (const other of this.getActiveEnemies()) {
      if (other.id === enemy.id || other.goalCommitmentTimer <= 0) {
        continue;
      }

      occupiedTargets.set(other.selectedTarget, (occupiedTargets.get(other.selectedTarget) ?? 0) + 1);
    }

    const candidates: Array<{ x: number; y: number; label: string; goal: AIGoalType; score: number }> = [];

    const addCandidate = (x: number, y: number, label: string, goal: AIGoalType, value: number) => {
      const target = this.findOpenPoint(x, y, enemy.collisionRadius + 10);
      const targetDistance = distance(enemy.x, enemy.y, target.x, target.y);
      const distanceCost = (targetDistance / Math.max(1, arenaDiagonal)) * (this.aiDifficulty === "hard" ? 1.25 : 1.9);
      const friendlyBaseSupport = this.nodes.some(
        (node) => node.owner === "enemy" && node.supplied && distance(node.x, node.y, target.x, target.y) < SUPPLY_LINK_RADIUS * 0.65,
      )
        ? 0.45
        : 0;
      const playerDanger =
        playerKnown && distance(this.player.x, this.player.y, target.x, target.y) < this.player.combatRadius + enemy.combatRadius + 80
          ? 0.42 + (this.player.health / Math.max(1, this.player.maxHealth)) * 0.24
          : 0;
      const safetyValue = friendlyBaseSupport - playerDanger;
      const supportValue = this.countNearbyEnemies(target.x, target.y, enemy.visionRadius * 0.9, enemy.id) * 0.28;
      const duplicatePenalty = (occupiedTargets.get(label) ?? 0) * (goal === "defendMainBase" ? 0.18 : 0.72);
      const difficultyBonus =
        this.aiDifficulty === "hard" && (goal === "cutSupplyLine" || goal === "defendMainBase" || goal === "recaptureLostBase")
          ? 0.46
          : this.aiDifficulty === "easy"
            ? randomRange(-0.35, 0.12)
            : 0;
      candidates.push({
        x: target.x,
        y: target.y,
        goal,
        label,
        score:
          value +
          safetyValue +
          supportValue +
          difficultyBonus -
          distanceCost -
          duplicatePenalty +
          randomRange(-difficulty.randomness, difficulty.randomness),
      });
    };

    const threatenedEnemyBase =
      enemyBase &&
      (enemyBase.captureProgress > 0.02 ||
        distance(this.player.x, this.player.y, enemyBase.x, enemyBase.y) < enemyBase.radius + this.player.combatRadius + 112)
        ? enemyBase
        : null;

    addCandidate(
      enemy.baseX,
      enemy.baseY,
      healthRatio < 0.22 ? "retreat:main-base" : "recover:main-base",
      healthRatio < difficulty.retreatHealth ? "retreat" : "recoverAtBase",
      healthRatio < difficulty.retreatHealth ? 5.8 : healthRatio < 0.7 ? 1.1 : 0.35,
    );

    if (threatenedEnemyBase) {
      addCandidate(
        threatenedEnemyBase.x,
        threatenedEnemyBase.y,
        "defend:main-base",
        "defendMainBase",
        6.8 +
          threatenedEnemyBase.captureProgress * 8 +
          (enemy.role === "defender" ? 1.4 : 0) +
          (this.aiDifficulty === "easy" ? -1.2 : this.aiDifficulty === "hard" ? 1.2 : 0),
      );
    }

    for (const node of this.nodes) {
      const nodeThreatened =
        node.owner === "enemy" &&
        distance(this.player.x, this.player.y, node.x, node.y) < node.radius + this.player.combatRadius + 76;
      const goal: AIGoalType =
        node.owner === "neutral"
          ? "captureNeutralBase"
          : node.owner === "player"
            ? node.supplied
              ? "cutSupplyLine"
              : "capturePlayerOutpost"
            : nodeThreatened
              ? "defendOutpost"
              : !node.supplied
                ? "recaptureLostBase"
                : "defendOutpost";
      const objectiveValue =
        goal === "captureNeutralBase"
          ? 2.65
          : goal === "cutSupplyLine"
            ? 3.85
            : goal === "capturePlayerOutpost"
              ? 3.15
              : goal === "recaptureLostBase"
                ? 3.35
                : nodeThreatened
                  ? 4.35
                  : 0.9;
      const urgency =
        node.captureBy === "player"
          ? node.captureProgress * 3.7
          : node.owner === "player" && node.supplied
            ? 0.7
            : node.owner === "neutral"
              ? 0.3
              : 0;
      const roleBonus =
        enemy.role === "capturer" && (goal === "captureNeutralBase" || goal === "capturePlayerOutpost")
          ? 1.05
          : enemy.role === "defender" && (goal === "defendOutpost" || goal === "recaptureLostBase")
            ? 1.2
            : enemy.role === "interceptor" && goal === "cutSupplyLine"
              ? 1
              : enemy.role === "support" && node.owner === "enemy"
                ? 0.8
                : 0;

      if (this.aiDifficulty === "easy" && node.owner === "neutral" && Math.random() > difficulty.nodeFocus) {
        continue;
      }

      const label =
        node.owner === "neutral"
          ? "capture:neutral-mini"
          : node.owner === "player"
            ? node.supplied
              ? "cut-supply:player-mini"
              : "attack:isolated-mini"
            : nodeThreatened
              ? "defend:mini-base"
              : !node.supplied
                ? "reconnect:mini-base"
              : "hold:mini-base";
      addCandidate(node.x, node.y, label, goal, (objectiveValue + urgency) * difficulty.nodeFocus + roleBonus);
    }

    if (playerKnown && this.levelConfig.number >= 3 && this.elapsedSeconds > 18 && !this.player.isRespawning) {
      const favorableFight =
        healthRatio > playerHealthRatio + 0.08 ||
        enemy.localTerritory === "base" ||
        enemy.localTerritory === "miniBase" ||
        enemy.role === "hunter";
      const huntAllowed = Math.random() < difficulty.huntChance || enemy.mode === "attack" || enemy.role === "hunter";

      if (favorableFight && huntAllowed) {
        const roleBonus = enemy.role === "hunter" ? 1.7 : enemy.role === "interceptor" ? 0.7 : -0.15;
        addCandidate(
          this.player.x,
          this.player.y,
          "attack:player",
          "attackPlayer",
          1.6 + playerWeaknessValue * difficulty.aggression + roleBonus,
        );
      }
    }

    if (playerBase && this.levelConfig.number >= 2) {
      const playerOwnedMinis = this.nodes.filter((node) => node.owner === "player").length;
      const basePressure =
        1.1 * difficulty.aggression +
        (this.aiDifficulty === "hard" ? playerOwnedMinis * 0.22 : 0) +
        (enemy.role === "defender" ? -0.35 : enemy.role === "capturer" ? 0.45 : 0);
      addCandidate(playerBase.x, playerBase.y, "attack:player-main-base", "capturePlayerOutpost", basePressure);
    }

    const predictedRoute = this.predictPlayerRouteTarget();
    if (predictedRoute && (this.aiDifficulty === "hard" || (this.aiDifficulty === "medium" && predictedRoute.confidence > 0.72))) {
      addCandidate(
        predictedRoute.x,
        predictedRoute.y,
        `intercept:${predictedRoute.route}`,
        "interceptPlayer",
        (enemy.role === "interceptor" ? 2.35 : 1.25) * predictedRoute.confidence,
      );
    }

    if (candidates.length === 0) {
      const fallback = this.findOpenPoint(enemy.baseX, enemy.baseY, enemy.collisionRadius + 10);
      enemy.selectedTarget = "fallback:base";
      enemy.targetScore = 0;
      enemy.goalType = "recoverAtBase";
      return fallback;
    }

    candidates.sort((a, b) => b.score - a.score);
    let selected =
      Math.random() < difficulty.badChoiceChance
        ? candidates[Math.min(candidates.length - 1, randomInt(0, Math.min(2, candidates.length - 1)))]
        : candidates[0];

    if (enemy.goalCommitmentTimer > 0 && enemy.selectedTarget) {
      const committed = candidates.find((candidate) => candidate.label === enemy.selectedTarget);
      const switchThreshold = this.aiDifficulty === "hard" ? 1.25 : this.aiDifficulty === "medium" ? 1.55 : 2.3;

      if (committed && selected.score < committed.score + switchThreshold) {
        selected = committed;
      }
    }

    enemy.selectedTarget = selected.label;
    enemy.targetScore = selected.score;
    enemy.goalType = selected.goal;
    enemy.goalCommitmentTimer = randomRange(
      this.aiDifficulty === "hard" ? 1 : 1.35,
      this.aiDifficulty === "easy" ? 2.4 : 1.9,
    );

    if (selected.label.includes("player")) {
      enemy.mode = "attack";
    } else if (selected.label.includes("defend") || selected.label.includes("hold")) {
      enemy.mode = "defend";
    } else if (selected.label.includes("cut-supply") || selected.label.includes("isolated")) {
      enemy.mode = "contest";
    } else if (selected.label.includes("base") && healthRatio < difficulty.retreatHealth) {
      enemy.mode = "retreat";
    } else if (selected.label.includes("mini") || selected.label.includes("capture")) {
      enemy.mode = "expand";
    }

    return { x: selected.x, y: selected.y };
  }

  private predictPlayerRouteTarget() {
    if (this.player.isRespawning || !this.player.active || this.elapsedSeconds < 12) {
      return null;
    }

    const route =
      this.player.y < this.arena.y + this.arena.height * 0.34
        ? "top"
        : this.player.y > this.arena.y + this.arena.height * 0.66
          ? "bottom"
          : "center";
    const forwardNodes = this.nodes
      .filter((node) => node.owner !== "enemy")
      .map((node) => ({
        node,
        score:
          (node.owner === "neutral" ? 1.2 : 1.8) -
          Math.abs(node.y - this.player.y) / Math.max(1, this.arena.height) -
          distance(this.player.x, this.player.y, node.x, node.y) / Math.max(1, Math.hypot(this.arena.width, this.arena.height)),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!forwardNodes || forwardNodes.score < 0.15) {
      return null;
    }

    return {
      x: forwardNodes.node.x,
      y: forwardNodes.node.y,
      route,
      confidence: clamp(0.42 + forwardNodes.score * 0.3 + (this.aiDifficulty === "hard" ? 0.18 : 0), 0, 0.92),
    };
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

    return bestNode ? this.findOpenPoint(bestNode.x, bestNode.y, enemy.collisionRadius + 10) : null;
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

      for (const bot of this.friendlyBots) {
        if (bot.active && !bot.isRespawning) {
          this.resolveAgentPairCollision(bot, enemy, true, dt);
        }
      }
    }

    const enemies = this.getActiveEnemies();

    for (let i = 0; i < enemies.length; i += 1) {
      for (let j = i + 1; j < enemies.length; j += 1) {
        this.resolveAgentPairCollision(enemies[i], enemies[j], false, dt);
      }
    }

    for (const bot of this.friendlyBots) {
      if (bot.active && !bot.isRespawning && !this.player.isRespawning) {
        this.resolveAgentPairCollision(this.player, bot, false, dt);
      }
    }
  }

  private resolveAgentPairCollision(a: Agent, b: Agent, isPlayerEnemy: boolean, dt: number) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const coreDistance = Math.max(0.001, Math.hypot(dx, dy));
    const minDistance = a.collisionRadius + b.collisionRadius + (isPlayerEnemy ? 3 : 2);

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
      const nextA = this.clampToArena(a.x - nx * overlap * aShare, a.y - ny * overlap * aShare, a.collisionRadius + 8);
      a.x = nextA.x;
      a.y = nextA.y;
      a.targetX = a.kind === "player" ? a.x : a.targetX;
      a.targetY = a.kind === "player" ? a.y : a.targetY;
    }

    if (b.canMove) {
      const nextB = this.clampToArena(b.x + nx * overlap * bShare, b.y + ny * overlap * bShare, b.collisionRadius + 8);
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

    void dt;
  }

  private getCombatDamagePerSecond(agent: Agent, opponent: Agent) {
    const sample = this.sampleInfluence(agent.x, agent.y, agent.influenceRadius * 0.9);
    const ownTerritory = agent.kind === "player" ? sample.player : sample.infection;
    const enemyTerritory = agent.kind === "player" ? sample.infection : sample.player;
    const territoryBonus = ownTerritory > 0.45 ? 1.15 : enemyTerritory > 0.45 ? 0.85 : 1;
    const nodeCount = this.nodes.filter((node) => node.owner === agent.kind).length;
    const nodeBonus = 1 + nodeCount * 0.035;
    const shieldBonus = agent.shield > agent.maxShield * 0.45 ? 1.08 : 1;
    const healthPressure = opponent.health < opponent.maxHealth * 0.35 ? 1.08 : 1;
    return agent.power * territoryBonus * nodeBonus * shieldBonus * healthPressure;
  }

  private updateCombatState(agent: Agent, opponent: Agent, contactTime: number, overpowering: boolean) {
    agent.contactTimer = Math.max(agent.contactTimer, contactTime);

    if (agent.breakTimer > 0) {
      agent.combatState = "break";
      return;
    }

    if (overpowering && contactTime >= 0.5) {
      agent.combatState = "overpower";
      return;
    }

    agent.combatState = contactTime >= 0.5 ? "clash" : "contact";

    if (contactTime >= 0.5 && overpowering && opponent.canMove) {
      const dx = opponent.x - agent.x;
      const dy = opponent.y - agent.y;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      const push = 8;
      const target = this.clampToArena(
        opponent.x + (dx / length) * push,
        opponent.y + (dy / length) * push,
        opponent.collisionRadius + 8,
      );
      opponent.x = target.x;
      opponent.y = target.y;
    }
  }

  private emitCombatEffects(
    player: Agent,
    enemy: Agent,
    midpointX: number,
    midpointY: number,
    sustained: boolean,
    playerDamage: number,
    enemyDamage: number,
  ) {
    const cadence = sustained ? 0.1 : 0.18;

    if (player.effectTickTimer > 0 && enemy.effectTickTimer > 0) {
      return;
    }

    player.effectTickTimer = cadence;
    enemy.effectTickTimer = cadence;
    const advantageKind: ParticleKind =
      playerDamage > enemyDamage * 1.12
        ? "clashPlayer"
        : enemyDamage > playerDamage * 1.12
          ? "clashEnemy"
          : "clashEven";
    this.addRipple(midpointX, midpointY, "collision", sustained ? 34 : 24);
    this.addParticle(midpointX + randomRange(-7, 7), midpointY + randomRange(-7, 7), advantageKind, sustained ? 1.05 : 0.76);

    if (sustained) {
      this.addParticle(midpointX + randomRange(-8, 8), midpointY + randomRange(-8, 8), advantageKind, 0.82);
    }

    if (sustained) {
      this.addContestedZone(midpointX, midpointY, 54);
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
      const minDistance = agent.collisionRadius + blockerRadius + 4;

      if (agentDistance >= minDistance) {
        continue;
      }

      const push = minDistance - agentDistance;
      const next = this.clampToArena(
        agent.x + (dx / agentDistance) * push,
        agent.y + (dy / agentDistance) * push,
        agent.collisionRadius + 8,
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
      ? smoothstep(nearestEnemy.influenceRadius * 0.92, 0, nearestDistance) * 0.18
      : 0;

    this.player.intensity = clamp(1 - playerSuppression, 0.72, 1);

    for (const enemy of activeEnemies) {
      const duelDistance = distance(this.player.x, this.player.y, enemy.x, enemy.y);
      const suppression = smoothstep(enemy.influenceRadius, 0, duelDistance) * 0.42;
      enemy.intensity = clamp(0.96 - suppression, 0.38, 0.98);
    }

    this.playerField = {
      active: true,
      x: this.player.x,
      y: this.player.y,
      radius: this.player.influenceRadius,
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
      radius: nearestEnemy.influenceRadius,
      intensity: nearestEnemy.intensity,
    };
  }

  private updateNodes(dt: number) {
    let supplyDirty = false;

    for (const node of this.nodes) {
      const capturePadding = 20;
      const playerInside =
        !this.player.isRespawning &&
        this.player.active &&
        distance(this.player.x, this.player.y, node.x, node.y) < node.radius + this.player.collisionRadius + capturePadding;
      const friendlyBotsInside = this.friendlyBots.filter(
        (bot) =>
          bot.active &&
          !bot.isRespawning &&
          distance(bot.x, bot.y, node.x, node.y) < node.radius + bot.collisionRadius + capturePadding,
      );
      const enemyInside = this.getActiveEnemies().some(
        (enemy) => distance(enemy.x, enemy.y, node.x, node.y) < node.radius + enemy.collisionRadius + capturePadding,
      );
      const playerTeamInside = playerInside || friendlyBotsInside.length > 0;
      const playerCaptureRate = playerInside
        ? 1
        : friendlyBotsInside.length > 0
          ? Math.min(0.65, friendlyBotsInside.reduce((sum, bot) => sum + bot.captureRate, 0))
          : 0;

      if (playerTeamInside && enemyInside) {
        if (node.captureBy) {
          node.captureProgress = Math.max(0, node.captureProgress - dt * 0.06);
        }
      } else {
        const capturer = playerTeamInside ? "player" : enemyInside ? "enemy" : null;
        const captureRate = capturer === "player" ? playerCaptureRate : capturer === "enemy" ? 1 : 0;

        if (!capturer || capturer === node.owner) {
          node.captureProgress = Math.max(0, node.captureProgress - dt * (capturer === node.owner ? 0.48 : 0.26));
          node.captureBy = null;
        } else {
          if (node.captureBy !== capturer) {
            node.captureBy = capturer;
            node.captureProgress = 0;
          }

          node.captureProgress += (dt * captureRate) / NODE_CAPTURE_SECONDS;

          if (node.captureProgress >= 1) {
            const previousOwner = node.owner;
            node.owner = capturer;
            node.captureProgress = 0;
            node.captureBy = null;
            node.pulseTimer = 0.35;
            supplyDirty = true;
            if (previousOwner === "player" || capturer === "player") {
              this.applyCoreLevelStats(this.player);
            }
            if (previousOwner === "enemy" || capturer === "enemy") {
              for (const enemy of this.enemies) {
                this.applyCoreLevelStats(enemy);
              }
            }
            if (capturer === "player") {
              this.grantPlayerXp(XP_NODE_CAPTURED);
              this.showHint("mini-base-captured", "Mini-base captured. +10 max health and healing station online.", false);
            } else {
              for (const enemy of this.getActiveEnemies()) {
                if (distance(enemy.x, enemy.y, node.x, node.y) < enemy.influenceRadius + node.radius + 20) {
                  this.maybeLevelEnemy(enemy, 28 * this.getDifficultySettings().enemyXpRate);
                }
              }
            }
            this.addRipple(node.x, node.y, "node", 96);
          }
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

    if (supplyDirty) {
      this.updateBaseSupply();
    }
  }

  private updateBaseSupply() {
    for (const node of this.nodes) {
      node.supplied = node.owner !== "neutral";
      node.supplyParentId = null;
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
    const radius = enemy.type === "root" ? enemy.influenceRadius * 1.65 : enemy.influenceRadius * 1.38;
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

  }

  private updatePulses(dt: number) {
    const started = typeof performance !== "undefined" ? performance.now() : 0;
    let shockwaveProcessedThisFrame = false;

    for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.pulses[index];
      pulse.age += dt;

      if (pulse.currentRadius < pulse.maxRadius) {
        pulse.previousRadius = pulse.currentRadius;
        pulse.currentRadius = Math.min(pulse.maxRadius, pulse.currentRadius + pulse.speed * dt);
        this.applyPulseToEnemies(pulse);
      } else {
        pulse.previousRadius = pulse.currentRadius;
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
      enemy.revealTimer = ENEMY_REVEAL_SECONDS;
      this.damageEnemy(enemy, edge * (pulse.kind === "shockwave" ? 0.42 : 0.18));
      enemy.slowTimer = Math.max(enemy.slowTimer, pulse.kind === "shockwave" ? 1.1 : 0.42);

      if (pulse.kind === "shockwave" && enemy.canMove) {
        enemy.lastClashAt = this.time;
        enemy.combatLockoutTimer = COMBAT_LOCKOUT_SECONDS;
        this.player.lastDamageDealtAt = this.time;
        enemy.breakTimer = Math.max(enemy.breakTimer, 0.42 + edge * 0.18);
        enemy.combatState = "break";
        enemy.hitFlashTimer = Math.max(enemy.hitFlashTimer, 0.18);
        const dx = enemy.x - pulse.x;
        const dy = enemy.y - pulse.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const push = 52 + edge * 68;
        const target = this.clampToArena(enemy.x + (dx / length) * push, enemy.y + (dy / length) * push, enemy.collisionRadius + 10);
        enemy.targetX = target.x;
        enemy.targetY = target.y;
      }
    }
  }

  private getPulseBand(pulse: ActivePulse) {
    return pulse.kind === "shockwave" ? 48 : 34;
  }

  private cleanseWithPlayer(dt: number) {
    const sample = this.sampleInfluence(this.player.x, this.player.y, this.player.influenceRadius * 0.9);
    const homeBonus = sample.player > 0.45 ? 1.15 : 1;
    const wellBonus = this.getEnergyWellBonus();
    const viscosity = this.getViscosityAt(this.player.x, this.player.y);

    for (const dot of this.dots) {
      const playerDistance = dot.distanceTo(this.player.x, this.player.y);

      if (playerDistance >= this.player.influenceRadius) {
        continue;
      }

      const localViscosity = this.dotViscosity[dot.id] ?? 0;
      const influence = smoothstep(this.player.influenceRadius, 0, playerDistance) * this.player.intensity;
      const cleansePower =
        influence *
        dt *
        DIRECT_CLEANSE_SCALE *
        homeBonus *
        wellBonus *
        (1 + Math.max(viscosity, localViscosity) * 0.9);

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
        dot.playerAmount = clamp(dot.playerAmount + influence * dt * DIRECT_CLEANSE_SCALE * 0.72 * homeBonus * wellBonus, 0, 1);
      }
    }

    this.damageEnemiesNearPlayer(dt);
  }

  private damageEnemiesNearPlayer(dt: number) {
    for (const enemy of this.getActiveEnemies()) {
      this.resolveCombatDamage(this.player, enemy, dt, 1);

      for (const bot of this.friendlyBots) {
        if (bot.active && !bot.isRespawning) {
          this.resolveCombatDamage(bot, enemy, dt, 0.62);
        }
      }
    }
  }

  private resolveCombatDamage(playerSide: Agent, enemy: Agent, dt: number, playerDamageScale: number) {
      const playerDistance = distance(playerSide.x, playerSide.y, enemy.x, enemy.y);
      const combatRange = playerSide.combatRadius + enemy.combatRadius;

      if (playerDistance > combatRange) {
        return;
      }

      if (
        playerSide.invulnerableTimer > 0 ||
        enemy.invulnerableTimer > 0 ||
        playerSide.isRespawning ||
        enemy.isRespawning
      ) {
        return;
      }

      const bodyRange = playerSide.bodyRadius + enemy.bodyRadius;
      const falloffDistance = Math.max(1, combatRange - bodyRange);
      const engagement =
        playerDistance <= bodyRange
          ? 1
          : clamp(1 - (playerDistance - bodyRange) / falloffDistance, 0.35, 1);
      const playerDamage = this.getCombatDamagePerSecond(playerSide, enemy) * engagement * playerDamageScale;
      const enemyDamage = this.getCombatDamagePerSecond(enemy, playerSide) * this.getDifficultySettings().clashPressure * engagement;
      const contactTime = Math.min(Math.max(playerSide.contactTimer, enemy.contactTimer) + dt, 1.6);
      const sustained = contactTime >= 0.5;
      const playerOverpowering = playerDamage > enemyDamage * 1.35;
      const enemyOverpowering = enemyDamage > playerDamage * 1.35;
      const midpointX = (playerSide.x + enemy.x) / 2;
      const midpointY = (playerSide.y + enemy.y) / 2;

      playerSide.lastClashAt = this.time;
      playerSide.combatLockoutTimer = COMBAT_LOCKOUT_SECONDS;
      enemy.lastClashAt = this.time;
      enemy.combatLockoutTimer = COMBAT_LOCKOUT_SECONDS;
      this.updateCombatState(playerSide, enemy, contactTime, playerOverpowering);
      this.updateCombatState(enemy, playerSide, contactTime, enemyOverpowering);
      this.emitCombatEffects(playerSide, enemy, midpointX, midpointY, sustained, playerDamage, enemyDamage);

      if (playerSide.breakTimer > 0 || enemy.breakTimer > 0) {
        return;
      }

      this.applyCoreDamage(enemy, playerDamage * dt, playerSide);
      this.applyCoreDamage(playerSide, enemyDamage * dt, playerSide.isMinion ? undefined : enemy);
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

    this.markCoreCombat(target, source);
    const incomingMultiplier = target.kind === "player" && this.shieldTimer > 0 ? 0.5 : 1;
    let remaining = amount * incomingMultiplier;

    if (target.shield > 0) {
      const shieldHit = Math.min(target.shield, remaining);
      target.shield -= shieldHit;
      remaining -= shieldHit;

      if (shieldHit > 0) {
        target.shieldFlashTimer = Math.max(target.shieldFlashTimer, 0.18);
      }
    }

    if (remaining > 0) {
      target.health = clamp(target.health - remaining, 0, target.maxHealth);
      target.hitFlashTimer = Math.max(target.hitFlashTimer, 0.16);
      target.healthPulseTimer = Math.max(target.healthPulseTimer, 0.22);
      this.addRipple(target.x, target.y, target.kind, target.bodyRadius + 14);
    }

    if (target.health > 0) {
      return;
    }

    if (target.isMinion) {
      this.destroyFriendlyBot(target);
    } else if (target.kind === "player") {
      this.destroyPlayerCore();
    } else {
      this.destroyEnemyCore(target, source?.kind === "player");
    }
  }

  private destroyFriendlyBot(bot: Agent) {
    if (!bot.active) {
      return;
    }

    bot.active = false;
    bot.isRespawning = false;
    bot.health = 0;
    bot.shield = 0;
    bot.velocityX = 0;
    bot.velocityY = 0;
    this.addRipple(bot.x, bot.y, "player", bot.radius + 42);
    this.spawnBurst(bot.x, bot.y, "player", 12, 0.72);
  }

  private destroyEnemyCore(enemy: Agent, killedByPlayer = true) {
    if (enemy.isRespawning) {
      return;
    }

    enemy.active = false;
    enemy.isRespawning = true;
    enemy.respawnTimer = 9;
    enemy.velocityX = 0;
    enemy.velocityY = 0;
    enemy.targetX = enemy.baseX;
    enemy.targetY = enemy.baseY;
    enemy.health = 0;
    enemy.shield = 0;
    this.enemyDeaths += 1;
    this.addRipple(enemy.x, enemy.y, "enemy", enemy.radius + 118);
    this.spawnBurst(enemy.x, enemy.y, "enemy", 42, 1.55);
    this.neutralizeNearbyDots(enemy.x, enemy.y, enemy.influenceRadius * 1.1, "enemy", 0.34);

    if (killedByPlayer) {
      this.grantPlayerXp(XP_ENEMY_KILL);
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
    core.invulnerableTimer = core.kind === "player" ? 2.4 : 0;
    const respawnAngle = core.kind === "player" ? 0 : -Math.PI * 0.75 + core.id * 0.72;
    const respawnDistance = core.kind === "player" ? 0 : this.width < 720 ? 28 : 42;
    const respawnPoint = this.clampToArena(
      core.baseX + Math.cos(respawnAngle) * respawnDistance,
      core.baseY + Math.sin(respawnAngle) * respawnDistance,
      core.collisionRadius + 10,
    );
    core.x = respawnPoint.x;
    core.y = respawnPoint.y;
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
        child.bodyRadius + 10,
      );
      child.baseRadius = 11;
      child.baseCombatRadius = 22;
      child.bodyRadius = 11;
      child.collisionRadius = 13;
      child.combatRadius = 22;
      child.radius = 11;
      const childLegacyFieldRadius = this.width < 720 ? 58 : 68;
      child.baseInfluenceRadius = childLegacyFieldRadius * 0.5;
      child.baseVisionRadius = Math.max(childLegacyFieldRadius * 1.25, child.baseInfluenceRadius + 54);
      child.influenceRadius = child.baseInfluenceRadius;
      child.visionRadius = child.baseVisionRadius;
      child.fieldRadius = child.influenceRadius;
      child.speed = (this.width < 720 ? 86 : 108) * config.enemySpeedScale * CORE_SPEED_SCALE;
      child.moveSpeed = child.speed;
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
      const sample = this.sampleInfluence(enemy.x, enemy.y, enemy.influenceRadius * 0.9);
      let territoryModifier = 1;

      if (sample.player > 0.45) {
        territoryModifier *= 0.85;
      }

      if (sample.infection > 0.45) {
        territoryModifier *= 1.15;
      }

      for (const dot of this.dots) {
        const enemyDistance = dot.distanceTo(enemy.x, enemy.y);

        if (enemyDistance >= enemy.influenceRadius) {
          continue;
        }

        const localViscosity = this.dotViscosity[dot.id] ?? 0;
        const influence = smoothstep(enemy.influenceRadius, 0, enemyDistance) * enemy.intensity;
        const infectionPower =
          influence *
          dt *
          DIRECT_INFECT_SCALE *
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

      const playerInfluence = smoothstep(this.player.influenceRadius, 0, dot.distanceTo(this.player.x, this.player.y));
      let enemyInfluence = 0;

      for (const enemy of this.getActiveEnemies()) {
        enemyInfluence = Math.max(enemyInfluence, smoothstep(enemy.influenceRadius, 0, dot.distanceTo(enemy.x, enemy.y)) * enemy.intensity);
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

    const supplyBonus = this.player.localTerritory === "base" ? 1.45 : this.player.localTerritory === "miniBase" ? 1.22 : 1;
    const nodeBonus = this.nodes.filter((node) => node.owner === "player" && node.supplied).length * 0.08;
    const wellBonus = this.getEnergyWellBonus();
    this.shockwaveCharge = clamp(this.shockwaveCharge + dt * 0.032 * (supplyBonus + nodeBonus) * wellBonus, 0, 1);
  }

  private sacrificePlayerTerritory() {
    this.shockwaveCharge = Math.max(0, this.shockwaveCharge - 0.08);
  }

  private resolveStates() {
    let fogChanged = false;

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
        if (previousState === "infected" && nextState === "player") {
          this.grantPlayerXp(XP_DOT_CLEANSED);
        }

        this.addParticle(dot.x, dot.y, nextState === "player" ? "player" : "enemy", 1.1);
      }

      if (nextState === "player" && this.playerFog[dot.id] < 1) {
        this.playerFog[dot.id] = 1;
        fogChanged = true;
      }
    }

    if (fogChanged) {
      this.fogRevision += 1;
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
    const playerBase = this.bases.find((base) => base.team === "player");
    const enemyBaseCaptured = this.bases.some(
      (base) => base.team === "enemy" && base.captureBy === "player" && base.captureProgress >= 1,
    );

    if (enemyBaseCaptured) {
      this.status = "won";
      return;
    }

    if (playerBase?.captureBy === "enemy" && playerBase.captureProgress >= 1) {
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

  private addParticle(x: number, y: number, kind: ParticleKind, size = 1) {
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

  private spawnBurst(x: number, y: number, kind: ParticleKind, count: number, size = 1) {
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

  private findNearestDot(x: number, y: number): Dot | null {
    const cellX = Math.floor(x / DOT_GRID_CELL_SIZE);
    const cellY = Math.floor(y / DOT_GRID_CELL_SIZE);
    let nearest: Dot | null = null;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;

    for (let radius = 0; radius <= 2; radius += 1) {
      for (let yOffset = -radius; yOffset <= radius; yOffset += 1) {
        for (let xOffset = -radius; xOffset <= radius; xOffset += 1) {
          if (Math.max(Math.abs(xOffset), Math.abs(yOffset)) !== radius) {
            continue;
          }

          const bucket = this.dotGrid.get(`${cellX + xOffset}:${cellY + yOffset}`);

          if (!bucket) {
            continue;
          }

          for (const dotId of bucket) {
            const dot = this.dots[dotId];
            const dx = dot.baseX - x;
            const dy = dot.baseY - y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < nearestDistanceSq) {
              nearest = dot;
              nearestDistanceSq = distanceSq;
            }
          }
        }
      }

      if (nearest) {
        return nearest;
      }
    }

    return nearest;
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

      if (wellDistance > well.radius + this.player.collisionRadius + 20) {
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

  private isInsideArenaBounds(x: number, y: number, padding: number) {
    return (
      x >= this.arena.x + padding &&
      x <= this.arena.right - padding &&
      y >= this.arena.y + padding &&
      y <= this.arena.bottom - padding
    );
  }
}
