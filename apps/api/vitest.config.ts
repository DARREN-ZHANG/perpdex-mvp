// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@perpdex/shared": path.resolve(__dirname, "../../packages/shared/dist/index.js"),
      "@perpdex/contracts": path.resolve(__dirname, "../../packages/contracts/dist/index.js")
    }
  },
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
    },
    // 设置更长的超时时间
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
