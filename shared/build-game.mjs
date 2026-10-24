// Canonical game builder. sync-games.mjs distributes this file with each snapshot.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const require = createRequire(import.meta.url);
if (!existsSync("shared/core.js") || !existsSync("shared/types/index.d.ts"))
  throw new Error(
    "Missing engine snapshot. Run npm run sync:games in the sibling dom-virus checkout.",
  );
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/core", { recursive: true });
const tsc = resolve(
  dirname(require.resolve("typescript/package.json")),
  "bin/tsc",
);
execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  stdio: "inherit",
});
for (const file of readdirSync("dist")) {
  if (!file.endsWith(".d.ts")) continue;
  const path = resolve("dist", file);
  writeFileSync(
    path,
    readFileSync(path, "utf8")
      .replaceAll("@coded-design/dom-virus/react", "./core/react.js")
      .replaceAll("@coded-design/dom-virus", "./core/index.js"),
  );
}
for (const file of readdirSync("shared/types"))
  copyFileSync(resolve("shared/types", file), resolve("dist/core", file));
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
    alias: {
      "@coded-design/dom-virus/react": resolve("shared/react.js"),
      "@coded-design/dom-virus": resolve("shared/core.js"),
    },
  });
const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
console.log(
  `${name}@${version}: independent ESM + React builds and generated types ready.`,
);
