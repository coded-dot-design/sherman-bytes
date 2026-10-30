// The size budget (gzip), checked in CI. 1.0.0, the first build on Fizlet: dist/index.js is 32,606 B
// (0.5.2 on the DOM VIRUS core: 26,994 B). The Board UI kit's CSS (keys, readouts, toast, touch pad:
// the family's one button language) is 3,060 B of it; the same build without that CSS is 29,546 B.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
// Accessible play (roadmap E14) adds 800 B (33,601 → 34,401 B): the local announcer (./src/announce.ts)
// and the scoreboard focus / announcement wrapper. The budget moves by exactly that.
const BUDGET = 34800;
for (const file of ["dist/index.js", "dist/react.js"]) {
  const bytes = readFileSync(file), gzip = gzipSync(bytes).length;
  console.log(`${file}: ${bytes.length} bytes / ${gzip} gzip (budget ${BUDGET})`);
  if (gzip > BUDGET) throw new Error(`${file}: ${gzip} B gzip is over the ${BUDGET} B budget`);
}
