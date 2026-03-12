// apps/api/src/routes/index.ts
/**
 * 路由注册器
 * 统一注册所有路由
 */
import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health";
import { authRoutes } from "./auth";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // 健康检查路由
  await app.register(healthRoutes);

  // 鉴权路由
  await app.register(authRoutes);

  // TODO: Sprint 2 路由
  // await app.register(userRoutes);
  // await app.register(tradeRoutes);
  // await app.register(marketRoutes);
}
