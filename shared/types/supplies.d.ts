import type { Point } from "./contracts.js";
export type SupplyKind = "repair" | "charge" | "scrap";
/** Small shared airdrops; the game chooses placement and the collected reward. */
export declare class SupplyDrops {
    private readonly pool;
    get size(): number;
    reset(): void;
    spawn(point: Point, kind: SupplyKind): boolean;
    update(dt: number, player: Point, collect: (kind: SupplyKind) => void): void;
    scroll(dx: number, dy: number): void;
    draw(ctx: CanvasRenderingContext2D): void;
}
