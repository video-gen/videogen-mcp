import { defineConfig } from "tsup";

/**
 * Builds the ChatGPT App upload widget (a React app) into a single, self-contained
 * browser bundle that the server inlines into the widget HTML resource. Kept
 * separate from the server build (`tsup.config.ts`) because it targets the browser
 * (React + DOM, IIFE) rather than Node, and must NOT carry the server build's
 * `#!/usr/bin/env node` shebang. `clean: false` so it doesn't wipe the server
 * output that runs first.
 */
export default defineConfig({
  entry: {
    uploadWidget: "web/uploadWidget.tsx",
    mediaPreviewWidget: "web/mediaPreviewWidget.tsx",
  },
  outDir: "dist/widget",
  format: ["iife"],
  platform: "browser",
  target: "es2020",
  tsconfig: "./web/tsconfig.json",
  dts: false,
  splitting: false,
  sourcemap: false,
  minify: true,
  clean: false,
  env: { NODE_ENV: "production" },
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
