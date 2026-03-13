// apps/api/src/routes/index.ts
/**
 * 路由注册器
 * 统一注册所有路由
 */
import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health";
import { authRoutes } from "./auth";
import { userRoutes } from "./user";
import { tradeRoutes } from "./trade";
import { hedgeRoutes } from "./hedge";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // 健康检查路由
  await app.register(healthRoutes);

  // 鉴权路由
  await app.register(authRoutes);

  // 用户路由（余额、历史、提现）
  await app.register(userRoutes);

  // 交易路由（下单、平仓）
  await app.register(tradeRoutes);

  await app.register(hedgeRoutes);

  // TODO: Sprint 2 其他路由
}
