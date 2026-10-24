import type { GameOptions, GameController } from "./core/index.js";
import type { TerrainOptions } from "./terrain.js";
import type { ShermanBytesStats } from "./simulation.js";
export type { ShermanBytesStats } from "./simulation.js";
export type { GameController, GameSnapshot } from "./core/index.js";
export type ShermanBytesOptions = GameOptions<ShermanBytesStats> & TerrainOptions;
export declare function createShermanBytes(options?: ShermanBytesOptions): GameController<ShermanBytesStats>;
