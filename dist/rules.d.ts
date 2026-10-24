import type { Point, Rect } from "./core/index.js";
export declare const MAX_TANKS = 18;
export declare const MAX_SHELLS = 80;
export declare const TANK_RADIUS = 10;
export declare const BASE_HEALTH = 100;
export declare const COLORS: {
    player: string;
    enemy: string;
    heavy: string;
    shell: string;
    captured: string;
};
export declare const cannonTier: (xp: number) => 1 | 2 | 3;
export declare const cannonName: (tier: number) => string;
export declare function turnToward(angle: number, goal: number, step: number): number;
export declare function overlapsCircle(p: Point, r: Rect, radius?: number): boolean;
export declare const center: (r: Rect) => Point;
