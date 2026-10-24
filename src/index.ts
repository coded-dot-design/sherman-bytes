import { createArcade } from "@coded-design/dom-virus";
import type { GameOptions, GameController } from "@coded-design/dom-virus";
import { createGame } from "./simulation.js";
import { createTerrain } from "./terrain.js";
import type { TerrainOptions } from "./terrain.js";
import type { BattleOptions, ShermanBytesStats } from "./simulation.js";
export type { BattleOptions, ShermanBytesStats } from "./simulation.js";
export type { GameController, GameSnapshot } from "@coded-design/dom-virus";
export type ShermanBytesOptions = GameOptions<ShermanBytesStats> &
  TerrainOptions &
  BattleOptions;
export function createShermanBytes(
  options: ShermanBytesOptions = {},
): GameController<ShermanBytesStats> {
  return createArcade(
    {
      id: "sherman-bytes",
      title: "SHERMAN BYTES",
      color: "#4bce82",
      hud: "arcade",
      hint: "WASD / arrows: drive · Mouse: aim · Space: fire · B: cover · T: pillbox · M: mine",
      capabilities: { fire: true },
      actions: [
        { id: "cover", key: "KeyB", label: "B · Cover 2" },
        { id: "pillbox", key: "KeyT", label: "T · Pillbox 8" },
        { id: "mine", key: "KeyM", label: "M · Mine 3" },
      ],
      create: (api) => createGame(api, createTerrain(api, options), options),
    },
    {
      binaryStyle: "native",
      binaryOpacity: 1,
      targetEffects: "liquid",
      ...options,
    },
  );
}
