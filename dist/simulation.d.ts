import type { GameContext, GameSimulation, GameStats, Point } from "./core/index.js";
import type { Terrain } from "./terrain.js";
export interface ShermanBytesStats extends GameStats {
    score: number;
    lives: number;
    wave: number;
    kills: number;
    alive: number;
    shells: number;
    armor: number;
    captured: number;
    bases: number;
    cannon: number;
    xp: number;
    player: Point & {
        angle: number;
        turret: number;
    };
    detail: string;
}
export declare function createGame(api: GameContext, terrain: Terrain): GameSimulation<ShermanBytesStats>;
