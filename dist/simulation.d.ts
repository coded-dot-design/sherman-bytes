import type { GameContext, GameSimulation, GameStats, Point } from "./core/index.js";
import type { Terrain } from "./terrain.js";
export interface BattleOptions {
    mode?: "siege" | "conquest";
    fortifications?: boolean;
}
export interface ShermanBytesStats extends GameStats {
    score: number;
    lives: number;
    wave: number;
    kills: number;
    alive: number;
    shells: number;
    supplies: number;
    armor: number;
    captured: number;
    bases: number;
    cannon: number;
    xp: number;
    scrap: number;
    phase: "prepare" | "assault" | "rebuild" | "conquest";
    incoming: number;
    countdown: number;
    barriers: number;
    cover: number;
    pillboxes: number;
    mines: number;
    building: string | null;
    player: Point & {
        angle: number;
        turret: number;
    };
    detail: string;
}
export declare function createGame(api: GameContext, terrain: Terrain, options?: BattleOptions): GameSimulation<ShermanBytesStats>;
