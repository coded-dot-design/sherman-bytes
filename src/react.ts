// React adapter: mounts Sherman Bytes while `active`, and gives the page back on unmount.
import { useEffect } from "react";
import { createShermanBytes } from "./game.js";
import type { ShermanBytesOptions } from "./game.js";

export function ShermanBytes({ active = true, options }: { active?: boolean; options?: ShermanBytesOptions }) {
  useEffect(() => {
    if (!active) return;
    const game = createShermanBytes(options);
    game.start();
    return () => game.destroy();
  }, [active, options]);
  return null;
}
