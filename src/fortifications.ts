import type { BoardTarget, Point, Rect } from "@coded-design/dom-virus";
export type BuildKind = "cover" | "pillbox" | "mine";
export interface Structure {
  kind: BuildKind | "barrier";
  rect: Rect;
  hp: number;
  maxHp: number;
  base: BoardTarget | null;
  side: number;
  fireIn: number;
  angle: number;
}
export const BUILD_COST: Record<BuildKind, number> = {
  cover: 2,
  pillbox: 8,
  mine: 3,
};
export const BUILD_CAP: Record<BuildKind, number> = {
  cover: 12,
  pillbox: 4,
  mine: 8,
};
export const box = (x: number, y: number, w: number, h: number): Rect => ({
  left: x - w / 2,
  right: x + w / 2,
  top: y - h / 2,
  bottom: y + h / 2,
  width: w,
  height: h,
});
export const intersects = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
export function barrierRect(base: Rect, side: number): Rect {
  const x = (base.left + base.right) / 2,
    y = (base.top + base.bottom) / 2;
  if (side < 2)
    return box(
      x,
      y + (side === 0 ? -1 : 1) * (base.height / 2 + 12),
      base.width + 24,
      10,
    );
  return box(
    x + (side === 2 ? -1 : 1) * (base.width / 2 + 12),
    y,
    10,
    base.height + 14,
  );
}
export function buildRect(
  player: Point & { turret: number },
  kind: BuildKind,
): Rect {
  const reach = kind === "mine" ? 120 : 52;
  const x = player.x + Math.cos(player.turret) * reach,
    y = player.y + Math.sin(player.turret) * reach;
  const horizontal =
    Math.abs(Math.sin(player.turret)) > Math.abs(Math.cos(player.turret));
  return box(
    x,
    y,
    kind === "cover" ? (horizontal ? 42 : 12) : kind === "mine" ? 14 : 24,
    kind === "cover" ? (horizontal ? 12 : 42) : kind === "mine" ? 14 : 24,
  );
}
