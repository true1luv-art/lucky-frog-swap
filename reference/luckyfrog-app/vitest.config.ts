import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    // `reference/` holds read-only snapshots of prior codebases kept only for
    // design reference. Their tests target APIs that no longer exist in the
    // live app, so exclude them from the suite.
    exclude: ["**/node_modules/**", "**/dist/**", "reference/**"],
  },
});
