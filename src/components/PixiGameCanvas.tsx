"use client";

import { useCallback, useEffect, useRef } from "react";
import { Game, type GameDebugStats, type GameStats } from "@/lib/game/Game";
import { PixiRenderer } from "@/lib/rendering/PixiRenderer";

type PixiGameCanvasProps = {
  game: Game;
  debugVisible: boolean;
  zoom: number;
  onStats: (stats: GameStats) => void;
  onDebugStats: (stats: GameDebugStats | null) => void;
  onZoomChange?: (zoom: number) => void;
};

function getLocalPoint(event: React.PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function PixiGameCanvas({ game, debugVisible, zoom, onStats, onDebugStats, onZoomChange }: PixiGameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const dprRef = useRef(1);
  const debugVisibleRef = useRef(debugVisible);
  const pointerDownRef = useRef(false);
  const zoomRef = useRef(zoom);
  const callbacksRef = useRef({ onStats, onDebugStats });

  useEffect(() => {
    callbacksRef.current = { onStats, onDebugStats };
  }, [onStats, onDebugStats]);

  useEffect(() => {
    debugVisibleRef.current = debugVisible;
  }, [debugVisible]);

  useEffect(() => {
    zoomRef.current = zoom;
    rendererRef.current?.setZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const pixiRenderer = new PixiRenderer();
    rendererRef.current = pixiRenderer;
    let disposed = false;
    let lastFrame = performance.now();
    let lastStatsUpdate = 0;
    let lastDebugUpdate = 0;
    let resizeObserver: ResizeObserver | null = null;
    let tick: ((ticker: { deltaMS: number }) => void) | null = null;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      dprRef.current = dpr;
      pixiRenderer.resize(rect.width, rect.height, dpr);
      game.resize(rect.width, rect.height);
      callbacksRef.current.onStats(game.getStats());
    };

    const start = async () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      dprRef.current = dpr;
      await pixiRenderer.init(host, rect.width, rect.height, dpr);
      pixiRenderer.setZoom(zoomRef.current);

      if (disposed || !pixiRenderer.app) {
        pixiRenderer.destroy();
        return;
      }

      game.resize(rect.width, rect.height);
      pixiRenderer.sync(game.getRenderState(debugVisibleRef.current));
      callbacksRef.current.onStats(game.getStats());

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);

      tick = (ticker) => {
        const timestamp = performance.now();
        const frameMs = timestamp - lastFrame;
        const dt = ticker.deltaMS / 1000 || frameMs / 1000;
        lastFrame = timestamp;

        const updateStarted = performance.now();
        game.update(dt);
        const updateMs = performance.now() - updateStarted;
        const syncStarted = performance.now();
        const pixiMetrics = pixiRenderer.sync(game.getRenderState(debugVisibleRef.current));
        const syncMs = performance.now() - syncStarted;

        game.recordFrameMetrics(frameMs, updateMs, syncMs, dprRef.current, pixiMetrics);

        if (timestamp - lastStatsUpdate > 120) {
          lastStatsUpdate = timestamp;
          callbacksRef.current.onStats(game.getStats());
        }

        if (debugVisibleRef.current && timestamp - lastDebugUpdate > 160) {
          lastDebugUpdate = timestamp;
          callbacksRef.current.onDebugStats(game.getDebugStats());
        }
      };

      pixiRenderer.app.ticker.add(tick);
    };

    void start();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();

      if (tick && pixiRenderer.app) {
        pixiRenderer.app.ticker.remove(tick);
      }

      rendererRef.current = null;
      pixiRenderer.destroy();
    };
  }, [game]);

  const toWorldPoint = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const point = getLocalPoint(event);
      return rendererRef.current?.screenToWorld(point.x, point.y) ?? point;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pointerDownRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = toWorldPoint(event);
      game.setPointer(point.x, point.y);
      onStats(game.getStats());
    },
    [game, onStats, toWorldPoint],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const point = toWorldPoint(event);

      if (pointerDownRef.current) {
        game.setPointer(point.x, point.y);
        return;
      }

      if (event.pointerType === "mouse") {
        game.setPreview(point.x, point.y);
      }
    },
    [game, toWorldPoint],
  );

  const clearPointer = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    pointerDownRef.current = false;
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    game.clearPointer();
  }, [game]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!onZoomChange) {
        return;
      }

      event.preventDefault();
      const nextZoom = Math.min(1.8, Math.max(0.75, zoom + (event.deltaY < 0 ? 0.1 : -0.1)));
      onZoomChange(Number(nextZoom.toFixed(2)));
    },
    [onZoomChange, zoom],
  );

  return (
    <div
      ref={hostRef}
      aria-label="Color Infection Pixi arena"
      className="absolute inset-0 h-full w-full touch-none"
      onPointerCancel={clearPointer}
      onPointerDown={handlePointerDown}
      onPointerLeave={clearPointer}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPointer}
      onWheel={handleWheel}
      role="application"
    />
  );
}
