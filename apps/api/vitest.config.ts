// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types/**", "src/config/**"]
    },
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://test:test@localhost:5432/perpdex_test?schema=public",
      JWT_SECRET: "test-secret-key",
      LOG_LEVEL: "error"
    }
  }
});
