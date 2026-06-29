"use client";

import {
  Activity,
  ArrowUp,
  Bot,
  Bug,
  ChevronLeft,
  Flag,
  Home,
  Pause,
  Pin,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Timer,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PixiGameCanvas } from "@/components/PixiGameCanvas";
import { Game, type AIDifficulty, type GameDebugStats, type GameStats } from "@/lib/game/Game";

const initialStats: GameStats = {
  totalDots: 0,
  elapsedSeconds: 0,
  remainingSeconds: 300,
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
  botReady: true,
  botCooldownRemaining: 0,
  friendlyBotCount: 0,
  playerLevel: 1,
  playerXp: 0,
  playerNextLevelXp: 80,
  playerHealth: 100,
  playerMaxHealth: 100,
  playerShield: 36,
  playerMaxShield: 36,
  playerRespawnTimer: 0,
  playerRecoveryState: "noSupply",
  playerRecoveryDelayRemaining: 0,
  playerHealthRegenPerSec: 0,
  playerShieldRegenPerSec: 0,
  playerLocalTerritory: "neutral",
  nodePlayerCount: 0,
  nodeEnemyCount: 0,
  nodePlayerSuppliedCount: 0,
  nodeEnemySuppliedCount: 0,
  hint: null,
  upgradePending: false,
  pendingUpgradeCount: 0,
  upgradeChoices: [],
  enemyMode: "expand",
  enemyCount: 0,
  enemyTypes: "none",
  aiDifficulty: "medium",
  level: 1,
  maxLevel: 6,
  levelName: "First Cleanse",
  levelSummary: "No enemy core. Learn movement, capture zones, and base control.",
  overtimeSeconds: 0,
  stars: 0,
  paused: false,
  status: "playing",
};

type Tone = "clean" | "neutral";
type GameScreen = "home" | "levelSelect" | "playing";

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
  assetIcon?: string;
  countdown?: string;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  showTooltip?: boolean;
  tooltip: string;
};

const uiIcons = {
  baseRegen: "/assets/sprites/ui/icon-base-regen.png",
  bot: "/assets/sprites/ui/icon-bot.png",
  buttonContainer: "/assets/sprites/ui/button_container.png",
  candle: "/assets/sprites/ui/icon-candle.png",
  difficulty: "/assets/sprites/ui/icon-difficulty-level.png",
  enemyTarget: "/assets/sprites/ui/icon-enemy-target.png",
  health: "/assets/sprites/ui/icon-health.png",
  heart: "/assets/sprites/ui/icon-heart.png",
  home: "/assets/sprites/ui/icon-home.png",
  menu: "/assets/sprites/ui/icon-menu.png",
  navbarTile: "/assets/sprites/ui/navbar-tile.jpg",
  objectives: "/assets/sprites/ui/icon-objectives-log.png",
  pause: "/assets/sprites/ui/icon-pause.png",
  progressBorder: "/assets/sprites/ui/progress_border.png",
  question: "/assets/sprites/ui/icon-objectives-log.png",
  reset: "/assets/sprites/ui/icon-reset.png",
  scan: "/assets/sprites/ui/icon-scan-pulse-status.png",
  shield: "/assets/sprites/ui/icon-shield.png",
  upgradeClash: "/assets/sprites/ui/icon-upgrade-clash.png",
  upgradeMedic: "/assets/sprites/ui/icon-upgrade-medic.png",
  upgradeSpeed: "/assets/sprites/ui/icon-upgrade-speed.png",
  wave: "/assets/sprites/ui/icon-wave.png",
};

function AssetIcon({ className = "size-5", src }: { className?: string; src: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-contain bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}

function PixelProgressBar({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      aria-label={`${label} capture ${safeValue}%`}
      className="relative h-[58px] w-[360px] shrink-0 bg-contain bg-center bg-no-repeat sm:h-[64px] sm:w-[399px] xl:h-[70px] xl:w-[436px]"
      style={{ aspectRatio: "960 / 154", backgroundImage: `url(${uiIcons.progressBorder})` }}
    >
      <div className="absolute left-[9.2%] right-[9.2%] top-[40%] h-[31%] overflow-hidden rounded-[2px] bg-black/55 shadow-[inset_0_0_10px_rgba(0,0,0,0.75)]">
        <div
          className="h-full rounded-[3px] bg-[linear-gradient(90deg,#5d1e0d,#963312_42%,#d05e1c_76%,#f08a2a)] shadow-[0_0_16px_rgba(208,94,28,0.42)] transition-[width] duration-300"
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-[12%] top-[30%] text-center text-[10px] font-black uppercase text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.75)] sm:text-[11px]">
        <span className="block truncate">
          {label} <span className="text-[#ffb15a]">{safeValue}%</span>
        </span>
      </div>
    </div>
  );
}

function PixelButtonContainer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="relative z-10 h-[64px] shrink-0 bg-contain bg-center bg-no-repeat md:h-[68px] xl:h-[72px]"
      style={{ aspectRatio: "941 / 274", backgroundImage: `url(${uiIcons.buttonContainer})` }}
    >
      <div className="absolute inset-x-[8.5%] top-[31%] flex h-[38%] items-center justify-between gap-2 px-1">
        {children}
      </div>
    </div>
  );
}

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

function DockButton({
  active = false,
  assetIcon,
  countdown,
  disabled,
  icon: Icon,
  label,
  onClick,
  showTooltip = true,
  tooltip,
}: DockButtonProps) {
  return (
    <button
      aria-label={tooltip}
      className="group relative flex h-16 w-[74px] flex-col items-center justify-center gap-1 rounded-[18px] border border-white/14 bg-[linear-gradient(180deg,rgba(32,58,76,0.46),rgba(12,30,44,0.34))] text-white/92 shadow-[0_18px_45px_rgba(0,7,18,0.34)] backdrop-blur-xl transition duration-200 hover:scale-[1.03] hover:border-white/26 hover:bg-[linear-gradient(180deg,rgba(54,87,110,0.52),rgba(20,43,61,0.42))] hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/55 disabled:cursor-not-allowed disabled:opacity-45 md:opacity-86"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {showTooltip ? (
        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max min-w-[150px] max-w-[240px] -translate-x-1/2 whitespace-normal rounded-[12px] border border-white/14 bg-slate-950/88 px-4 py-2 text-center text-[11px] font-medium leading-4 text-white opacity-0 shadow-lg transition group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:opacity-100">
          {tooltip}
        </span>
      ) : null}
      {countdown ? (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-white/14 px-1.5 py-0.5 text-[9px] font-semibold text-white/92">
          {countdown}
        </span>
      ) : null}
      {assetIcon ? (
        <AssetIcon className={`size-7 ${active ? "opacity-100" : "opacity-90"}`} src={assetIcon} />
      ) : (
        <Icon className={`size-5 ${active ? "text-[#8ad8ff]" : "text-[#4fc3ff]"}`} strokeWidth={2.2} />
      )}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

export default function GameCanvas() {
  const [game] = useState(() => new Game());
  const gameRef = useRef(game);
  const debugVisibleRef = useRef(false);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [screen, setScreen] = useState<GameScreen>("home");
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(false);
  const [debugPinned, setDebugPinned] = useState(false);
  const [debugStats, setDebugStats] = useState<GameDebugStats | null>(null);
  const [arenaZoom, setArenaZoom] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);

  const syncStats = useCallback(() => {
    const currentGame = gameRef.current;

    if (currentGame) {
      setStats(currentGame.getStats());
    }
  }, []);

  const levelOptions = game.getLevelSummaries();

  useEffect(() => {
    gameRef.current?.setPaused(screen !== "playing");
    syncStats();
  }, [screen, syncStats]);

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

      if ((event.key === "f" || event.key === "F") && !event.repeat) {
        event.preventDefault();
        gameRef.current?.spawnFriendlyBot();
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

  const startLevel = useCallback(
    (level: number) => {
      gameRef.current?.setLevel(level);
      gameRef.current?.setPaused(false);
      setHelpOpen(false);
      setScreen("playing");
      syncStats();
    },
    [syncStats],
  );

  const openHome = useCallback(() => {
    gameRef.current?.setPaused(true);
    setHelpOpen(false);
    setScreen("home");
    syncStats();
  }, [syncStats]);

  const openLevelSelect = useCallback(() => {
    gameRef.current?.setPaused(true);
    setHelpOpen(false);
    setScreen("levelSelect");
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

  const spawnFriendlyBot = useCallback(() => {
    gameRef.current?.spawnFriendlyBot();
    syncStats();
  }, [syncStats]);

  const changeArenaZoom = useCallback((nextZoom: number) => {
    setArenaZoom(Math.min(1.8, Math.max(0.75, Number(nextZoom.toFixed(2)))));
  }, []);

  const chooseUpgrade = useCallback(
    (choiceId: GameStats["upgradeChoices"][number]["id"]) => {
      gameRef.current?.chooseUpgrade(choiceId);
      syncStats();
    },
    [syncStats],
  );

  const dismissHint = useCallback(() => {
    gameRef.current?.dismissHint();
    syncStats();
  }, [syncStats]);

  const changeDifficulty = useCallback(
    (difficulty: AIDifficulty) => {
      gameRef.current?.setDifficulty(difficulty);
      syncStats();
    },
    [syncStats],
  );

  const enemyBaseCapturePercent = Math.round(stats.enemyBaseCapture);
  const pauseLabel = stats.paused ? "Resume game" : "Pause game";
  const PauseIcon = stats.paused ? Play : Pause;
  const showFirstLevelTips = stats.level === 1;
  const scanLabel = stats.shockwaveReady
    ? "Scan ready"
    : `Scan ${Math.round(stats.shockwaveCharge)} percent charged`;
  const shieldLabel =
    stats.level < 3
      ? "Shield unlocks at level 3"
      : stats.shieldActive
        ? `Shield active ${stats.shieldTimer.toFixed(0)} seconds`
        : stats.shieldReady
          ? "Shield ready"
          : `Shield ${Math.max(0, stats.shieldCooldownRemaining).toFixed(0)} seconds`;
  const botLabel = stats.botReady
    ? "Deploy support bot"
    : `Support bot ${Math.max(0, stats.botCooldownRemaining).toFixed(0)} seconds`;
  const playerHealthPercent = Math.round((stats.playerHealth / Math.max(1, stats.playerMaxHealth)) * 100);
  const playerShieldPercent = Math.round((stats.playerShield / Math.max(1, stats.playerMaxShield)) * 100);
  const playerXpLabel =
    Number.isFinite(stats.playerNextLevelXp) && stats.playerLevel < 10
      ? `${stats.playerXp}/${stats.playerNextLevelXp}`
      : "MAX";
  const respawnCountdown = Math.ceil(stats.playerRespawnTimer);

  return (
    <section className="relative min-h-svh w-full overflow-hidden bg-[#050d14] text-white">
      <PixiGameCanvas
        debugVisible={debugVisible}
        game={game}
        onDebugStats={setDebugStats}
        onStats={setStats}
        onZoomChange={changeArenaZoom}
        zoom={arenaZoom}
      />

      {screen !== "playing" && (
        <div className="pointer-events-auto absolute inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_30%_20%,rgba(87,200,255,0.16),transparent_34%),radial-gradient(circle_at_78%_28%,rgba(255,118,95,0.16),transparent_32%),linear-gradient(135deg,rgba(7,15,28,0.96),rgba(12,23,38,0.92))] px-4 py-6 text-white backdrop-blur-xl">
          <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-[16px] border border-white/12 bg-white/[0.08] text-[#57c8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <Sparkles className="size-5" strokeWidth={1.9} />
                </span>
                <div>
                  <div className="text-2xl font-semibold tracking-[-0.03em]">
                    Color <span className="text-[#ff765f]">Infection</span>
                  </div>
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/44">Capture Arena</div>
                </div>
              </div>
              {screen === "levelSelect" && (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-white/14 bg-white/[0.08] px-3 text-sm font-semibold text-white/86 backdrop-blur-xl transition hover:bg-white/[0.13] focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45"
                  onClick={() => setScreen("home")}
                  type="button"
                >
                  <Home className="size-4" strokeWidth={2} />
                  Home
                </button>
              )}
            </div>

            {screen === "home" ? (
              <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_420px]">
                <div className="max-w-3xl">
                  <div className="mb-5 inline-flex rounded-full border border-[#57c8ff]/20 bg-[#57c8ff]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8ad8ff]">
                    Base capture prototype V1.17
                  </div>
                  <h1 className="max-w-2xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-white sm:text-7xl">
                    Capture the network. Break the infection.
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-white/64 sm:text-lg">
                    Move your core through the arena, capture mini-bases, keep them connected to your main base, recover through supplied stations, and push into the enemy base when the route is safe.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-[#57c8ff] px-5 text-sm font-bold text-slate-950 shadow-[0_18px_44px_rgba(87,200,255,0.22)] transition hover:-translate-y-0.5 hover:bg-[#8ad8ff] focus:outline-none focus:ring-2 focus:ring-[#8ad8ff]/70"
                      onClick={() => setScreen("levelSelect")}
                      type="button"
                    >
                      <Play className="size-4" fill="currentColor" strokeWidth={2} />
                      Start
                    </button>
                    <button
                      className="inline-flex h-12 items-center gap-2 rounded-[16px] border border-white/14 bg-white/[0.08] px-5 text-sm font-semibold text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.13] focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45"
                      onClick={() => startLevel(stats.level)}
                      type="button"
                    >
                      Continue Level {stats.level}
                    </button>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/14 bg-white/[0.075] p-5 shadow-[0_24px_70px_rgba(2,8,18,0.34)] backdrop-blur-2xl">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-white/58">
                    <Flag className="size-4 text-[#57c8ff]" strokeWidth={2} />
                    Connected bases
                  </div>
                  <div className="space-y-4 text-sm leading-6 text-white/68">
                    <p>Your main base is the supply source. A mini-base becomes supplied when it is close enough to your main base or another supplied mini-base.</p>
                    <p>Supplied mini-bases pulse brighter, draw a link line, and heal your core for 6 HP/sec after combat recovery delay.</p>
                    <p>Isolated mini-bases still belong to you, but they look dimmer and do not provide the fast healing bonus until you connect the chain.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col py-8">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">Select Level</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                      Six arenas introduce the current mechanics gradually. Pick a level, then capture the enemy main base.
                    </p>
                  </div>
                  <label className="grid gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/52">
                    Difficulty
                    <select
                      aria-label="AI difficulty"
                      className="h-11 min-w-[160px] rounded-[14px] border border-white/14 bg-white/[0.08] px-3 text-xs font-black uppercase text-white outline-none backdrop-blur-xl transition focus:border-[#57c8ff]/60 focus:ring-2 focus:ring-[#57c8ff]/25"
                      onChange={(event) => changeDifficulty(event.target.value as AIDifficulty)}
                      value={stats.aiDifficulty}
                    >
                      <option value="easy" className="text-slate-900">Easy AI</option>
                      <option value="medium" className="text-slate-900">Medium AI</option>
                      <option value="hard" className="text-slate-900">Hard AI</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {levelOptions.map((level) => (
                    <button
                      className="group min-h-[156px] rounded-[22px] border border-white/12 bg-white/[0.075] p-4 text-left shadow-[0_18px_52px_rgba(2,8,18,0.2)] backdrop-blur-2xl transition hover:-translate-y-1 hover:border-[#57c8ff]/36 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45"
                      key={level.number}
                      onClick={() => startLevel(level.number)}
                      type="button"
                    >
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <span className="grid size-10 place-items-center rounded-[14px] border border-white/12 bg-white/[0.08] text-sm font-bold text-[#8ad8ff]">
                          {level.number}
                        </span>
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/46">
                          {level.enemyTypes.length === 0 ? "Training" : `${level.enemyTypes.length} enemy`}
                        </span>
                      </div>
                      <div className="text-lg font-semibold text-white">{level.name}</div>
                      <p className="mt-2 text-sm leading-6 text-white/58">{level.summary}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFirstLevelTips && stats.hint && (
        <div className="pointer-events-auto absolute left-1/2 top-16 z-30 flex w-[min(92vw,520px)] -translate-x-1/2 items-center gap-3 rounded-[16px] border border-white/14 bg-[linear-gradient(180deg,rgba(22,33,50,0.78),rgba(12,20,34,0.68))] px-4 py-2 text-sm font-medium text-white/86 shadow-[0_18px_48px_rgba(2,8,18,0.28)] backdrop-blur-2xl">
          <span className="min-w-0 flex-1 text-center">{stats.hint}</span>
          <button
            aria-label="Dismiss hint"
            className="grid size-7 shrink-0 place-items-center rounded-full text-white/58 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45"
            onClick={dismissHint}
            type="button"
          >
            <X className="size-3.5" strokeWidth={2.2} />
          </button>
        </div>
      )}

      {stats.upgradePending && (
        <div className="pointer-events-auto absolute left-1/2 top-24 z-30 w-[min(94vw,720px)] -translate-x-1/2 rounded-[18px] border border-[#57c8ff]/22 bg-[linear-gradient(180deg,rgba(9,25,38,0.94),rgba(5,13,22,0.9))] p-2.5 shadow-[0_22px_70px_rgba(2,8,18,0.42),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/10 px-2 pb-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/86">
              <ArrowUp className="size-3.5 text-[#57c8ff]" strokeWidth={2.4} />
              Level up
            </div>
            <div className="rounded-full border border-white/12 bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-white/62">
              {stats.pendingUpgradeCount} pending
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stats.upgradeChoices.map((choice) => {
              const upgradeAssetIcon =
                choice.id === "speed"
                  ? uiIcons.upgradeSpeed
                  : choice.id === "shield"
                    ? uiIcons.shield
                    : uiIcons.upgradeClash;

              return (
                <button
                  className="group flex min-h-16 items-center gap-2 rounded-[14px] border border-white/12 bg-white/[0.06] px-2.5 py-2 text-left transition hover:border-[#57c8ff]/56 hover:bg-[#57c8ff]/12 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/45 sm:min-h-20 sm:gap-3 sm:px-4"
                  key={choice.id}
                  onClick={() => chooseUpgrade(choice.id)}
                  type="button"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[12px] border border-[#57c8ff]/26 bg-[#071827] text-[#57c8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:size-11">
                    <AssetIcon className="size-7 sm:size-8" src={upgradeAssetIcon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-white sm:text-base">{choice.label}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold leading-3 text-[#9fd8ec]/82 sm:text-xs sm:leading-4">
                      {choice.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-20 items-center gap-2 overflow-x-auto border-b border-white/10 px-2 pr-14 text-white shadow-[0_18px_54px_rgba(0,4,10,0.42)] backdrop-blur-2xl [scrollbar-width:none] sm:px-3 sm:pr-16"
        style={{
          backgroundImage: `url(${uiIcons.navbarTile}), linear-gradient(180deg,rgba(5,14,22,0.96),rgba(8,19,29,0.78))`,
          backgroundPosition: "left top, center",
          backgroundRepeat: "repeat, no-repeat",
          backgroundSize: "auto, cover",
        }}
      >
        <PixelButtonContainer>
          <button
            aria-label="Return to home screen"
            className="grid size-8 shrink-0 place-items-center text-white transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/55"
            onClick={openHome}
            title="Home"
            type="button"
          >
            <AssetIcon className="size-6" src={uiIcons.home} />
          </button>

          <button
            aria-label="Open level select"
            className="grid size-8 shrink-0 place-items-center text-white transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/55"
            onClick={openLevelSelect}
            title="Levels"
            type="button"
          >
            <AssetIcon className="size-6" src={uiIcons.candle} />
          </button>

          <button
            aria-label="Reset game"
            className="grid size-8 shrink-0 place-items-center text-white transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/55"
            onClick={resetGame}
            title="Reset"
            type="button"
          >
            <AssetIcon className="size-6" src={uiIcons.reset} />
          </button>

          <button
            aria-label={pauseLabel}
            aria-pressed={stats.paused}
            className="grid size-8 shrink-0 place-items-center text-white transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#57c8ff]/55"
            onClick={togglePause}
            title={stats.paused ? "Resume" : "Pause"}
            type="button"
          >
            <AssetIcon className="size-7" src={uiIcons.pause} />
          </button>
        </PixelButtonContainer>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2">
          <PixelProgressBar label="Enemy base" value={enemyBaseCapturePercent} />
        </div>

        {showFirstLevelTips ? (
          <button
            aria-expanded={helpOpen}
            aria-label="Open help"
            className="absolute right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center text-white transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#ff9c38]/55"
            onClick={() => setHelpOpen((open) => !open)}
            title="Help"
            type="button"
          >
            <AssetIcon className="size-7" src={uiIcons.question} />
          </button>
        ) : null}
      </div>

      {showFirstLevelTips && helpOpen ? (
        <div className="pointer-events-auto absolute right-3 top-[88px] z-30 w-[min(92vw,340px)] rounded-[10px] border border-[#ff9c38]/30 bg-[linear-gradient(180deg,rgba(24,14,10,0.94),rgba(7,13,20,0.92))] p-4 text-sm leading-5 text-[#ffe1b8] shadow-[0_18px_56px_rgba(0,4,10,0.48),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px] font-black uppercase text-[#ffb15a]">
              <AssetIcon className="size-6" src={uiIcons.question} />
              How to play
            </div>
            <button
              aria-label="Close help"
              className="grid size-7 place-items-center rounded-full text-white/58 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#ff9c38]/45"
              onClick={() => setHelpOpen(false)}
              type="button"
            >
              <X className="size-3.5" strokeWidth={2.2} />
            </button>
          </div>
          <ul className="grid gap-2 text-white/82">
            <li>Move your core to capture mini-bases and connect the supply chain.</li>
            <li>Stay near supplied bases to recover health and shield after fights.</li>
            <li>Use Scan to reveal danger, push enemies, and break pressure windows.</li>
            <li>Capture the enemy base before the arena timer runs out.</li>
          </ul>
        </div>
      ) : null}

      {showFirstLevelTips ? (
        <div className="pointer-events-none absolute left-3 top-[88px] z-20 flex items-center gap-2 rounded-[8px] border border-[#57c8ff]/24 bg-[linear-gradient(180deg,rgba(7,18,30,0.82),rgba(3,10,18,0.7))] px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#b9efff] shadow-[0_14px_44px_rgba(0,8,18,0.32),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl sm:left-4 sm:text-xs">
          <AssetIcon className="size-6" src={uiIcons.objectives} />
          Main objective - capture enemy base!
        </div>
      ) : null}

      {stats.playerRespawnTimer > 0 && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-20 flex -translate-x-1/2 w-[175px] items-center gap-2 rounded-[8px]  px-4 py-2 text-[#9dffd0] shadow-[0_16px_54px_rgba(29,255,160,0.14),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
          <AssetIcon className="size-7" src={uiIcons.heart} />
          <span className="pb-1 text-[11px] font-black uppercase tracking-[0.14em]">Respawning in</span>
          <span className="animate-pulse text-3xl font-black leading-none text-[#72ff8c] drop-shadow-[0_0_16px_rgba(114,255,174,0.42)]">
            {respawnCountdown}
          </span>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-[22px] border border-white/14 bg-[linear-gradient(180deg,rgba(11,26,38,0.76),rgba(6,17,27,0.68))] p-2 text-white shadow-[0_22px_80px_rgba(0,6,14,0.42),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
        <DockButton
          active={stats.shockwaveReady}
          assetIcon={uiIcons.scan}
          countdown={stats.shockwaveReady ? undefined : `${Math.round(stats.shockwaveCharge)}`}
          disabled={!stats.shockwaveReady || stats.paused || stats.status !== "playing"}
          icon={Zap}
          label="Scan"
          onClick={activateShockwave}
          showTooltip={showFirstLevelTips}
          tooltip={stats.shockwaveReady ? "Scan: reveal and push enemies" : scanLabel}
        />
        <DockButton
          active={stats.shieldActive || stats.shieldReady}
          assetIcon={uiIcons.shield}
          countdown={stats.shieldActive ? `${Math.ceil(stats.shieldTimer)}` : !stats.shieldReady && stats.level >= 3 ? `${Math.ceil(stats.shieldCooldownRemaining)}` : undefined}
          disabled={!stats.shieldReady || stats.paused || stats.status !== "playing"}
          icon={Shield}
          label="Shield"
          onClick={activateShield}
          showTooltip={showFirstLevelTips}
          tooltip={stats.shieldActive ? "Shield: 50% attack damage reduction" : shieldLabel}
        />
        <DockButton
          active={stats.botReady}
          assetIcon={uiIcons.bot}
          countdown={stats.botReady ? `${stats.friendlyBotCount}` : `${Math.ceil(stats.botCooldownRemaining)}`}
          disabled={!stats.botReady || stats.paused || stats.status !== "playing"}
          icon={Bot}
          label="Bot"
          onClick={spawnFriendlyBot}
          showTooltip={showFirstLevelTips}
          tooltip={botLabel}
        />
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
              icon={Shield}
              label="Core"
              tone="clean"
              value={`L${stats.playerLevel}`}
            />
            <div className="my-3 w-px bg-white/10" />
            <DesktopStatPill
              icon={Flag}
              label="Supplied"
              tone="clean"
              value={`${stats.nodePlayerSuppliedCount}/${Math.max(1, stats.nodePlayerCount)}`}
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
                    <span className="text-[1.05rem] font-medium text-white/88">Enemy base</span>
                    <span className="text-[1.15rem] font-semibold text-[#57c8ff]">{enemyBaseCapturePercent}%</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#57c8ff] to-[#8ff7d1] transition-[width] duration-300"
                      style={{ width: `${enemyBaseCapturePercent}%` }}
                    />
                  </div>
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
            aria-label={scanLabel}
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
            aria-label={botLabel}
            className="grid size-9 place-items-center rounded-full bg-[#effff9] text-[#0f9f7b] transition hover:bg-[#ddfff3] focus:outline-none focus:ring-2 focus:ring-[#34d399]/50 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!stats.botReady || stats.paused || stats.status !== "playing"}
            onClick={spawnFriendlyBot}
            type="button"
          >
            <Bot className="size-4" strokeWidth={2.2} />
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
              label={stats.shockwaveReady ? "Scan" : `${Math.round(stats.shockwaveCharge)}%`}
              onClick={activateShockwave}
              tooltip={stats.shockwaveReady ? "Scan: push enemies and interrupt attacks" : scanLabel}
            />
            <DockButton
              active={stats.shieldActive || stats.shieldReady}
              countdown={stats.shieldReady || stats.shieldActive ? "1" : undefined}
              disabled={!stats.shieldReady || stats.paused || stats.status !== "playing"}
              icon={Shield}
              label={stats.shieldActive ? `${Math.ceil(stats.shieldTimer)}s` : stats.shieldReady ? "Shield" : `${Math.ceil(stats.shieldCooldownRemaining)}s`}
              onClick={activateShield}
              tooltip={stats.shieldActive ? "Shield: 50% attack damage reduction" : shieldLabel}
            />
            <DockButton
              active={stats.botReady}
              disabled={!stats.botReady || stats.paused || stats.status !== "playing"}
              icon={Bot}
              label={stats.botReady ? "Bot" : `${Math.ceil(stats.botCooldownRemaining)}s`}
              onClick={spawnFriendlyBot}
              tooltip={botLabel}
            />
          </div>
        </div>
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
          ariaLabel={`Player core level ${stats.playerLevel}`}
          icon={Shield}
          label="Core"
          tone="clean"
          value={`L${stats.playerLevel}`}
        />
        <MobileStat
          ariaLabel={`${stats.nodePlayerSuppliedCount} supplied mini-bases out of ${stats.nodePlayerCount}`}
          icon={Flag}
          label="Supply"
          tone="clean"
          value={`${stats.nodePlayerSuppliedCount}/${Math.max(1, stats.nodePlayerCount)}`}
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
                <span>Supply Net</span>
                <span className="text-right">{debugStats.baseSupplySummary}</span>
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
                ? "Enemy main base captured."
                : "Your main base was captured."}
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
