// apps/api/src/jobs/reconciliation.ts
/**
 * 净头寸对账任务
 * 定期核对平台净头寸与 Hyperliquid 头寸是否一致
 */
import cron from "node-cron";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { hyperliquidClient } from "../clients/hyperliquid";

const RECONCILIATION_INTERVAL = "*/10 * * * *"; // 每 10 分钟

export interface ReconciliationResult {
  platformNetPosition: Decimal;
  hyperliquidNetPosition: Decimal;
  discrepancy: Decimal;
  discrepancyPercent: Decimal;
  isReconciled: boolean;
}

/**
 * 获取平台净头寸
 * 净头寸 = 所有用户 Long 仓位 - 所有用户 Short 仓位
 */
async function getPlatformNetPosition(symbol: string): Promise<Decimal> {
  const positions = await prisma.position.findMany({
    where: {
      symbol,
      status: "OPEN"
    },
    select: {
      side: true,
      positionSize: true
    }
  });

  let netPosition = new Decimal(0);

  for (const position of positions) {
    const size = new Decimal(position.positionSize);
    if (position.side === "LONG") {
      netPosition = netPosition.plus(size);
    } else {
      netPosition = netPosition.minus(size);
    }
  }

  return netPosition;
}

/**
 * 获取 Hyperliquid 净头寸
 */
async function getHyperliquidNetPosition(symbol: string): Promise<Decimal> {
  const positions = await hyperliquidClient.getPositions();

  const position = positions.find((p) => p.coin === symbol);
  if (!position) {
    return new Decimal(0);
  }

  // szi 是带符号的仓位大小
  return new Decimal(position.szi);
}

/**
 * 执行对账检查
 */
export async function runReconciliation(
  symbol: string = "BTC"
): Promise<ReconciliationResult> {
  logger.info({ msg: "Starting reconciliation", symbol });

  const platformNet = await getPlatformNetPosition(symbol);
  const hyperliquidNet = await getHyperliquidNetPosition(symbol);

  // 理论上：Hyperliquid 头寸 = -平台净头寸（因为平台做空对冲）
  const expectedHyperliquid = platformNet.negated();

  const discrepancy = hyperliquidNet.minus(expectedHyperliquid);

  // 允许 0.1% 的误差
  const tolerance = new Decimal("0.001");
  const discrepancyPercent = expectedHyperliquid.isZero()
    ? discrepancy.abs()
    : discrepancy.div(expectedHyperliquid.abs());

  const isReconciled = discrepancyPercent.abs().lte(tolerance);

  const result: ReconciliationResult = {
    platformNetPosition: platformNet,
    hyperliquidNetPosition: hyperliquidNet,
    discrepancy,
    discrepancyPercent,
    isReconciled
  };

  if (!isReconciled) {
    logger.error({
      msg: "Reconciliation failed: position mismatch",
      symbol,
      platformNet: platformNet.toString(),
      hyperliquidNet: hyperliquidNet.toString(),
      expectedHyperliquid: expectedHyperliquid.toString(),
      discrepancy: discrepancy.toString(),
      discrepancyPercent: discrepancyPercent.times(100).toFixed(4) + "%"
    });

    // TODO: 发送告警通知
    // TODO: 自动修复头寸差异
  } else {
    logger.info({
      msg: "Reconciliation passed",
      symbol,
      platformNet: platformNet.toString(),
      hyperliquidNet: hyperliquidNet.toString()
    });
  }

  return result;
}

/**
 * 启动定时对账
 */
export function startReconciliationScheduler(): cron.ScheduledTask {
  logger.info({
    msg: "Starting reconciliation scheduler",
    interval: RECONCILIATION_INTERVAL
  });

  return cron.schedule(RECONCILIATION_INTERVAL, async () => {
    try {
      await runReconciliation("BTC");
    } catch (error) {
      logger.error({
        msg: "Reconciliation job failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
