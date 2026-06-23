import { clamp, lerp } from "./math";

export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export const palette = {
  backgroundTop: "#fbfdff",
  backgroundBottom: "#f6f9fc",
  neutral: { r: 154, g: 163, b: 178 },
  neutralSoft: { r: 210, g: 216, b: 226 },
  infected: { r: 255, g: 91, b: 55 },
  infectedHot: { r: 255, g: 142, b: 76 },
  player: { r: 38, g: 170, b: 236 },
  playerHot: { r: 86, g: 219, b: 232 },
  ink: "#172033",
  slate: "#697386",
};

export function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1);

  return {
    r: lerp(from.r, to.r, t),
    g: lerp(from.g, to.g, t),
    b: lerp(from.b, to.b, t),
  };
}

export function rgba(color: Rgb, alpha = 1) {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(
    color.b,
  )}, ${clamp(alpha, 0, 1)})`;
}

export function dotFill(
  infectionAmount: number,
  playerAmount: number,
  energy: number,
) {
  const playerBlend = clamp(playerAmount * 0.9 + energy * 0.15, 0, 1);
  const infectionBlend = clamp(infectionAmount, 0, 1);
  const playerColor = mixRgb(palette.neutral, palette.player, playerBlend);
  const hotColor = mixRgb(palette.infected, palette.infectedHot, energy * 0.4);

  return rgba(mixRgb(playerColor, hotColor, infectionBlend), 0.42 + energy * 0.36);
}

export function glowColor(infectionAmount: number, playerAmount: number) {
  if (infectionAmount >= playerAmount) {
    return rgba(palette.infected, 0.68);
  }

  return rgba(palette.playerHot, 0.62);
}
