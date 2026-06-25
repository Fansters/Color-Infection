import { Texture } from "pixi.js";
import type { Arena } from "@/lib/game/Game";

type ArenaBackgroundOptions = {
  arena: Arena;
  height: number;
  width: number;
};

export type ArenaBackgroundTextures = {
  background: Texture;
  grid: Texture;
  vignette: Texture;
};

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(right - radius, y);
  ctx.quadraticCurveTo(right, y, right, y + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(x + radius, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function createTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const context = canvas.getContext("2d");

  if (context) {
    draw(context);
  }

  return Texture.from(canvas);
}

export function createArenaBackgroundTextures({ arena, height, width }: ArenaBackgroundOptions): ArenaBackgroundTextures {
  const background = createTexture(width, height, (ctx) => {
    const outside = ctx.createLinearGradient(0, 0, width, height);
    outside.addColorStop(0, "#02070d");
    outside.addColorStop(0.44, "#07121b");
    outside.addColorStop(1, "#010408");
    ctx.fillStyle = outside;
    ctx.fillRect(0, 0, width, height);

    roundedPath(ctx, arena.x, arena.y, arena.width, arena.height, arena.radius);
    const inside = ctx.createRadialGradient(
      arena.x + arena.width * 0.5,
      arena.y + arena.height * 0.45,
      Math.min(arena.width, arena.height) * 0.08,
      arena.x + arena.width * 0.5,
      arena.y + arena.height * 0.45,
      Math.max(arena.width, arena.height) * 0.7,
    );
    inside.addColorStop(0, "rgba(20, 43, 58, 0.98)");
    inside.addColorStop(0.52, "rgba(8, 27, 39, 0.98)");
    inside.addColorStop(1, "rgba(3, 10, 16, 0.99)");
    ctx.fillStyle = inside;
    ctx.fill();

    ctx.save();
    roundedPath(ctx, arena.x, arena.y, arena.width, arena.height, arena.radius);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#77e4ff";
    ctx.lineWidth = 1;
    const tickSpacing = 34;
    for (let x = arena.x + 28; x < arena.right - 28; x += tickSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, arena.y + 2);
      ctx.lineTo(x + 8, arena.y + 2);
      ctx.moveTo(x, arena.bottom - 2);
      ctx.lineTo(x + 8, arena.bottom - 2);
      ctx.stroke();
    }
    for (let y = arena.y + 28; y < arena.bottom - 28; y += tickSpacing) {
      ctx.beginPath();
      ctx.moveTo(arena.x + 2, y);
      ctx.lineTo(arena.x + 2, y + 8);
      ctx.moveTo(arena.right - 2, y);
      ctx.lineTo(arena.right - 2, y + 8);
      ctx.stroke();
    }
    ctx.restore();

    roundedPath(ctx, arena.x, arena.y, arena.width, arena.height, arena.radius);
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    roundedPath(ctx, arena.x + 1, arena.y + 1, arena.width - 2, arena.height - 2, Math.max(0, arena.radius - 1));
    ctx.strokeStyle = "rgba(102,224,255,0.52)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const corners = [
      [arena.x + arena.radius * 0.7, arena.y + arena.radius * 0.7],
      [arena.right - arena.radius * 0.7, arena.y + arena.radius * 0.7],
      [arena.x + arena.radius * 0.7, arena.bottom - arena.radius * 0.7],
      [arena.right - arena.radius * 0.7, arena.bottom - arena.radius * 0.7],
    ];

    for (const [cx, cy] of corners) {
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
      glow.addColorStop(0, "rgba(103,229,255,0.28)");
      glow.addColorStop(1, "rgba(103,229,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(196,247,255,0.72)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const grid = createTexture(64, 64, (ctx) => {
    ctx.clearRect(0, 0, 64, 64);
    for (let y = 8; y < 64; y += 16) {
      for (let x = 8; x < 64; x += 16) {
        ctx.beginPath();
        ctx.arc(x, y, 1.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(110, 145, 168, 0.13)";
        ctx.fill();
      }
    }
  });

  const vignette = createTexture(width, height, (ctx) => {
    const radial = ctx.createRadialGradient(
      width * 0.52,
      height * 0.48,
      Math.min(width, height) * 0.28,
      width * 0.52,
      height * 0.48,
      Math.max(width, height) * 0.68,
    );
    radial.addColorStop(0, "rgba(2,8,14,0)");
    radial.addColorStop(0.62, "rgba(2,8,14,0.18)");
    radial.addColorStop(1, "rgba(0,3,8,0.82)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  });

  return { background, grid, vignette };
}
