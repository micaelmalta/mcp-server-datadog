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
    setupFiles: ["./test/setup.js"],
    testMatch: ["**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "test/"],
    },
  },
});
