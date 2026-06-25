import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
