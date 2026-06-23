"use client";

import {
  Activity,
  Bug,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Timer,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type AIDifficulty, type GameDebugStats, type GameStats } from "@/lib/game/Game";
import { PixiGameCanvas } from "@/components/PixiGameCanvas";

const initialStats: GameStats = {
  totalDots: 0,
  infectedCount: 0,
  cleansedCount: 0,
  neutralCount: 0,
  elapsedSeconds: 0,
  remainingSeconds: 300,
  infectionLevel: 0,
  playerCoverage: 0,
  shockwaveCharge: 100,
  shockwaveReady: true,
  shieldReady: false,
  shieldCooldown: 12,
  shieldCooldownRemaining: 0,
  shieldActive: false,
  shieldTimer: 0,
  playerLevel: 1,
  playerXp: 0,
  playerNextLevelXp: 80,
  playerHealth: 120,
  playerMaxHealth: 120,
  playerShield: 40,
  playerMaxShield: 40,
  playerRespawnTimer: 0,
  nodePlayerCount: 0,
  nodeEnemyCount: 0,
  enemyMode: "expand",
  enemyCount: 0,
  enemyTypes: "none",
  aiDifficulty: "medium",
  level: 1,
  maxLevel: 6,
  levelName: "First Cleanse",
  levelSummary: "No enemy core. Cleanse the seeded infection field.",
  overtimeSeconds: 0,
  stars: 0,
  paused: false,
  status: "playing",
};

type MetricCardProps = {
  label: string;
  value: string;
  tone: "infected" | "clean" | "neutral";
  icon: LucideIcon;
};

type MobileStatProps = MetricCardProps & {
  ariaLabel: string;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

function formatMetricMs(value?: number) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;

  return `${safeValue.toFixed(1)}ms`;
}

function toneStyles(tone: MetricCardProps["tone"]) {
  return {
    infected: {
      icon: "text-[#ff6449] bg-[#fff3ee]",
      value: "text-[#ff6449]",
      ring: "border-[#ffd4c8] bg-[#fff9f6]",
    },
    clean: {
      icon: "text-[#1eaee9] bg-[#edfaff]",
      value: "text-[#1eaee9]",
      ring: "border-[#c7efff] bg-[#f6fdff]",
    },
    neutral: {
      icon: "text-slate-600 bg-slate-100",
      value: "text-slate-700",
      ring: "border-slate-200 bg-white",
    },
  }[tone];
}

function MetricCard({ label, value, tone, icon: Icon }: MetricCardProps) {
  const styles = toneStyles(tone);

  return (
    <div className="rounded-lg border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_48px_rgba(38,55,77,0.09)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span className={`grid size-7 place-items-center rounded-full ${styles.icon}`}>
          <Icon className="size-4" strokeWidth={1.8} />
        </span>
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${styles.value}`}>{value}</div>
    </div>
  );
}

function MobileStat({ label, value, tone, icon: Icon, ariaLabel }: MobileStatProps) {
  const styles = toneStyles(tone);

  return (
    <div
      aria-label={ariaLabel}
      className={`grid size-[74px] place-items-center rounded-full border text-center shadow-[0_18px_42px_rgba(38,55,77,0.12)] backdrop-blur-xl ${styles.ring}`}
    >
      <div>
        <Icon className={`mx-auto size-4 ${styles.value}`} strokeWidth={2} />
        <div className={`mt-1 text-lg font-semibold leading-none ${styles.value}`}>{value}</div>
        <div className="mt-1 text-[10px] font-medium leading-none text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function GameCanvas() {
  const [game] = useState(() => new Game());
  const gameRef = useRef(game);
  const debugVisibleRef = useRef(false);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugStats, setDebugStats] = useState<GameDebugStats | null>(null);

  const syncStats = useCallback(() => {
    const game = gameRef.current;

    if (game) {
      setStats(game.getStats());
    }
  }, []);

  useEffect(() => {
    debugVisibleRef.current = debugVisible;
  }, [debugVisible]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "d" || event.key === "D") && !event.repeat) {
        setDebugVisible((visible) => {
          const nextVisible = !visible;
          debugVisibleRef.current = nextVisible;

          if (!nextVisible) {
            setDebugStats(null);
          }

          return nextVisible;
        });
        return;
      }

      if ((event.key === "e" || event.key === "E") && !event.repeat) {
        event.preventDefault();
        gameRef.current?.activateShield();
        syncStats();
        return;
      }

      if (event.code !== "Space" || event.repeat) {
        return;
      }

      event.preventDefault();
      gameRef.current?.activateShockwave();
      syncStats();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [syncStats]);

  const resetGame = useCallback(() => {
    gameRef.current?.reset();
    syncStats();
  }, [syncStats]);

  const togglePause = useCallback(() => {
    gameRef.current?.togglePause();
    syncStats();
  }, [syncStats]);

  const activateShockwave = useCallback(() => {
    gameRef.current?.activateShockwave();
    syncStats();
  }, [syncStats]);

  const activateShield = useCallback(() => {
    gameRef.current?.activateShield();
    syncStats();
  }, [syncStats]);

  const changeDifficulty = useCallback(
    (difficulty: AIDifficulty) => {
      gameRef.current?.setDifficulty(difficulty);
      syncStats();
    },
    [syncStats],
  );

  const changeLevel = useCallback(
    (delta: number) => {
      gameRef.current?.setLevel(stats.level + delta);
      syncStats();
    },
    [stats.level, syncStats],
  );

  const infectionPercent = Math.round(stats.infectionLevel);
  const statusLabel =
    stats.status === "won"
      ? "Field secured"
      : stats.status === "lost"
        ? "Infection critical"
        : stats.paused
          ? "Paused"
          : "Infection level";
  const pauseLabel = stats.paused ? "Resume game" : "Pause game";
  const PauseIcon = stats.paused ? Play : Pause;
  const shockwaveLabel = stats.shockwaveReady
    ? "Shockwave ready"
    : `Shockwave ${Math.round(stats.shockwaveCharge)} percent charged`;
  const shieldLabel =
    stats.level < 3
      ? "Shield unlocks at level 3"
      : stats.shieldActive
        ? `Shield active ${stats.shieldTimer.toFixed(0)} seconds`
        : stats.shieldReady
          ? "Shield ready"
          : `Shield ${Math.max(0, stats.shieldCooldownRemaining).toFixed(0)} seconds`;
  const playerHealthPercent = Math.round((stats.playerHealth / Math.max(1, stats.playerMaxHealth)) * 100);
  const playerShieldPercent = Math.round((stats.playerShield / Math.max(1, stats.playerMaxShield)) * 100);
  const playerXpLabel =
    Number.isFinite(stats.playerNextLevelXp) && stats.playerLevel < 5
      ? `${stats.playerXp}/${stats.playerNextLevelXp}`
      : "MAX";
  const enemySummary =
    stats.enemyCount > 0
      ? `Enemy ${stats.enemyMode} - ${stats.enemyTypes} - Nodes ${stats.nodePlayerCount}-${stats.nodeEnemyCount}`
      : "No enemy core - cleanse the field";

  return (
    <section
      className="relative min-h-svh w-full overflow-hidden bg-[#eef4f8] text-slate-900"
    >
      <PixiGameCanvas
        debugVisible={debugVisible}
        game={game}
        onDebugStats={setDebugStats}
        onStats={setStats}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-3 pt-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-white/80 bg-white/85 shadow-[0_18px_48px_rgba(38,55,77,0.1)] backdrop-blur-xl sm:size-20">
            <Sparkles className="size-7 text-[#1eaee9] sm:size-8" strokeWidth={1.8} />
          </div>
          <h1 className="max-w-[142px] text-[1.7rem] font-semibold leading-none text-slate-900 sm:max-w-none sm:text-5xl">
            Color{" "}
            <span className="bg-gradient-to-r from-[#ff6449] via-[#e456a7] to-[#1eaee9] bg-clip-text text-transparent">
              Infection
            </span>
          </h1>
        </div>

        <div className="hidden min-w-[980px] grid-cols-[1fr_1fr_1fr_1.35fr_auto_auto_auto] gap-3 lg:grid">
          <MetricCard
            icon={CircleDot}
            label="Infected"
            tone="infected"
            value={stats.infectedCount.toLocaleString()}
          />
          <MetricCard
            icon={Crosshair}
            label="Cleansed"
            tone="clean"
            value={stats.cleansedCount.toLocaleString()}
          />
          <MetricCard icon={Timer} label="Time" tone="neutral" value={formatTime(stats.remainingSeconds)} />
          <div className="rounded-lg border border-white/80 bg-white/80 px-4 py-3 shadow-[0_18px_48px_rgba(38,55,77,0.09)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="grid size-7 place-items-center rounded-full bg-slate-100 text-slate-600">
                  <Activity className="size-4" strokeWidth={1.8} />
                </span>
                {statusLabel}
              </div>
              <div className="text-2xl font-semibold text-[#ff6449]">{infectionPercent}%</div>
            </div>
            <div className="mt-1 text-xs font-medium uppercase text-slate-400">
              {enemySummary}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="grid flex-1 grid-cols-3 gap-1 text-[11px] font-semibold uppercase text-slate-400">
                <span>L{stats.playerLevel}</span>
                <span>HP {playerHealthPercent}%</span>
                <span>SH {playerShieldPercent}%</span>
              </div>
              <select
                aria-label="AI difficulty"
                className="pointer-events-auto h-7 rounded-full border border-slate-200 bg-white/75 px-2 text-xs font-semibold uppercase text-slate-500 outline-none transition focus:border-[#1eaee9] focus:ring-2 focus:ring-[#1eaee9]/20"
                onChange={(event) => changeDifficulty(event.target.value as AIDifficulty)}
                value={stats.aiDifficulty}
              >
                <option value="easy">Easy AI</option>
                <option value="medium">Medium AI</option>
                <option value="hard">Hard AI</option>
              </select>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#ff4f62] to-[#ffb06f] transition-[width] duration-300"
                style={{ width: `${infectionPercent}%` }}
              />
            </div>
          </div>
          <button
            aria-label={shockwaveLabel}
            className="pointer-events-auto grid size-[86px] place-items-center rounded-lg border border-white/80 bg-white/85 text-slate-900 shadow-[0_18px_48px_rgba(38,55,77,0.1)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!stats.shockwaveReady || stats.paused || stats.status !== "playing"}
            onClick={activateShockwave}
            type="button"
          >
            <span className="grid gap-1 text-center text-xs font-semibold text-slate-500">
              <Zap className="mx-auto size-6 text-[#1eaee9]" strokeWidth={2.2} />
              {stats.shockwaveReady ? "Wave" : `${Math.round(stats.shockwaveCharge)}%`}
            </span>
          </button>
          <button
            aria-label={shieldLabel}
            className="pointer-events-auto grid size-[86px] place-items-center rounded-lg border border-white/80 bg-white/85 text-slate-900 shadow-[0_18px_48px_rgba(38,55,77,0.1)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!stats.shieldReady || stats.paused || stats.status !== "playing"}
            onClick={activateShield}
            type="button"
          >
            <span className="grid gap-1 text-center text-xs font-semibold text-slate-500">
              <Shield className="mx-auto size-6 text-[#1eaee9]" strokeWidth={2.2} />
              {stats.shieldActive ? `${Math.ceil(stats.shieldTimer)}s` : stats.shieldReady ? "Shield" : `${Math.ceil(stats.shieldCooldownRemaining)}s`}
            </span>
          </button>
          <button
            aria-label={pauseLabel}
            aria-pressed={stats.paused}
            className="pointer-events-auto grid size-[86px] place-items-center rounded-lg border border-white/80 bg-white/85 text-slate-900 shadow-[0_18px_48px_rgba(38,55,77,0.1)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50"
            onClick={togglePause}
            type="button"
          >
            <span className="grid gap-1 text-center text-xs font-semibold text-slate-500">
              <PauseIcon className="mx-auto size-6 text-slate-900" strokeWidth={2} />
              {stats.paused ? "Resume" : "Pause"}
            </span>
          </button>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full border border-white/80 bg-white/88 p-1 shadow-[0_18px_42px_rgba(38,55,77,0.12)] backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-1.5 px-1.5 text-base font-semibold text-slate-800">
            <Timer className="size-4 text-slate-500" strokeWidth={2} />
            {formatTime(stats.remainingSeconds)}
          </div>
          <button
            aria-label={shockwaveLabel}
            className="grid size-9 place-items-center rounded-full bg-[#eafaff] text-[#0ea5d7] transition hover:bg-[#d8f5ff] focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!stats.shockwaveReady || stats.paused || stats.status !== "playing"}
            onClick={activateShockwave}
            type="button"
          >
            <Zap className="size-4" strokeWidth={2.2} />
          </button>
          <button
            aria-label={shieldLabel}
            className="grid size-9 place-items-center rounded-full bg-[#edfaff] text-[#0ea5d7] transition hover:bg-[#d8f5ff] focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!stats.shieldReady || stats.paused || stats.status !== "playing"}
            onClick={activateShield}
            type="button"
          >
            <Shield className="size-4" strokeWidth={2.2} />
          </button>
          <button
            aria-label={pauseLabel}
            aria-pressed={stats.paused}
            className="grid size-9 place-items-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50"
            onClick={togglePause}
            type="button"
          >
            <PauseIcon className="size-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <select
        aria-label="AI difficulty"
        className="pointer-events-auto absolute bottom-[160px] left-4 z-10 h-9 rounded-full border border-white/80 bg-white/90 px-3 text-xs font-semibold uppercase text-slate-500 shadow-[0_18px_42px_rgba(38,55,77,0.1)] outline-none backdrop-blur-xl transition focus:border-[#1eaee9] focus:ring-2 focus:ring-[#1eaee9]/20 md:bottom-24 lg:hidden"
        onChange={(event) => changeDifficulty(event.target.value as AIDifficulty)}
        value={stats.aiDifficulty}
      >
        <option value="easy">Easy AI</option>
        <option value="medium">Medium AI</option>
        <option value="hard">Hard AI</option>
      </select>

      <div className="pointer-events-auto absolute bottom-[104px] left-4 z-10 inline-flex h-12 max-w-[210px] items-center gap-2 rounded-full border border-white/80 bg-white/90 px-2 text-sm font-semibold text-slate-900 shadow-[0_18px_48px_rgba(38,55,77,0.1)] backdrop-blur-xl md:bottom-5 md:left-5 md:h-14 md:max-w-none md:gap-3 md:rounded-lg md:px-3 md:text-base">
        <button
          aria-label="Previous level"
          className="grid size-8 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50 disabled:cursor-not-allowed disabled:opacity-35 md:size-9"
          disabled={stats.level <= 1}
          onClick={() => changeLevel(-1)}
          type="button"
        >
          <ChevronLeft className="size-4" strokeWidth={2.2} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#edfaff] text-[#1eaee9]">
            <Flag className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="whitespace-nowrap text-xs font-semibold uppercase text-slate-400 md:text-[11px]">
              Level {stats.level}/{stats.maxLevel}
            </div>
            <div className="truncate text-sm font-semibold text-slate-900 md:max-w-[170px] md:text-base">
              {stats.levelName}
            </div>
          </div>
        </div>
        <button
          aria-label="Next level"
          className="grid size-8 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50 disabled:cursor-not-allowed disabled:opacity-35 md:size-9"
          disabled={stats.level >= stats.maxLevel}
          onClick={() => changeLevel(1)}
          type="button"
        >
          <ChevronRight className="size-4" strokeWidth={2.2} />
        </button>
      </div>

      <button
        aria-label="Reset game"
        className="pointer-events-auto absolute bottom-[104px] right-4 z-10 inline-flex h-12 items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 text-sm font-semibold text-slate-900 shadow-[0_18px_48px_rgba(38,55,77,0.1)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50 md:bottom-5 md:right-5 md:h-14 md:gap-3 md:rounded-lg md:px-5 md:text-base"
        onClick={resetGame}
        type="button"
      >
        <RotateCcw className="size-5" strokeWidth={2} />
        Reset
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center gap-3 md:hidden">
        <MobileStat
          ariaLabel={`${stats.infectedCount} infected dots`}
          icon={CircleDot}
          label="Infected"
          tone="infected"
          value={stats.infectedCount.toLocaleString()}
        />
        <MobileStat
          ariaLabel={`${stats.cleansedCount} cleansed dots`}
          icon={Crosshair}
          label="Cured"
          tone="clean"
          value={stats.cleansedCount.toLocaleString()}
        />
        <MobileStat
          ariaLabel={`Player level ${stats.playerLevel}, ${playerHealthPercent} percent health, ${playerShieldPercent} percent shield`}
          icon={Shield}
          label={`L${stats.playerLevel} XP ${playerXpLabel}`}
          tone="neutral"
          value={`${playerHealthPercent}/${playerShieldPercent}`}
        />
      </div>

      {debugVisible && debugStats && (
        <div className="pointer-events-none absolute left-3 top-28 z-30 w-[276px] rounded-lg border border-slate-900/10 bg-white/92 p-3 font-mono text-[11px] leading-5 text-slate-700 shadow-[0_18px_48px_rgba(38,55,77,0.14)] backdrop-blur-xl sm:left-5 sm:top-32">
          <div className="mb-1 flex items-center gap-2 font-sans text-xs font-semibold text-slate-900">
            <Bug className="size-4 text-slate-600" strokeWidth={2} />
            Diagnostics
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <span>FPS</span>
            <span className="text-right">{debugStats.fps}</span>
            <span>Frame</span>
            <span className="text-right">{formatMetricMs(debugStats.frameMs)}</span>
            <span>Peak 5s</span>
            <span className="text-right">{formatMetricMs(debugStats.maxFrameMsLast5s)}</span>
            <span>Update</span>
            <span className="text-right">{formatMetricMs(debugStats.updateMs)}</span>
            <span>Draw</span>
            <span className="text-right">{formatMetricMs(debugStats.drawMs)}</span>
            <span>Pixi Sync</span>
            <span className="text-right">{formatMetricMs(debugStats.pixiSyncMs)}</span>
            <span>Pulse CPU</span>
            <span className="text-right">{formatMetricMs(debugStats.pulseProcessMs)}</span>
            <span>Shock CPU</span>
            <span className="text-right">{formatMetricMs(debugStats.lastShockwaveFrameCost)}</span>
            <span>Shock Dots</span>
            <span className="text-right">{debugStats.lastShockwaveDotsAffected}</span>
            <span>Shock Parts</span>
            <span className="text-right">{debugStats.lastShockwaveParticlesSpawned}</span>
            <span>Pulse Queue</span>
            <span className="text-right">{debugStats.activePulseQueueLength}</span>
            <span>Dots</span>
            <span className="text-right">{debugStats.dotCount}</span>
            <span>Ripples</span>
            <span className="text-right">{debugStats.rippleCount}</span>
            <span>Particles</span>
            <span className="text-right">{debugStats.particleCount}</span>
            <span>Pulses</span>
            <span className="text-right">{debugStats.pulseCount}</span>
            <span>Effects</span>
            <span className="text-right">{debugStats.activeEffectCount}</span>
            <span>DPR</span>
            <span className="text-right">{debugStats.dpr.toFixed(2)}</span>
            <span>Haze</span>
            <span className="text-right">
              {Math.round(debugStats.hazeScale * 100)}%/{debugStats.hazeEvery}f
            </span>
            <span>Haze CPU</span>
            <span className="text-right">{formatMetricMs(debugStats.hazeRebuildMs)}</span>
            <span>Renderer</span>
            <span className="truncate text-right">{debugStats.rendererType}</span>
            <span>Stage</span>
            <span className="text-right">{debugStats.stageChildren}</span>
            <span>Sprites</span>
            <span className="text-right">{debugStats.dotSpriteCount}</span>
            <span>Pixi FX</span>
            <span className="text-right">{debugStats.activeEffectObjectCount}</span>
            <span>Player L</span>
            <span className="text-right">
              {debugStats.playerLevel} ({debugStats.playerXp} xp)
            </span>
            <span>Player HP</span>
            <span className="text-right">
              {Math.round(debugStats.playerHealth)}/{Math.round(debugStats.playerShield)} sh
            </span>
            <span>Shield</span>
            <span className="text-right">
              {debugStats.shieldTimer > 0
                ? `${debugStats.shieldTimer.toFixed(1)}s`
                : `${debugStats.shieldCooldownRemaining.toFixed(1)}s cd`}
            </span>
            <span>Respawn</span>
            <span className="text-right">{debugStats.playerRespawnTimer.toFixed(1)}s</span>
            <span>AI</span>
            <span className="text-right">{debugStats.aiDifficulty}</span>
            <span>Deaths</span>
            <span className="text-right">
              P{debugStats.playerDeaths}/E{debugStats.enemyDeaths}
            </span>
            <span className="col-span-2 truncate">Enemy HP {debugStats.enemyHealthSummary}</span>
            <span className="col-span-2 truncate">AI {debugStats.aiTargets}</span>
          </div>
        </div>
      )}

      {stats.paused && stats.status === "playing" && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center px-5">
          <button
            className="pointer-events-auto inline-flex h-14 items-center gap-3 rounded-full border border-white/80 bg-white/90 px-6 text-base font-semibold text-slate-900 shadow-[0_24px_80px_rgba(38,55,77,0.16)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50"
            onClick={togglePause}
            type="button"
          >
            <Play className="size-5" strokeWidth={2} />
            Resume
          </button>
        </div>
      )}

      {stats.status !== "playing" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-white/35 px-5 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-lg border border-white/80 bg-white/90 p-6 text-center shadow-[0_24px_80px_rgba(38,55,77,0.16)] backdrop-blur-xl">
            <div
              className={`mx-auto grid size-12 place-items-center rounded-full ${
                stats.status === "won"
                  ? "bg-[#edfaff] text-[#1eaee9]"
                  : "bg-[#fff3ee] text-[#ff6449]"
              }`}
            >
              {stats.status === "won" ? (
                <Sparkles className="size-6" strokeWidth={1.9} />
              ) : (
                <Activity className="size-6" strokeWidth={1.9} />
              )}
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-900">
              {stats.status === "won" ? "Field secured" : "Infection critical"}
            </h2>
            {stats.status === "won" && (
              <div className="mt-2 text-lg font-semibold text-[#1eaee9]">
                {stats.stars || 1} star{(stats.stars || 1) === 1 ? "" : "s"}
              </div>
            )}
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {stats.status === "won"
                ? "The player core controls 70% of the active field."
                : "The infection controls 75% of the active field."}
            </p>
            <button
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/50"
              onClick={resetGame}
              type="button"
            >
              <RotateCcw className="size-4" strokeWidth={2} />
              Reset
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
