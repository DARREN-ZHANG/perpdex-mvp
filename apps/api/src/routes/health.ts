// apps/api/src/routes/health.ts
/**
 * 健康检查路由
 * 用于监控服务状态
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";

const HEALTH_PATH = "/api/health";

interface HealthServices {
  api: "ok" | "down";
  db: "ok" | "down" | "unknown";
  redis: "ok" | "down" | "unknown";
  chain: "ok" | "down" | "unknown";
  hyperliquid: "ok" | "down" | "unknown";
}

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  services: HealthServices;
}

async function checkDatabase(): Promise<"ok" | "down" | "unknown"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "down";
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(HEALTH_PATH, async (request) => {
    const dbStatus = await checkDatabase();

    const services: HealthServices = {
      api: "ok",
      db: dbStatus,
      redis: "unknown",
      chain: "unknown",
      hyperliquid: "unknown"
    };

    // Determine overall status
    const status: "ok" | "degraded" | "down" =
      dbStatus === "ok" ? "ok" : "degraded";

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      services
    };

    return {
      data: response,
      error: null,
      meta: { requestId: request.id }
    };
  });
}
