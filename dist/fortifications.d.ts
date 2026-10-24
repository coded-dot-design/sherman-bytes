import type { BoardTarget, Point, Rect } from "./core/index.js";
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
export declare const BUILD_COST: Record<BuildKind, number>;
export declare const BUILD_CAP: Record<BuildKind, number>;
export declare const box: (x: number, y: number, w: number, h: number) => Rect;
export declare const intersects: (a: Rect, b: Rect) => boolean;
export declare function barrierRect(base: Rect, side: number): Rect;
export declare function buildRect(player: Point & {
    turret: number;
}, kind: BuildKind): Rect;
