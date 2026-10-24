import type { GameOptions, GameController } from "./core/index.js";
import type { TerrainOptions } from "./terrain.js";
import type { BattleOptions, ShermanBytesStats } from "./simulation.js";
export type { BattleOptions, ShermanBytesStats } from "./simulation.js";
export type { GameController, GameSnapshot } from "./core/index.js";
export type ShermanBytesOptions = GameOptions<ShermanBytesStats> & TerrainOptions & BattleOptions;
export declare function createShermanBytes(options?: ShermanBytesOptions): GameController<ShermanBytesStats>;
