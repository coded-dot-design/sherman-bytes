import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const local = resolve("../dom-virus/src/index.ts");
const core = existsSync(local) ? local : resolve("shared/core.js");
export default defineConfig({
  root: "playground",
  resolve: {
    alias: {
      "@coded-design/dom-virus/react": existsSync(local)
        ? resolve("../dom-virus/src/react.ts")
        : resolve("shared/react.js"),
      "@coded-design/dom-virus": core,
    },
  },
  server: {
    host: "127.0.0.1",
    fs: { allow: [process.cwd(), resolve(core, "..")] },
  },
  build: { outDir: resolve("artifacts/playground"), emptyOutDir: true },
});
