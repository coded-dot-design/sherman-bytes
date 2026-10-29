import { defineConfig } from "vite";
import { resolve } from "node:path";
import { kitCss } from "./scripts/kit.mjs";

export default defineConfig(async () => ({
  root: "playground",
  define: { __KIT_CSS__: JSON.stringify(await kitCss()) },
  server: { host: "127.0.0.1" },
  build: { outDir: resolve("artifacts/playground"), emptyOutDir: true },
}));
