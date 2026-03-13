// apps/api/src/workers/hedge.worker.ts
/**
 * 对冲任务执行器
 * 消费 BullMQ 队列任务，向 Hyperliquid 提交反向订单
 */
import { Worker, Job } from "bullmq";
import Decimal from "decimal.js";
import { prisma } from "../db/client";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import {
  hyperliquidClient,
  HyperliquidOrderError
} from "../clients/hyperliquid";
import { QUEUE_NAMES, type HedgeJobData, type HedgeJobResult } from "../queue/types";
import { moveToDLQ } from "../queue/queue";

let worker: Worker<HedgeJobData, HedgeJobResult> | null = null;

function shouldRetrySubmission(error: unknown): boolean {
  return error instanceof HyperliquidOrderError && error.kind === "RETRYABLE";
}

/**
 * 启动 Hedge Worker
 */
export function startHedgeWorker(): Worker<HedgeJobData, HedgeJobResult> {
  if (worker) {
    logger.warn({ msg: "Hedge worker already running" });
    return worker;
  }

  hyperliquidClient.ensureTradingReady();

  const connection = {
    host: new URL(config.queue.redisUrl).hostname || "localhost",
    port: Number.parseInt(new URL(config.queue.redisUrl).port || "6379", 10),
    maxRetriesPerRequest: null
  };

  worker = new Worker<HedgeJobData, HedgeJobResult>(
    QUEUE_NAMES.HEDGE_EXECUTE,
    processHedgeJob,
    {
      connection,
      // 对冲任务需要按顺序处理，避免开/平/清算错序导致净头寸漂移。
      concurrency: 1,
      limiter: {
        max: 10, // 每分钟最多 10 个任务
        duration: 60000
      }
    }
  );

  // 事件监听
  worker.on("completed", (job: Job<HedgeJobData, HedgeJobResult>) => {
    logger.info({
      msg: "Hedge job completed",
      jobId: job.id,
      taskId: job.data.taskId,
      result: job.returnvalue
    });
  });

  worker.on("failed", (job: Job<HedgeJobData> | undefined, error: Error) => {
    logger.error({
      msg: "Hedge job failed",
      jobId: job?.id,
      taskId: job?.data?.taskId,
      error: error.message,
      attemptsMade: job?.attemptsMade
    });
  });

  worker.on("error", (error: Error) => {
    logger.error({
      msg: "Hedge worker error",
      error: error.message
    });
  });

  logger.info({
    msg: "Hedge worker started",
    queue: QUEUE_NAMES.HEDGE_EXECUTE,
    configuredConcurrency: config.queue.workerConcurrency,
    actualConcurrency: 1
  });

  return worker;
}

/**
 * 处理对冲任务
 */
export async function processHedgeJob(
  job: Job<HedgeJobData>
): Promise<HedgeJobResult> {
  const startTime = Date.now();
  const data = job.data;

  logger.info({
    msg: "Processing hedge job",
    jobId: job.id,
    taskId: data.taskId,
    symbol: data.symbol,
    side: data.side,
    size: data.size
  });

  try {
    // 1. 检查任务状态（从数据库）
    const hedgeOrder = await prisma.hedgeOrder.findUnique({
      where: { taskId: data.taskId }
    });

    if (!hedgeOrder) {
      throw new Error(`Hedge order not found: ${data.taskId}`);
    }

    // 2. 检查是否可以执行
    if (
      hedgeOrder.status === "FILLED" ||
      hedgeOrder.status === "FAILED" ||
      hedgeOrder.status === "SUBMITTED"
    ) {
      logger.warn({
        msg: "Hedge order already processed",
        taskId: data.taskId,
        currentStatus: hedgeOrder.status
      });

      return {
        taskId: data.taskId,
        status: hedgeOrder.status,
        processedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }

    // 3. 更新状态为 PROCESSING
    if (hedgeOrder.status === "PENDING" || hedgeOrder.status === "SUBMIT_UNKNOWN") {
      await prisma.hedgeOrder.update({
        where: { taskId: data.taskId },
        data: {
          status: "PROCESSING",
          submittedAt: new Date(),
          retryCount: job.attemptsMade
        }
      });
    }

    // 4. 执行对冲订单
    // data.side 表示要在 HyperLiquid 上持有/关闭的方向:
    // LONG -> buy, SHORT -> sell
    const hedgeSide = data.side === "LONG" ? "buy" : "sell";
    const reduceOnly =
      hedgeOrder.trigger === "CLOSE" || hedgeOrder.trigger === "LIQUIDATION";

    const result = await hyperliquidClient.submitMarketOrder(
      data.symbol,
      hedgeSide,
      data.size,
      reduceOnly
    );

    const isFilled = result.status === "FILLED";

    // 5. 更新订单状态
    await prisma.hedgeOrder.update({
      where: { taskId: data.taskId },
      data: {
        status: isFilled ? "FILLED" : "SUBMITTED",
        externalOrderId: result.orderId,
        referencePrice: result.averagePrice ? new Decimal(result.averagePrice) : null,
        filledAt: isFilled ? new Date() : null,
        retryCount: job.attemptsMade
      }
    });

    const jobResult: HedgeJobResult = {
      taskId: data.taskId,
      status: isFilled ? "FILLED" : "SUBMITTED",
      externalOrderId: result.orderId,
      averagePrice: result.averagePrice,
      filledAt: isFilled ? new Date().toISOString() : undefined,
      processedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    };

    return jobResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    const currentAttempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const retryable = shouldRetrySubmission(error);
    const shouldRetry = retryable && currentAttempt < maxAttempts;
    const isUnknownSubmission =
      error instanceof HyperliquidOrderError && error.kind === "SUBMIT_UNKNOWN";

    // 更新失败状态
    try {
      await prisma.hedgeOrder.update({
        where: { taskId: data.taskId },
        data: {
          status: isUnknownSubmission
            ? "SUBMIT_UNKNOWN"
            : shouldRetry
              ? "PENDING"
              : "FAILED",
          retryCount: currentAttempt,
          errorMessage,
          failedAt: shouldRetry || isUnknownSubmission ? null : new Date()
        }
      });
    } catch {
      // 如果更新失败，记录日志但继续抛出错误
      logger.error({
        msg: "Failed to update hedge order status",
        taskId: data.taskId,
        error: errorMessage
      });
    }

    if (isUnknownSubmission) {
      return {
        taskId: data.taskId,
        status: "SUBMIT_UNKNOWN",
        errorMessage,
        processedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }

    // 检查是否应该移到 DLQ
    if (!shouldRetry) {
      await moveToDLQ(data.taskId, errorMessage, data);
      return {
        taskId: data.taskId,
        status: "FAILED",
        errorMessage,
        processedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }

    throw error; // 让 BullMQ 处理重试
  }
}

/**
 * 停止 Hedge Worker
 */
export async function stopHedgeWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ msg: "Hedge worker stopped" });
  }
}
