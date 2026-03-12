// apps/api/src/routes/health.ts
/**
 * 健康检查路由
 * 用于监控服务状态
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { config } from "../config/index";
import { publicClient } from "../clients/blockchain";
import { getRedisHealthClient } from "../queue/queue";

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

/**
 * Redis 健康检查
 */
async function checkRedis(): Promise<"ok" | "down" | "unknown"> {
  try {
    const redis = getRedisHealthClient();
    if (!redis) return "unknown";
    await redis.ping();
    return "ok";
  } catch {
    return "down";
  }
}

/**
 * Chain RPC 健康检查
 */
async function checkChainRpc(): Promise<"ok" | "down" | "unknown"> {
  try {
    if (!publicClient) return "unknown";
    await publicClient.getBlockNumber();
    return "ok";
  } catch {
    return "down";
  }
}

/**
 * Hyperliquid 健康检查
 */
async function checkHyperliquid(): Promise<"ok" | "down" | "unknown"> {
  try {
    const response = await fetch(config.external.hyperliquidApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" })
    });
    return response.ok ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(HEALTH_PATH, async (request) => {
    // 并行执行所有检查
    const [dbStatus, redisStatus, chainStatus, hyperliquidStatus] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkChainRpc(),
      checkHyperliquid()
    ]);

    const services: HealthServices = {
      api: "ok",
      db: dbStatus,
      redis: redisStatus,
      chain: chainStatus,
      hyperliquid: hyperliquidStatus
    };

    // 状态判断逻辑
    // - down: 数据库不可用
    // - degraded: 数据库可用，但 Redis、Chain RPC 或 Hyperliquid 不可用
    // - ok: 所有服务都可用
    let status: "ok" | "degraded" | "down" = "ok";
    if (dbStatus === "down") {
      status = "down";
    } else if (redisStatus === "down" || chainStatus === "down" || hyperliquidStatus === "down") {
      status = "degraded";
    }

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
