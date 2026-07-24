import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/http.ts", "src/smoke.ts"],
  format: ["esm"],
  target: "node20",
  tsconfig: "./tsconfig.json",
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
