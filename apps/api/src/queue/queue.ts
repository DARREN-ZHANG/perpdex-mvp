// apps/api/src/queue/queue.ts
/**
 * BullMQ 队列定义
 * 对冲任务队列 + 死信队列
 */
import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { QUEUE_NAMES, RETRY_CONFIG, type HedgeJobData } from "./types";

// Redis 连接配置（使用 host/port 而不是 Redis 实例，避免 ioredis 版本冲突）
const redisConnection = {
  host: new URL(config.queue.redisUrl).hostname || "localhost",
  port: Number.parseInt(new URL(config.queue.redisUrl).port || "6379", 10),
  maxRetriesPerRequest: null // BullMQ 要求
};

// Redis 客户端用于健康检查
let redisHealthClient: Redis | null = null;

// 对冲执行队列
let hedgeQueue: Queue<HedgeJobData> | null = null;
let hedgeQueueEvents: QueueEvents | null = null;

// 死信队列
let dlqQueue: Queue | null = null;

/**
 * 初始化队列
 */
export async function initializeQueues(): Promise<void> {
  // 对冲执行队列
  hedgeQueue = new Queue<HedgeJobData>(QUEUE_NAMES.HEDGE_EXECUTE, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: RETRY_CONFIG.maxRetries + 1, // 包括首次尝试
      backoff: RETRY_CONFIG.backoff,
      removeOnComplete: {
        count: 1000, // 保留最近 1000 条完成的任务
        age: 24 * 3600 // 保留 24 小时
      },
      removeOnFail: false // 失败任务不移除，手动处理
    }
  });

  hedgeQueueEvents = new QueueEvents(QUEUE_NAMES.HEDGE_EXECUTE, { connection: redisConnection });

  // 死信队列
  dlqQueue = new Queue(QUEUE_NAMES.HEDGE_DLQ, { connection: redisConnection });

  logger.info({
    msg: "Queues initialized",
    hedgeQueue: QUEUE_NAMES.HEDGE_EXECUTE,
    dlqQueue: QUEUE_NAMES.HEDGE_DLQ
  });
}

/**
 * 获取对冲队列
 */
export function getHedgeQueue(): Queue<HedgeJobData> {
  if (!hedgeQueue) {
    throw new Error("Queues not initialized. Call initializeQueues() first.");
  }
  return hedgeQueue;
}

/**
 * 获取对冲队列事件
 */
export function getHedgeQueueEvents(): QueueEvents {
  if (!hedgeQueueEvents) {
    throw new Error("Queues not initialized. Call initializeQueues() first.");
  }
  return hedgeQueueEvents;
}

/**
 * 获取死信队列
 */
export function getDLQQueue(): Queue {
  if (!dlqQueue) {
    throw new Error("Queues not initialized. Call initializeQueues() first.");
  }
  return dlqQueue;
}

/**
 * 添加对冲任务
 */
export async function addHedgeTask(
  payload: HedgeJobData
): Promise<string> {
  const queue = getHedgeQueue();

  const job = await queue.add("hedge", payload, {
    jobId: payload.taskId, // 使用 taskId 作为 jobId，保证幂等
    priority: getPriorityNumber(payload.priority)
  });

  logger.info({
    msg: "Hedge task added to queue",
    taskId: payload.taskId,
    jobId: job.id,
    priority: payload.priority
  });

  return job.id!;
}

/**
 * 移动失败任务到死信队列
 */
export async function moveToDLQ(
  taskId: string,
  reason: string,
  originalData: HedgeJobData
): Promise<void> {
  const dlq = getDLQQueue();

  await dlq.add("failed", {
    taskId,
    reason,
    originalData,
    failedAt: new Date().toISOString()
  });

  logger.warn({
    msg: "Task moved to DLQ",
    taskId,
    reason
  });
}

/**
 * 优先级转换
 */
function getPriorityNumber(priority?: string): number {
  switch (priority) {
    case "high":
      return 1;
    case "low":
      return 10;
    default:
      return 5;
  }
}

/**
 * 关闭队列
 */
export async function closeQueues(): Promise<void> {
  if (hedgeQueueEvents) {
    await hedgeQueueEvents.close();
  }
  if (hedgeQueue) {
    await hedgeQueue.close();
  }
  if (dlqQueue) {
    await dlqQueue.close();
  }
  if (redisHealthClient) {
    redisHealthClient.disconnect();
    redisHealthClient = null;
  }
  logger.info({ msg: "Queues closed" });
}

/**
 * 获取 Redis 客户端用于健康检查
 */
export function getRedisHealthClient(): Redis | null {
  if (!redisHealthClient) {
    try {
      redisHealthClient = new Redis({
        host: redisConnection.host,
        port: redisConnection.port,
        maxRetriesPerRequest: null,
        enableOfflineQueue: false, // 健康检查不需要离线队列
        lazyConnect: true // 延迟连接，仅在需要时连接
      });
      redisHealthClient.on("error", (err: Error) => {
        logger.error({ msg: "Redis health client error", error: err.message });
      });
    } catch (error) {
      logger.error({ msg: "Failed to create Redis health client", error });
      return null;
    }
  }
  return redisHealthClient;
}
