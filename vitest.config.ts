import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["ui/lib/__tests__/**/*.test.ts", "plugin/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["ui/lib/**/*.ts"],
      exclude: ["ui/lib/__tests__/**"],
    },
  },
});
