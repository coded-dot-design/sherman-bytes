import { createArcade } from "@coded-design/dom-virus";
import type { GameOptions, GameController } from "@coded-design/dom-virus";
import { createGame } from "./simulation.js";
import { createTerrain } from "./terrain.js";
import type { TerrainOptions } from "./terrain.js";
import type { ShermanBytesStats } from "./simulation.js";
export type { ShermanBytesStats } from "./simulation.js";
export type { GameController, GameSnapshot } from "@coded-design/dom-virus";
export type ShermanBytesOptions = GameOptions<ShermanBytesStats> &
  TerrainOptions;
export function createShermanBytes(
  options: ShermanBytesOptions = {},
): GameController<ShermanBytesStats> {
  return createArcade(
    {
      id: "sherman-bytes",
      title: "SHERMAN BYTES",
      color: "#b9ed70",
      hud: "arcade",
      hint: "WASD / arrows: drive · Mouse: aim · Click / Space: fire · G: next base",
      capabilities: { fire: true },
      create: (api) => createGame(api, createTerrain(api, options)),
    },
    {
      binaryStyle: "native",
      binaryOpacity: 0.32,
      targetEffects: "liquid",
      ...options,
    },
  );
}
