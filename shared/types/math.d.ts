import type { Point, Bounds } from "./contracts.js";
export declare const clamp: (n: number, a: number, b: number) => number;
export declare const distance: (a: Point, b: Point) => number;
export declare const inside: (r: Bounds, x: number, y: number, pad?: number) => boolean;
export declare function segmentHit(a: Point, b: Point, r: Bounds, padding?: number): number | null;
export declare function seededRandom(seed?: number): () => number;
export declare class SpatialGrid<T> {
    readonly size: number;
    private readonly cells;
    constructor(size?: number);
    clear(): void;
    insert(item: T, r: Bounds): void;
    query(r: Bounds): T[];
}
