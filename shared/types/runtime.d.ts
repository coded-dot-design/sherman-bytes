import type { GameController, GameDefinition, GameOptions, GameStats } from "./contracts.js";
export declare function createArcade<S extends GameStats>(definition: GameDefinition<S>, options?: GameOptions<S>): GameController<S>;
