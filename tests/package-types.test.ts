import { createShermanBytes } from "@coded-design/sherman-bytes";
import { ShermanBytes } from "@coded-design/sherman-bytes/react";
const game = createShermanBytes({
  root: "main",
  wallSelector: "[data-wall]",
  binaryOpacity: 0.32,
});
game.getSnapshot().armor?.toFixed();
// @ts-expect-error Snapshots preserve numeric armor.
game.getSnapshot().armor?.toUpperCase();
// @ts-expect-error Selector must be a string.
createShermanBytes({ wallSelector: 42 });
ShermanBytes({
  active: true,
  options: { theme: "system", wallSelector: "aside" },
});
