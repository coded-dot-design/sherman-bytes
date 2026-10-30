// The size budget (gzip), checked in CI. 1.0.0, the first build on Fizlet: dist/index.js is 32,606 B
// (0.5.2 on the DOM VIRUS core: 26,994 B). The Board UI kit's CSS (keys, readouts, toast, touch pad:
// the family's one button language) is 3,060 B of it; the same build without that CSS is 29,546 B.
// 1.1.0 (Unreleased): the scoreboard is fizlet/arcade's skirmish bar (fizlet/hud values, the
// pause / countdown / result overlays): 38,346 B, +4,745 B over 1.0.1's 33,601 B. Of that, 3,945 B
// is the preset and fizlet/hud (Fizlet's sizes.mjs: skirmish is +4,012 B over the card build) and
// 800 B is the kit's sticker-key and overlay CSS (sections 4 and 5). On the fizlet#116 snapshot
// (the flow on fizlet/match, Auto fire / Next gate / Restart on the bar): 40,459 B, +2,113 B, of
// which match is +2,015 B (Fizlet's sizes.mjs, arcade). Budget 39,000 → 41,000; re-measure after
// re-vendoring the release.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const BUDGET = 41000;
for (const file of ["dist/index.js", "dist/react.js"]) {
  const bytes = readFileSync(file), gzip = gzipSync(bytes).length;
  console.log(`${file}: ${bytes.length} bytes / ${gzip} gzip (budget ${BUDGET})`);
  if (gzip > BUDGET) throw new Error(`${file}: ${gzip} B gzip is over the ${BUDGET} B budget`);
}
