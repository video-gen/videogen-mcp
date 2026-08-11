import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

/**
 * Guidance markdown is read at runtime via `import.meta.url`. tsup inlines the
 * loader into `dist/index.js` / `dist/http.js`, so copy `src/guidance/*.md` to
 * `dist/guidance/` for the published package.
 */
function copyGuidanceMarkdown(): void {
  const srcDir = join("src", "guidance");
  const outDir = join("dist", "guidance");
  mkdirSync(outDir, { recursive: true });

  for (const name of readdirSync(srcDir)) {
    if (!name.endsWith(".md")) {
      continue;
    }

    copyFileSync(join(srcDir, name), join(outDir, name));
  }
}

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
  onSuccess: async () => {
    copyGuidanceMarkdown();
  },
});
