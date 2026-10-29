// Build what the package ships: dist/index.js and dist/react.js (ESM, minified, Fizlet and the
// Board UI kit baked in; React stays external) plus their declarations.
import { build } from "esbuild";
import { kitCss } from "./kit.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
rmSync("dist", { recursive: true, force: true });
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin/tsc");
execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { stdio: "inherit" });
// The public declarations only: the controller, its options and the React component. They must
// stand alone (no path into vendor/), so the package needs nothing else to type-check.
mkdirSync("dist");
for (const file of ["index", "react", "game"]) {
  const dts = readFileSync(`artifacts/types/src/${file}.d.ts`, "utf8");
  if (/vendor\//.test(dts)) throw new Error(`dist/${file}.d.ts reaches into vendor/`);
  writeFileSync(`dist/${file}.d.ts`, dts);
}
rmSync("artifacts/types", { recursive: true, force: true });
const kit = await kitCss();
for (const entry of ["index", "react"])
  await build({
    entryPoints: [`src/${entry}.ts`],
    outfile: `dist/${entry}.js`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
    external: ["react"],
    define: { __KIT_CSS__: JSON.stringify(kit) },
    banner: { js: `/* Sherman Bytes ${version} · MIT © Chris Cooley · built on Fizlet */` },
  });
console.log(`${name}@${version}: ESM + React builds and declarations ready.`);
