import type { Point, Rect } from "@coded-design/dom-virus";
export const MAX_TANKS = 18;
export const MAX_SHELLS = 80;
export const TANK_RADIUS = 10;
export const BASE_HEALTH = 100;
export const COLORS = {
  player: "#b9ed70",
  enemy: "#fa9361",
  heavy: "#f36979",
  shell: "#ffd783",
  captured: "#75e6b0",
};
export const cannonTier = (xp: number) => (xp >= 60 ? 3 : xp >= 20 ? 2 : 1);
export const cannonName = (tier: number) =>
  ["76MM", "BREACHER", "OVERDRIVE"][tier - 1]!;
export function turnToward(angle: number, goal: number, step: number): number {
  const difference = Math.atan2(Math.sin(goal - angle), Math.cos(goal - angle));
  return angle + Math.max(-step, Math.min(step, difference));
}
export function overlapsCircle(
  p: Point,
  r: Rect,
  radius = TANK_RADIUS,
): boolean {
  const x = Math.max(r.left, Math.min(p.x, r.right));
  const y = Math.max(r.top, Math.min(p.y, r.bottom));
  return (p.x - x) ** 2 + (p.y - y) ** 2 < radius ** 2;
}
export const center = (r: Rect): Point => ({
  x: (r.left + r.right) / 2,
  y: (r.top + r.bottom) / 2,
});
