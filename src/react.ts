import { createGameComponent } from "@coded-design/dom-virus/react";
import { createShermanBytes } from "./index.js";
import type { ShermanBytesOptions, ShermanBytesStats } from "./index.js";
export const ShermanBytes = createGameComponent<
  ShermanBytesStats,
  ShermanBytesOptions
>(createShermanBytes);
