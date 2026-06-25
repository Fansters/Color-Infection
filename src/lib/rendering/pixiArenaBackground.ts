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

export function createArenaBackgroundTextures({ height, width }: ArenaBackgroundOptions): ArenaBackgroundTextures {
  const background = createTexture(width, height, (ctx) => {
    const outside = ctx.createLinearGradient(0, 0, width, height);
    outside.addColorStop(0, "#02070d");
    outside.addColorStop(0.44, "#07121b");
    outside.addColorStop(1, "#010408");
    ctx.fillStyle = outside;
    ctx.fillRect(0, 0, width, height);
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
