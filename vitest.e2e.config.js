/**
 * Vitest config for e2e tests. Uses real Datadog API (no SDK mock).
 * Run with: npm run test:e2e
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "#utils": path.resolve(__dirname, "./src/utils"),
      "#clients": path.resolve(__dirname, "./src/clients"),
      "#tools": path.resolve(__dirname, "./src/tools"),
      "#test": path.resolve(__dirname, "./test"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/e2e/setup.e2e.js"],
    include: ["test/e2e/**/*.e2e.test.js"],
    testTimeout: 30000,
  },
});
