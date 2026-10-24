import type { GameContext, Rect } from "./core/index.js";
export interface TerrainOptions {
    wallSelector?: string;
}
/** Opt-in hard cover. Only this adapter touches layout; simulation uses rectangles. */
export declare function createTerrain(api: GameContext, options: TerrainOptions): {
    readonly walls: readonly Rect[];
    refresh(now: number, force?: boolean): void;
    invalidate(): void;
};
export type Terrain = ReturnType<typeof createTerrain>;
