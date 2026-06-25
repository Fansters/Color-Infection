import { Texture } from "pixi.js";
import { palette, type Rgb } from "@/lib/game/colors";

export type DotTextureKey = "neutral" | "player" | "infected" | "contested";
export type CoreTextureKey = "player" | "enemy";

export type PixiTextures = {
  dots: Record<DotTextureKey, Texture>;
  cores: Record<CoreTextureKey, Texture>;
  particle: Texture;
  ring: Texture;
  fogReveal: Texture;
};

function rgbToCss(color: Rgb, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function createCanvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    draw(ctx, size);
  }

  const texture = Texture.from(canvas);
  texture.source.label = `color-infection-texture-${size}`;
  return texture;
}

function createDotTexture(hot: Rgb, edge: Rgb, alpha = 0.92) {
  return createCanvasTexture(56, (ctx, size) => {
    const center = size / 2;
    const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
    glow.addColorStop(0, rgbToCss(hot, 0.6));
    glow.addColorStop(0.42, rgbToCss(edge, 0.25));
    glow.addColorStop(1, rgbToCss(edge, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = rgbToCss(edge, alpha);
    ctx.beginPath();
    ctx.arc(center, center, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.beginPath();
    ctx.arc(center - size * 0.04, center - size * 0.05, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createNeutralDotTexture() {
  return createCanvasTexture(42, (ctx, size) => {
    const center = size / 2;
    const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
    glow.addColorStop(0, rgbToCss(palette.neutral, 0.48));
    glow.addColorStop(0.42, rgbToCss(palette.neutral, 0.24));
    glow.addColorStop(1, rgbToCss(palette.neutral, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "rgba(125, 137, 154, 0.58)";
    ctx.beginPath();
    ctx.arc(center, center, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createCoreTexture(hot: Rgb, edge: Rgb) {
  return createCanvasTexture(140, (ctx, size) => {
    const center = size / 2;
    const field = ctx.createRadialGradient(center, center, 0, center, center, center * 0.96);
    field.addColorStop(0, rgbToCss(hot, 0.58));
    field.addColorStop(0.42, rgbToCss(edge, 0.24));
    field.addColorStop(1, rgbToCss(edge, 0));
    ctx.fillStyle = field;
    ctx.fillRect(0, 0, size, size);

    const rim = ctx.createRadialGradient(center, center, size * 0.2, center, center, size * 0.36);
    rim.addColorStop(0, rgbToCss(hot, 0));
    rim.addColorStop(0.64, rgbToCss(edge, 0.22));
    rim.addColorStop(0.82, "rgba(255, 255, 255, 0.82)");
    rim.addColorStop(1, rgbToCss(edge, 0));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.37, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(
      center - size * 0.13,
      center - size * 0.16,
      0,
      center + size * 0.04,
      center + size * 0.08,
      size * 0.3,
    );
    body.addColorStop(0, "rgba(255, 255, 255, 1)");
    body.addColorStop(0.22, rgbToCss(hot, 0.98));
    body.addColorStop(0.62, rgbToCss(edge, 0.98));
    body.addColorStop(1, "rgba(2, 10, 24, 0.98)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.24, 0, Math.PI * 2);
    ctx.fill();

    const shade = ctx.createRadialGradient(center, center + size * 0.22, 0, center, center + size * 0.22, size * 0.26);
    shade.addColorStop(0, "rgba(0, 0, 0, 0.34)");
    shade.addColorStop(0.58, "rgba(0, 0, 0, 0.18)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.beginPath();
    ctx.arc(center - size * 0.11, center - size * 0.15, size * 0.055, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createParticleTexture() {
  return createCanvasTexture(18, (ctx, size) => {
    const center = size / 2;
    const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    glow.addColorStop(0.4, "rgba(255, 255, 255, 0.52)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  });
}

function createRingTexture() {
  return createCanvasTexture(256, (ctx, size) => {
    const center = size / 2;
    const radius = size * 0.38;
    const stroke = ctx.createRadialGradient(center, center, radius * 0.72, center, center, radius * 1.18);
    stroke.addColorStop(0, "rgba(255, 255, 255, 0)");
    stroke.addColorStop(0.42, "rgba(255, 255, 255, 0.34)");
    stroke.addColorStop(0.52, "rgba(255, 255, 255, 0.92)");
    stroke.addColorStop(0.62, "rgba(255, 255, 255, 0.28)");
    stroke.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(center, center, radius * 1.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  });
}

function createFogRevealTexture() {
  return createCanvasTexture(160, (ctx, size) => {
    const center = size / 2;
    const glow = ctx.createRadialGradient(center, center, 0, center, center, center);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    glow.addColorStop(0.52, "rgba(255, 255, 255, 0.72)");
    glow.addColorStop(0.82, "rgba(255, 255, 255, 0.22)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  });
}

export function createPixiTextures(): PixiTextures {
  return {
    dots: {
      neutral: createNeutralDotTexture(),
      player: createDotTexture(palette.playerHot, palette.player),
      infected: createDotTexture(palette.infectedHot, palette.infected),
      contested: createDotTexture({ r: 148, g: 126, b: 176 }, { r: 99, g: 106, b: 122 }),
    },
    cores: {
      player: createCoreTexture(palette.playerHot, palette.player),
      enemy: createCoreTexture(palette.infectedHot, palette.infected),
    },
    particle: createParticleTexture(),
    ring: createRingTexture(),
    fogReveal: createFogRevealTexture(),
  };
}

export function destroyPixiTextures(textures: PixiTextures) {
  Object.values(textures.dots).forEach((texture) => texture.destroy(true));
  Object.values(textures.cores).forEach((texture) => texture.destroy(true));
  textures.particle.destroy(true);
  textures.ring.destroy(true);
  textures.fogReveal.destroy(true);
}
