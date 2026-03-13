// apps/api/src/jobs/liquidation-check.ts
/**
 * 清算检查任务
 * 定期检查是否有仓位需要清算
 */
import type { ScheduledTask } from "node-cron";
import cron from "node-cron";
import Decimal from "decimal.js";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { marketService } from "../services/market.service";
import { shouldLiquidate, type PositionInput } from "../engines/pnl-calculator";
import { tradeEngine } from "../engines/trade-engine";

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
      const markPrice = await marketService.getMarkPrice(position.symbol);
      const metadata = position.metadata as { leverage?: number } | null;
      const leverage = metadata?.leverage ?? 10;
      const marginInUsd = new Decimal(position.margin.toString()).div(new Decimal(1_000_000));
      const shouldForceLiquidation = shouldLiquidate(
        {
          side: position.side,
          positionSize: new Decimal(position.positionSize.toString()),
          entryPrice: new Decimal(position.entryPrice.toString()),
          margin: marginInUsd,
          leverage
        } satisfies PositionInput,
        { markPrice }
      );

      if (!shouldForceLiquidation) {
        continue;
      }

      logger.warn({
        msg: "Position below maintenance margin",
        positionId: position.id,
        userId: position.userId,
        markPrice: markPrice.toString()
      });

      await tradeEngine.liquidatePosition(position.id, markPrice);
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
