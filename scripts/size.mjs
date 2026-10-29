// The size budget (gzip), checked in CI. 1.0.0, the first build on Fizlet: dist/index.js is 32,468 B
// (0.5.2 on the DOM VIRUS core: 26,994 B). The Board UI kit's CSS (keys, readouts, toast, touch pad:
// the family's one button language) is 3,064 B of it; the same build without that CSS is 29,404 B.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const BUDGET = 33000;
for (const file of ["dist/index.js", "dist/react.js"]) {
  const bytes = readFileSync(file), gzip = gzipSync(bytes).length;
  console.log(`${file}: ${bytes.length} bytes / ${gzip} gzip (budget ${BUDGET})`);
  if (gzip > BUDGET) throw new Error(`${file}: ${gzip} B gzip is over the ${BUDGET} B budget`);
}
