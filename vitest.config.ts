import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "packages/**/*.test.ts"],
    setupFiles: []
  },
  resolve: {
    alias: {
      "@job-helper/shared": resolve("packages/shared/src/index.ts"),
      "@job-helper/profile-schema": resolve("packages/profile-schema/src/index.ts"),
      "@job-helper/autofill-core": resolve("packages/autofill-core/src/index.ts"),
      "@job-helper/dom-utils": resolve("packages/dom-utils/src/index.ts"),
      "@job-helper/adapters": resolve("packages/adapters/src/index.ts")
    }
  }
});
