import { damp, easeOutCubic, distance, randomRange } from "./math";

export type DotState = "neutral" | "player" | "infected";

export type PointerField = {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  intensity: number;
};

export class Dot {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  velocity = { x: 0, y: 0 };
  radius: number;
  baseRadius: number;
  color = "rgba(154, 163, 178, 0.5)";
  state: DotState = "neutral";
  infectionAmount = 0;
  playerAmount = 0;
  neighbors: number[] = [];
  energy = 0;
  enemyEnergy = 0;

  private phase: number;
  private wobble: number;

  constructor(id: number, row: number, col: number, x: number, y: number) {
    this.id = id;
    this.row = row;
    this.col = col;
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseY = y;
    this.baseRadius = randomRange(1.25, 2.1);
    this.radius = this.baseRadius;
    this.phase = randomRange(0, Math.PI * 2);
    this.wobble = randomRange(0.7, 1.4);
  }

  distanceTo(x: number, y: number) {
    return distance(this.baseX, this.baseY, x, y);
  }

  updateVisual(dt: number, time: number, playerField: PointerField, enemyField: PointerField) {
    const playerDistance = playerField.active
      ? distance(this.baseX, this.baseY, playerField.x, playerField.y)
      : Number.POSITIVE_INFINITY;
    const enemyDistance = enemyField.active
      ? distance(this.baseX, this.baseY, enemyField.x, enemyField.y)
      : Number.POSITIVE_INFINITY;
    const rawPlayerEnergy =
      playerField.active && playerDistance < playerField.radius
        ? easeOutCubic(1 - playerDistance / playerField.radius) * playerField.intensity
        : 0;
    const rawEnemyEnergy =
      enemyField.active && enemyDistance < enemyField.radius
        ? easeOutCubic(1 - enemyDistance / enemyField.radius) * enemyField.intensity
        : 0;

    this.energy = damp(this.energy, rawPlayerEnergy, 12, dt);
    this.enemyEnergy = damp(this.enemyEnergy, rawEnemyEnergy, 10, dt);

    const dominantField = this.energy >= this.enemyEnergy ? playerField : enemyField;
    const dominantEnergy = Math.max(this.energy, this.enemyEnergy);
    const angle = Math.atan2(this.baseY - dominantField.y, this.baseX - dominantField.x);
    const driftX =
      Math.sin(time * 0.55 * this.wobble + this.phase) * 0.85 +
      Math.sin(time * 0.21 + this.phase * 1.7) * 0.45;
    const driftY =
      Math.cos(time * 0.47 * this.wobble + this.phase * 0.8) * 0.85 +
      Math.sin(time * 0.18 + this.phase) * 0.45;
    const repel = dominantEnergy * 16;
    const swirl = Math.sin(dominantEnergy * Math.PI) * 4.5;
    const targetX =
      this.baseX + driftX + Math.cos(angle) * repel + Math.cos(angle + Math.PI / 2) * swirl;
    const targetY =
      this.baseY + driftY + Math.sin(angle) * repel + Math.sin(angle + Math.PI / 2) * swirl;

    const nextX = damp(this.x, targetX, 10, dt);
    const nextY = damp(this.y, targetY, 10, dt);
    this.velocity.x = (nextX - this.x) / Math.max(dt, 0.001);
    this.velocity.y = (nextY - this.y) / Math.max(dt, 0.001);
    this.x = nextX;
    this.y = nextY;

    const infectionPulse = Math.sin(time * 4 + this.phase) * this.infectionAmount * 0.25;
    const targetRadius =
      this.baseRadius +
      this.infectionAmount * 1.35 +
      this.playerAmount * 0.55 +
      dominantEnergy * 3.6 +
      infectionPulse;
    this.radius = damp(this.radius, Math.max(0.8, targetRadius), 14, dt);
  }
}
