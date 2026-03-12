// apps/api/src/jobs/liquidation-check.ts
/**
 * 清算检查任务
 * 定期检查是否有仓位需要清算
 */
import type { ScheduledTask } from "node-cron";
import cron from "node-cron";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { addHedgeTask } from "../queue/queue";

const LIQUIDATION_CHECK_INTERVAL = "*/5 * * * *"; // 每 5 分钟

/**
 * 检查并执行清算
 */
export async function runLiquidationCheck(): Promise<void> {
  logger.info({ msg: "Starting liquidation check" });

  try {
    // 查找所有可能需要清算的仓位
    // 这里简化处理，实际应该根据 marginRatio 计算
    const positions = await prisma.position.findMany({
      where: {
        status: "OPEN"
      },
      include: {
        user: true
      }
    });

    for (const position of positions) {
      // 简化判断：如果 liquidationPrice 达到，需要清算
      // 实际应该使用实时价格计算
      // TODO: 使用实时价格计算是否需要清算
      // if (shouldLiquidate(position)) {
      //   logger.warn({
      //     msg: "Position below maintenance margin",
      //     positionId: position.id
      //   });

      //   await addHedgeTask({
      //     taskId: crypto.randomUUID(),
      //     source: "liquidation",
      //     userId: position.userId,
      //     positionId: position.id,
      //     symbol: "BTC",
      //     side: position.side.toLowerCase() as "long" | "short",
      //     size: position.positionSize.toString(),
      //     referencePrice: "0",
      //     priority: "high",
      //     retryCount: 0,
      //     maxRetries: 3,
      //     idempotencyKey: `liquidation-${position.id}-${Date.now()}`,
      //     requestedAt: new Date().toISOString()
      //   });
      // }
    }

    logger.info({
      msg: "Liquidation check completed",
      positionsChecked: positions.length
    });
  } catch (error) {
    logger.error({
      msg: "Liquidation check failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * 启动定时清算检查
 */
export function startLiquidationScheduler(): ScheduledTask {
  logger.info({
    msg: "Starting liquidation scheduler",
    interval: LIQUIDATION_CHECK_INTERVAL
  });

  return cron.schedule(LIQUIDATION_CHECK_INTERVAL, async () => {
    await runLiquidationCheck();
  });
}
