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
import { hyperliquidClient } from "../clients/hyperliquid";
import { QUEUE_NAMES, type HedgeJobData, type HedgeJobResult } from "../queue/types";
import { moveToDLQ } from "../queue/queue";

let worker: Worker<HedgeJobData, HedgeJobResult> | null = null;

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "unknown error";

  return !(
    message.includes("asset") ||
    message.includes("invalid") ||
    message.includes("not found") ||
    message.includes("parameter")
  );
}

/**
 * 启动 Hedge Worker
 */
export function startHedgeWorker(): Worker<HedgeJobData, HedgeJobResult> {
  if (worker) {
    logger.warn({ msg: "Hedge worker already running" });
    return worker;
  }

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
      concurrency: config.queue.workerConcurrency,
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
    concurrency: config.queue.workerConcurrency
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
    if (hedgeOrder.status === "FILLED" || hedgeOrder.status === "FAILED") {
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

    // 3. 更新状态为 SUBMITTED
    if (hedgeOrder.status === "PENDING") {
      await prisma.hedgeOrder.update({
        where: { taskId: data.taskId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          retryCount: job.attemptsMade
        }
      });
    }

    // 4. 执行对冲订单
    // data.side 表示要在 HyperLiquid 上持有/关闭的方向:
    // LONG -> buy, SHORT -> sell
    const hedgeSide = data.side === "LONG" ? "buy" : "sell";
    const reduceOnly = hedgeOrder.trigger === "CLOSE";

    const result = await hyperliquidClient.submitMarketOrder(
      data.symbol,
      hedgeSide,
      data.size,
      reduceOnly
    );

    // 5. 更新订单状态
    await prisma.hedgeOrder.update({
      where: { taskId: data.taskId },
      data: {
        status: "FILLED",
        externalOrderId: result.orderId,
        referencePrice: result.averagePrice ? new Decimal(result.averagePrice) : null,
        filledAt: new Date(),
        retryCount: job.attemptsMade
      }
    });

    const jobResult: HedgeJobResult = {
      taskId: data.taskId,
      status: "FILLED",
      externalOrderId: result.orderId,
      averagePrice: result.averagePrice,
      filledAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    };

    return jobResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    const currentAttempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const retryable = isRetryableError(error);
    const shouldRetry = retryable && currentAttempt < maxAttempts;

    // 更新失败状态
    try {
      await prisma.hedgeOrder.update({
        where: { taskId: data.taskId },
        data: {
          status: shouldRetry ? "PENDING" : "FAILED",
          retryCount: currentAttempt,
          errorMessage,
          failedAt: shouldRetry ? null : new Date()
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

    // 检查是否应该移到 DLQ
    if (!shouldRetry) {
      await moveToDLQ(data.taskId, errorMessage, data);
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
