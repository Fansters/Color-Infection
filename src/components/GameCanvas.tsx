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
  Pin,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Timer,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PixiGameCanvas } from "@/components/PixiGameCanvas";
import { Game, type AIDifficulty, type GameDebugStats, type GameStats } from "@/lib/game/Game";

const initialStats: GameStats = {
  totalDots: 0,
  infectedCount: 0,
  cleansedCount: 0,
  neutralCount: 0,
  elapsedSeconds: 0,
  remainingSeconds: 300,
  infectionLevel: 0,
  playerCoverage: 0,
  playerBaseCapture: 0,
  enemyBaseCapture: 0,
  fogVisualsEnabled: false,
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
  playerRecoveryState: "noSupply",
  playerRecoveryDelayRemaining: 0,
  playerHealthRegenPerSec: 0,
  playerShieldRegenPerSec: 0,
  playerLocalTerritory: "neutral",
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

type Tone = "infected" | "clean" | "neutral";

type MobileStatProps = {
  ariaLabel: string;
  icon: LucideIcon;
  label: string;
  tone: Tone;
  value: string;
};

type DesktopStatPillProps = {
  icon: LucideIcon;
  label: string;
  tone: Tone;
  value: string;
};

type DockButtonProps = {
  active?: boolean;
  countdown?: string;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tooltip: string;
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

function formatRecoveryState(state: GameStats["playerRecoveryState"]) {
  switch (state) {
    case "combat":
      return "COMBAT";
    case "recoveryDelay":
      return "RECOVERING";
    case "regenBase":
      return "BASE REGEN";
    case "regenOwnTerritory":
      return "REGEN";
    case "noSupply":
    default:
      return "NO SUPPLY";
  }
}

function toneStyles(tone: Tone) {
  return {
    infected: {
      icon: "text-[#ff7b5f] bg-[#40231d]/65 border-[#ff9c87]/35",
      value: "text-[#ff7b5f]",
      ring: "border-[#ffd4c8] bg-[#fff9f6]",
    },
    clean: {
      icon: "text-[#57c8ff] bg-[#143447]/70 border-[#79d6ff]/35",
      value: "text-[#57c8ff]",
      ring: "border-[#c7efff] bg-[#f6fdff]",
    },
    neutral: {
      icon: "text-slate-200 bg-white/10 border-white/10",
      value: "text-white",
      ring: "border-slate-200 bg-white",
    },
  }[tone];
}

function DesktopStatPill({ icon: Icon, label, tone, value }: DesktopStatPillProps) {
  const styles = toneStyles(tone);

  return (
    <div className="flex min-w-[108px] items-center gap-2 px-3 py-1">
      <span className={`grid size-7 place-items-center rounded-full border ${styles.icon}`}>
        <Icon className="size-3.5" strokeWidth={1.9} />
      </span>
      <div className="leading-tight">
        <div className="text-[11px] font-medium text-white/70">{label}</div>
        <div className={`text-sm font-semibold ${styles.value}`}>{value}</div>
      </div>
    </div>
  );
}

function MobileStat({ ariaLabel, icon: Icon, label, tone, value }: MobileStatProps) {
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

function DockButton({ active = false, countdown, disabled, icon: Icon, label, onClick, tooltip }: DockButtonProps) {
  return (
    <button
      aria-label={tooltip}
      className="group relative flex h-[92px] w-[110px] flex-col items-center justify-center gap-2 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(120,144,170,0.3),rgba(58,76,99,0.28))] text-white/92 shadow-[0_18px_45px_rgba(7,14,28,0.28)] backdrop-blur-xl transition duration-200 hover:scale-[1.03] hover:border-white/26 hover:bg-[linear-gradient(180deg,rgba(132,160,190,0.42),rgba(68,88,114,0.38))] hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/55 disabled:cursor-not-allowed disabled:opacity-45 md:opacity-80"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="pointer-events-none absolute -top-10 rounded-full border border-white/14 bg-slate-950/80 px-3 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:opacity-100">
        {tooltip}
      </span>
      {countdown ? (
        <span className="absolute right-3 top-3 rounded-full bg-white/14 px-2 py-0.5 text-[11px] font-semibold text-white/92">
          {countdown}
        </span>
      ) : null}
      <Icon className={`size-7 ${active ? "text-[#8ad8ff]" : "text-[#4fc3ff]"}`} strokeWidth={2.2} />
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}

export default function GameCanvas() {
  const [game] = useState(() => new Game());
  const gameRef = useRef(game);
  const debugVisibleRef = useRef(false);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);
  const [debugPinned, setDebugPinned] = useState(false);
  const [debugStats, setDebugStats] = useState<GameDebugStats | null>(null);

  const syncStats = useCallback(() => {
    const currentGame = gameRef.current;

    if (currentGame) {
      setStats(currentGame.getStats());
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
            setDebugDrawerOpen(false);
            setDebugPinned(false);
          } else {
            setDebugDrawerOpen(false);
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
  const enemyBaseCapturePercent = Math.round(stats.enemyBaseCapture);
  const playerBaseDangerPercent = Math.round(stats.playerBaseCapture);
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
  const recoveryLabel = formatRecoveryState(stats.playerRecoveryState);
  const recoveryCountdown =
    stats.playerRecoveryState === "recoveryDelay" && stats.playerRecoveryDelayRemaining > 0
      ? `${stats.playerRecoveryDelayRemaining.toFixed(1)}s`
      : null;
  const recoveryTone =
    stats.playerRecoveryState === "combat"
      ? "text-[#ff7b5f]"
      : stats.playerRecoveryState === "regenBase" || stats.playerRecoveryState === "regenOwnTerritory"
        ? "text-[#8ff7d1]"
        : "text-white/62";
  const enemySummary =
    stats.enemyCount > 0
      ? `Capture enemy base - Mini-bases ${stats.nodePlayerCount}-${stats.nodeEnemyCount} - Your base danger ${playerBaseDangerPercent}%`
      : "Capture the enemy base - use mini-bases to heal";

  return (
    <section className="relative min-h-svh w-full overflow-hidden bg-[#0b1624] text-white">
      <PixiGameCanvas
        debugVisible={debugVisible}
        game={game}
        onDebugStats={setDebugStats}
        onStats={setStats}
      />

      <div className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-12 items-center gap-2 overflow-x-auto border-b border-white/10 bg-[linear-gradient(180deg,rgba(12,22,36,0.92),rgba(12,22,36,0.62))] px-2 text-white shadow-[0_18px_54px_rgba(2,8,18,0.28)] backdrop-blur-2xl [scrollbar-width:none] sm:px-3">
        <div className="flex h-10 shrink-0 items-center gap-2 rounded-[14px] px-2">
          <span className="grid size-8 place-items-center rounded-full bg-white/7 ring-1 ring-white/12">
            <Sparkles className="size-4 text-[#57c8ff]" strokeWidth={1.9} />
          </span>
          <div className="whitespace-nowrap text-lg font-semibold tracking-[-0.02em]">
            Color <span className="text-[#ff765f]">Infection</span>
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center overflow-hidden rounded-[14px] border border-white/14 bg-white/[0.075] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
          <DesktopStatPill
            icon={CircleDot}
            label="Infected"
            tone="infected"
            value={stats.infectedCount.toLocaleString()}
          />
          <div className="h-5 w-px bg-white/12" />
          <DesktopStatPill
            icon={Crosshair}
            label="Cleansed"
            tone="clean"
            value={stats.cleansedCount.toLocaleString()}
          />
          <div className="h-5 w-px bg-white/12" />
          <DesktopStatPill icon={Timer} label="Time" tone="neutral" value={formatTime(stats.remainingSeconds)} />
        </div>

        <div className="flex h-10 min-w-[320px] flex-1 items-center gap-3 rounded-[14px] border border-white/14 bg-white/[0.075] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-white/80 ring-1 ring-white/10">
            <Activity className="size-3.5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-sm font-semibold text-white/92">Enemy base</span>
              <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#57c8ff] to-[#8ff7d1] transition-[width] duration-300"
                  style={{ width: `${enemyBaseCapturePercent}%` }}
                />
              </div>
              <span className="w-10 text-right text-base font-semibold text-[#57c8ff]">{enemyBaseCapturePercent}%</span>
            </div>
            <div className="truncate text-center text-[11px] font-medium text-white/56">{enemySummary}</div>
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center gap-1 rounded-[14px] border border-white/14 bg-white/[0.075] px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
          <button
            aria-label={shockwaveLabel}
            className="relative grid size-8 place-items-center rounded-[10px] text-[#57c8ff] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45 disabled:cursor-not-allowed disabled:opacity-42"
            disabled={!stats.shockwaveReady || stats.paused || stats.status !== "playing"}
            onClick={activateShockwave}
            title={stats.shockwaveReady ? "Wave" : shockwaveLabel}
            type="button"
          >
            <Zap className="size-4.5" strokeWidth={2.2} />
            {!stats.shockwaveReady && (
              <span className="absolute -right-1 -top-1 rounded-full bg-white/16 px-1 text-[9px] font-semibold text-white">
                {Math.round(stats.shockwaveCharge)}
              </span>
            )}
          </button>
          <button
            aria-label={shieldLabel}
            className="relative grid size-8 place-items-center rounded-[10px] text-[#57c8ff] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45 disabled:cursor-not-allowed disabled:opacity-42"
            disabled={!stats.shieldReady || stats.paused || stats.status !== "playing"}
            onClick={activateShield}
            title={shieldLabel}
            type="button"
          >
            <Shield className="size-4.5" strokeWidth={2.2} />
            {(stats.shieldActive || (!stats.shieldReady && stats.level >= 3)) && (
              <span className="absolute -right-1 -top-1 rounded-full bg-white/16 px-1 text-[9px] font-semibold text-white">
                {stats.shieldActive ? Math.ceil(stats.shieldTimer) : Math.ceil(stats.shieldCooldownRemaining)}
              </span>
            )}
          </button>
        </div>

        <div className="flex h-10 shrink-0 items-center gap-2 rounded-[14px] border border-white/14 bg-white/[0.075] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
          <Shield className="size-4 text-[#dcd3ff]" strokeWidth={2} />
          <div className="leading-tight">
            <div className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${recoveryTone}`}>
              {recoveryCountdown ? `${recoveryLabel} ${recoveryCountdown}` : recoveryLabel}
            </div>
            <div className="text-[10px] font-medium text-white/46">
              H+{stats.playerHealthRegenPerSec.toFixed(0)} S+{stats.playerShieldRegenPerSec.toFixed(0)}
            </div>
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center gap-1 rounded-[14px] border border-white/14 bg-white/[0.075] px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
          <button
            aria-label="Previous level"
            className="grid size-7 place-items-center rounded-[9px] text-white/70 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={stats.level <= 1}
            onClick={() => changeLevel(-1)}
            type="button"
          >
            <ChevronLeft className="size-4" strokeWidth={2.2} />
          </button>
          <div className="flex min-w-[128px] items-center gap-2 px-1">
            <Flag className="size-4 text-[#57c8ff]" strokeWidth={2} />
            <div className="min-w-0 leading-tight">
              <div className="text-[10px] font-semibold uppercase text-white/42">Level {stats.level}/{stats.maxLevel}</div>
              <div className="max-w-[112px] truncate text-xs font-semibold text-white/88">{stats.levelName}</div>
            </div>
          </div>
          <button
            aria-label="Next level"
            className="grid size-7 place-items-center rounded-[9px] text-white/70 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={stats.level >= stats.maxLevel}
            onClick={() => changeLevel(1)}
            type="button"
          >
            <ChevronRight className="size-4" strokeWidth={2.2} />
          </button>
        </div>

        <select
          aria-label="AI difficulty"
          className="h-10 shrink-0 rounded-[14px] border border-white/14 bg-white/[0.075] px-2 text-[11px] font-semibold uppercase text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl transition focus:border-[#57c8ff]/60 focus:ring-2 focus:ring-[#57c8ff]/25"
          onChange={(event) => changeDifficulty(event.target.value as AIDifficulty)}
          value={stats.aiDifficulty}
        >
          <option value="easy" className="text-slate-900">Easy</option>
          <option value="medium" className="text-slate-900">Medium</option>
          <option value="hard" className="text-slate-900">Hard</option>
        </select>

        <button
          aria-label="Reset game"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[14px] border border-white/14 bg-white/[0.075] px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45"
          onClick={resetGame}
          type="button"
        >
          <RotateCcw className="size-4" strokeWidth={2} />
          Reset
        </button>

        <button
          aria-label={pauseLabel}
          aria-pressed={stats.paused}
          className="grid h-10 w-12 shrink-0 place-items-center rounded-[14px] border border-white/14 bg-white/[0.075] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45"
          onClick={togglePause}
          title={stats.paused ? "Resume" : "Pause"}
          type="button"
        >
          <PauseIcon className="size-5" strokeWidth={2.2} />
        </button>
      </div>

      <div className="hidden">
        <div className="hidden items-center gap-3 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(32,45,66,0.88),rgba(28,39,57,0.76))] px-5 py-3 text-white shadow-[0_22px_70px_rgba(12,19,34,0.28)] backdrop-blur-2xl lg:flex">
          <span className="grid size-11 place-items-center rounded-full bg-white/6 ring-1 ring-white/12">
            <Sparkles className="size-5 text-[#57c8ff]" strokeWidth={1.9} />
          </span>
          <div className="text-[2rem] font-semibold leading-none tracking-[-0.03em]">
            Color <span className="bg-gradient-to-r from-[#ff845f] to-[#ff5f4f] bg-clip-text text-transparent">Infection</span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3 py-2 shadow-[0_18px_42px_rgba(38,55,77,0.12)] backdrop-blur-xl lg:hidden">
          <span className="grid size-9 place-items-center rounded-full bg-[#edfaff] text-[#1eaee9]">
            <Sparkles className="size-4" strokeWidth={1.8} />
          </span>
          <div className="text-[1.35rem] font-semibold leading-none">
            Color{" "}
            <span className="bg-gradient-to-r from-[#ff6449] via-[#e456a7] to-[#1eaee9] bg-clip-text text-transparent">
              Infection
            </span>
          </div>
        </div>

        <div className="pointer-events-auto hidden items-center gap-4 lg:flex">
          <div className="flex overflow-hidden rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(32,45,66,0.9),rgba(28,39,57,0.78))] text-white shadow-[0_22px_70px_rgba(12,19,34,0.28)] backdrop-blur-2xl">
            <DesktopStatPill
              icon={CircleDot}
              label="Infected"
              tone="infected"
              value={stats.infectedCount.toLocaleString()}
            />
            <div className="my-3 w-px bg-white/10" />
            <DesktopStatPill
              icon={Crosshair}
              label="Cleansed"
              tone="clean"
              value={stats.cleansedCount.toLocaleString()}
            />
            <div className="my-3 w-px bg-white/10" />
            <DesktopStatPill
              icon={Timer}
              label="Time"
              tone="neutral"
              value={formatTime(stats.remainingSeconds)}
            />
          </div>

          <div className="min-w-[610px] rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(32,45,66,0.9),rgba(28,39,57,0.78))] px-5 py-3 text-white shadow-[0_22px_70px_rgba(12,19,34,0.28)] backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/8 text-white/82">
                  <Activity className="size-4" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[1.05rem] font-medium text-white/88">Infection level</span>
                    <span className="text-[1.15rem] font-semibold text-[#ff7b5f]">{infectionPercent}%</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#ff6157] to-[#ffb06f] transition-[width] duration-300"
                      style={{ width: `${infectionPercent}%` }}
                    />
                  </div>
                  <div className="mt-2 truncate text-center text-sm text-white/62">{enemySummary}</div>
                </div>
              </div>
              <div className="w-[152px] shrink-0">
                <div className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase text-white/52">
                  <span>L{stats.playerLevel}</span>
                  <span>HP {playerHealthPercent}%</span>
                  <span>SH {playerShieldPercent}%</span>
                </div>
                <select
                  aria-label="AI difficulty"
                  className="h-9 w-full rounded-full border border-white/14 bg-white/10 px-3 text-xs font-semibold uppercase text-white outline-none transition focus:border-[#57c8ff]/60 focus:ring-2 focus:ring-[#57c8ff]/25"
                  onChange={(event) => changeDifficulty(event.target.value as AIDifficulty)}
                  value={stats.aiDifficulty}
                >
                  <option value="easy" className="text-slate-900">
                    Easy AI
                  </option>
                  <option value="medium" className="text-slate-900">
                    Medium AI
                  </option>
                  <option value="hard" className="text-slate-900">
                    Hard AI
                  </option>
                </select>
              </div>
            </div>
          </div>

          <button
            aria-label={pauseLabel}
            aria-pressed={stats.paused}
            className="grid h-[88px] w-[76px] place-items-center rounded-[20px] border border-white/14 bg-[linear-gradient(180deg,rgba(32,45,66,0.9),rgba(28,39,57,0.78))] text-white shadow-[0_22px_70px_rgba(12,19,34,0.28)] backdrop-blur-2xl transition hover:scale-[1.02] hover:border-white/24 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/55"
            onClick={togglePause}
            type="button"
          >
            <span className="grid gap-2 text-center">
              <PauseIcon className="mx-auto size-6" strokeWidth={2.1} />
              <span className="text-base font-medium">{stats.paused ? "Resume" : "Pause"}</span>
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

      <div className="hidden">
        <div className="pointer-events-auto relative">
          <div className="absolute left-1/2 top-full h-14 w-px -translate-x-1/2 bg-gradient-to-b from-white/18 to-transparent" />
          <div className="absolute left-6 top-full h-10 w-[120px] rotate-[18deg] border-t border-white/10" />
          <div className="absolute right-6 top-full h-10 w-[120px] -rotate-[18deg] border-t border-white/10" />
          <div className="flex items-center gap-2 rounded-[26px] border border-white/16 bg-[linear-gradient(180deg,rgba(120,144,170,0.28),rgba(50,68,92,0.28))] p-2 shadow-[0_22px_70px_rgba(7,14,28,0.28)] backdrop-blur-2xl">
            <DockButton
              active={stats.shockwaveReady}
              countdown={stats.shockwaveReady ? "1" : undefined}
              disabled={!stats.shockwaveReady || stats.paused || stats.status !== "playing"}
              icon={Zap}
              label={stats.shockwaveReady ? "Wave" : `${Math.round(stats.shockwaveCharge)}%`}
              onClick={activateShockwave}
              tooltip={stats.shockwaveReady ? "Wave: push enemies and break clashes" : shockwaveLabel}
            />
            <DockButton
              active={stats.shieldActive || stats.shieldReady}
              countdown={stats.shieldReady || stats.shieldActive ? "1" : undefined}
              disabled={!stats.shieldReady || stats.paused || stats.status !== "playing"}
              icon={Shield}
              label={stats.shieldActive ? `${Math.ceil(stats.shieldTimer)}s` : stats.shieldReady ? "Shield" : `${Math.ceil(stats.shieldCooldownRemaining)}s`}
              onClick={activateShield}
              tooltip={stats.shieldActive ? "Shield: 50% clash damage reduction" : shieldLabel}
            />
          </div>
        </div>
      </div>

      <select
        aria-label="AI difficulty"
        className="hidden"
        onChange={(event) => changeDifficulty(event.target.value as AIDifficulty)}
        value={stats.aiDifficulty}
      >
        <option value="easy">Easy AI</option>
        <option value="medium">Medium AI</option>
        <option value="hard">Hard AI</option>
      </select>

      <div className="hidden">
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
        className="hidden"
        onClick={resetGame}
        type="button"
      >
        <RotateCcw className="size-5" strokeWidth={2} />
        Reset
      </button>

      <div className="hidden">
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

      {debugVisible && (
        <>
          {!debugDrawerOpen && (
            <button
              aria-label="Open diagnostics drawer"
              className="pointer-events-auto absolute left-0 top-[38%] z-30 hidden h-[198px] w-[52px] -translate-y-1/2 rounded-r-[22px] border border-white/16 bg-[linear-gradient(180deg,rgba(52,66,89,0.82),rgba(36,48,66,0.76))] text-white shadow-[0_18px_48px_rgba(16,22,35,0.26)] backdrop-blur-2xl transition hover:w-[58px] lg:grid"
              onClick={() => setDebugDrawerOpen(true)}
              type="button"
            >
              <span className="[writing-mode:vertical-rl] text-sm font-semibold tracking-[0.08em]">Diagnostics</span>
            </button>
          )}

          {debugStats && debugDrawerOpen && (
            <div className="pointer-events-auto absolute left-4 top-24 z-30 max-h-[calc(100svh-7.5rem)] w-[292px] overflow-y-auto rounded-[24px] border border-white/16 bg-[linear-gradient(180deg,rgba(250,252,255,0.94),rgba(235,242,248,0.92))] p-4 text-slate-700 shadow-[0_24px_64px_rgba(38,55,77,0.18)] backdrop-blur-2xl [scrollbar-width:thin] lg:left-5 lg:top-28">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Bug className="size-4 text-slate-600" strokeWidth={2} />
                  Diagnostics
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={debugPinned ? "Unpin diagnostics drawer" : "Pin diagnostics drawer"}
                    className={`grid size-8 place-items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/35 ${
                      debugPinned
                        ? "border-[#1eaee9]/35 bg-[#eafaff] text-[#0ea5d7]"
                        : "border-slate-200 bg-white/70 text-slate-500 hover:bg-white"
                    }`}
                    onClick={() => setDebugPinned((value) => !value)}
                    type="button"
                  >
                    <Pin className="size-4" strokeWidth={2} />
                  </button>
                  <button
                    aria-label="Collapse diagnostics drawer"
                    className="grid size-8 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-500 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1eaee9]/35"
                    onClick={() => {
                      if (!debugPinned) {
                        setDebugDrawerOpen(false);
                      }
                    }}
                    type="button"
                  >
                    <ChevronLeft className="size-4" strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 font-mono text-[11px] leading-5">
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
                <span>Unaccounted</span>
                <span className="text-right">{formatMetricMs(debugStats.unaccountedFrameMs)}</span>
                <span>State Build</span>
                <span className="text-right">{formatMetricMs(debugStats.renderStateBuildMs)}</span>
                <span>Alloc</span>
                <span className="text-right">{debugStats.renderStateAllocationCount}</span>
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
                <span>Visible Dots</span>
                <span className="text-right">{debugStats.visibleDotCount}</span>
                <span>Active Sprites</span>
                <span className="text-right">{debugStats.activeDotSpriteCount}</span>
                <span>Hidden Dots</span>
                <span className="text-right">{debugStats.hiddenDotCount}</span>
                <span>Synced Dots</span>
                <span className="text-right">{debugStats.syncedDotSprites}</span>
                <span>Dirty Dots</span>
                <span className="text-right">{debugStats.dirtyDotCount}</span>
                <span>Chunks V/D/F</span>
                <span className="text-right">
                  {debugStats.visibleChunkCount}/{debugStats.dirtyChunkCount}/{debugStats.foggedChunkCount}
                </span>
                <span>Sync Dots</span>
                <span className="text-right">{formatMetricMs(debugStats.syncDotsMs)}</span>
                <span>Sync Bars</span>
                <span className="text-right">{formatMetricMs(debugStats.syncHealthBarsMs)}</span>
                <span>Sync Fog/Haze</span>
                <span className="text-right">{formatMetricMs(debugStats.syncFogHazeMs)}</span>
                <span>Texture Updates</span>
                <span className="text-right">
                  H{debugStats.hazeTextureUpdates}/F{debugStats.fogTextureUpdates}
                </span>
                <span>Fog FX</span>
                <span className="text-right">removed</span>
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
                <span>Fog</span>
                <span className="text-right">removed</span>
                <span>Fog CPU</span>
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
                <span>Recovery</span>
                <span className="text-right">{formatRecoveryState(debugStats.recoveryState)}</span>
                <span>Lockout</span>
                <span className="text-right">{debugStats.combatLockoutRemaining.toFixed(1)}s</span>
                <span>Heal Delay</span>
                <span className="text-right">{debugStats.recoveryDelayRemaining.toFixed(1)}s</span>
                <span>Regen</span>
                <span className="text-right">
                  H{debugStats.healthRegenPerSec.toFixed(1)} / S{debugStats.shieldRegenPerSec.toFixed(1)}
                </span>
                <span>Supply</span>
                <span className="text-right">{debugStats.localTerritory}</span>
                <span>Base</span>
                <span className="text-right">{Math.round(debugStats.baseProximity * 100)}%</span>
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
        </>
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
