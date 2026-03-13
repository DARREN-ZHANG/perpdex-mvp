# Sprint 2 泳道 D: 队列对冲实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 BullMQ 持久化队列、Hedge Worker 和净头寸对账任务

**Architecture:** BullMQ 队列 + 独立 Worker 进程 + 定时对账任务。对冲任务持久化到 Redis，支持重试和死信队列。

**Tech Stack:** TypeScript, BullMQ, Redis, Hyperliquid API

**Dependencies:**
- T05 Hedge Payload (✅)
- T10 Fastify (✅)
- T40 Trade Engine (泳道 B)
- T06 Mock Hyperliquid (✅)

**Deliverables:**
- `queue/index.ts` - 队列初始化
- `queue/queue.ts` - 队列定义
- `queue/types.ts` - 任务类型
- `workers/hedge.worker.ts` - 对冲 Worker
- `jobs/reconciliation.ts` - 对账任务
- `clients/hyperliquid.ts` - Hyperliquid 客户端

---

## File Structure

```
apps/api/src/
├── queue/
│   ├── index.ts              # 队列导出入口
│   ├── queue.ts              # BullMQ 队列定义
│   └── types.ts              # 任务类型定义
├── workers/
│   └── hedge.worker.ts       # 对冲任务执行器
├── jobs/
│   └── reconciliation.ts     # 净头寸对账任务
├── clients/
│   └── hyperliquid.ts        # Hyperliquid API 客户端
└── config/
    └── index.ts              # 添加 Redis 配置
```

---

## Chunk 1: BullMQ 队列配置

### Task 1: Queue Setup

**Files:**
- Create: `apps/api/src/queue/types.ts`
- Create: `apps/api/src/queue/queue.ts`
- Create: `apps/api/src/queue/index.ts`

#### Step 1: 安装 BullMQ 依赖

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/apps/api && pnpm add bullmq ioredis`

- [ ] **Install BullMQ and ioredis**

#### Step 2: 更新配置添加 Redis

**File:** `apps/api/src/config/index.ts` (修改)

```typescript
// 在 config 对象中添加：
export const config = {
  // ... existing config
  queue: {
    redisUrl: getEnvVar("REDIS_URL", "redis://localhost:6379"),
    hedgeQueueName: "hedge.execute",
    dlqQueueName: "hedge.dlq",
    maxRetries: getEnvNumber("HEDGE_MAX_RETRIES", 3),
    workerConcurrency: getEnvNumber("HEDGE_WORKER_CONCURRENCY", 5)
  }
} as const;
```

- [ ] **Add Redis config**

#### Step 3: 创建队列类型定义

**File:** `apps/api/src/queue/types.ts`

```typescript
// apps/api/src/queue/types.ts
/**
 * 队列任务类型定义
 * 与 packages/shared/src/hedge.ts 保持一致
 */
import type { HedgeTaskPayload, HedgeTaskResult } from "@perp-dex/shared";

// 重新导出共享类型
export type { HedgeTaskPayload, HedgeTaskResult };

// BullMQ 任务数据结构
export interface HedgeJobData extends HedgeTaskPayload {
  // BullMQ 要求的数据
}

// BullMQ 任务返回结构
export interface HedgeJobResult extends HedgeTaskResult {
  processedAt: string;
  duration: number;
}

// 队列名称
export const QUEUE_NAMES = {
  HEDGE_EXECUTE: "hedge.execute",
  HEDGE_DLQ: "hedge.dlq"
} as const;

// 任务优先级
export const PRIORITY = {
  LIQUIDATION: 1,  // 最高优先级
  NORMAL: 5,
  LOW: 10
} as const;

// 重试配置
export const RETRY_CONFIG = {
  maxRetries: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000 // 初始延迟 1 秒
  }
} as const;
```

- [ ] **Write queue types**

#### Step 4: 创建 BullMQ 队列

**File:** `apps/api/src/queue/queue.ts`

```typescript
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

// Redis 连接
const createRedisConnection = (): Redis => {
  return new Redis(config.queue.redisUrl, {
    maxRetriesPerRequest: null // BullMQ 要求
  });
};

// 对冲执行队列
let hedgeQueue: Queue<HedgeJobData> | null = null;
let hedgeQueueEvents: QueueEvents | null = null;

// 死信队列
let dlqQueue: Queue | null = null;

/**
 * 初始化队列
 */
export async function initializeQueues(): Promise<void> {
  const connection = createRedisConnection();

  // 对冲执行队列
  hedgeQueue = new Queue<HedgeJobData>(QUEUE_NAMES.HEDGE_EXECUTE, {
    connection,
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

  hedgeQueueEvents = new QueueEvents(QUEUE_NAMES.HEDGE_EXECUTE, { connection });

  // 死信队列
  dlqQueue = new Queue(QUEUE_NAMES.HEDGE_DLQ, { connection });

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
  logger.info({ msg: "Queues closed" });
}
```

- [ ] **Write queue module**

#### Step 5: 创建队列入口

**File:** `apps/api/src/queue/index.ts`

```typescript
// apps/api/src/queue/index.ts
/**
 * 队列模块入口
 */
export {
  initializeQueues,
  getHedgeQueue,
  getHedgeQueueEvents,
  getDLQQueue,
  addHedgeTask,
  moveToDLQ,
  closeQueues
} from "./queue";

export { QUEUE_NAMES, PRIORITY, RETRY_CONFIG } from "./types";
export type { HedgeJobData, HedgeJobResult } from "./types";
```

- [ ] **Write queue index**

#### Step 6: 提交队列配置

```bash
git add apps/api/src/queue/ apps/api/src/config/index.ts
git commit -m "feat(api): add BullMQ queue with DLQ support"
```

- [ ] **Commit queue setup**

---

## Chunk 2: Hyperliquid 客户端

### Task 2: Hyperliquid Client

**Files:**
- Create: `apps/api/src/clients/hyperliquid.ts`

#### Step 1: 创建 Hyperliquid 客户端

**File:** `apps/api/src/clients/hyperliquid.ts`

```typescript
// apps/api/src/clients/hyperliquid.ts
/**
 * Hyperliquid API 客户端
 * 用于执行对冲订单
 */
import { logger } from "../utils/logger";
import { config } from "../config/index";

// Hyperliquid API 类型
interface HyperliquidOrderRequest {
  coin: string;
  is_buy: boolean;
  sz: string;
  limit_px?: string;
  order_type: "market" | "limit";
  reduce_only?: boolean;
}

interface HyperliquidOrderResponse {
  status: "ok" | "err";
  response: {
    type: "order";
    data: {
      statuses: Array<{
        resting?: { oid: number };
        filled?: { avgPx: string; oid: number };
        error?: string;
      }>;
    };
  };
}

interface HyperliquidPosition {
  coin: string;
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
}

export class HyperliquidClient {
  private apiUrl: string;
  private privateKey: string | null;

  constructor() {
    this.apiUrl = config.external.hyperliquidApiUrl;
    this.privateKey = process.env.HYPERLIQUID_PRIVATE_KEY ?? null;
  }

  /**
   * 提交市价订单
   */
  async submitMarketOrder(
    coin: string,
    side: "buy" | "sell",
    size: string
  ): Promise<{ orderId: string; averagePrice?: string }> {
    if (!this.privateKey) {
      // 开发环境：mock 响应
      logger.warn({
        msg: "HYPERLIQUID_PRIVATE_KEY not set, returning mock response",
        coin,
        side,
        size
      });
      return {
        orderId: `mock-${Date.now()}`,
        averagePrice: "50000" // Mock price
      };
    }

    const orderRequest: HyperliquidOrderRequest = {
      coin,
      is_buy: side === "buy",
      sz: size,
      order_type: "market"
    };

    try {
      const response = await fetch(`${this.apiUrl}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: {
            type: "order",
            orders: [orderRequest],
            grouping: "na"
          },
          nonce: Date.now()
          // 签名逻辑需要 EIP-712 实现
          // signature: await this.signRequest(...)
        })
      });

      const result: HyperliquidOrderResponse = await response.json();

      if (result.status !== "ok") {
        throw new Error(`Hyperliquid API error: ${JSON.stringify(result)}`);
      }

      const status = result.response.data.statuses[0];

      if (status.error) {
        throw new Error(`Order error: ${status.error}`);
      }

      // 返回订单 ID
      const orderId = status.resting?.oid?.toString() ?? status.filled?.oid?.toString() ?? "";
      const averagePrice = status.filled?.avgPx;

      logger.info({
        msg: "Hyperliquid order submitted",
        coin,
        side,
        size,
        orderId,
        averagePrice
      });

      return { orderId, averagePrice };
    } catch (error) {
      logger.error({
        msg: "Hyperliquid order failed",
        coin,
        side,
        size,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * 获取当前持仓
   */
  async getPositions(): Promise<HyperliquidPosition[]> {
    if (!this.privateKey) {
      // Mock 响应
      return [
        {
          coin: "BTC",
          szi: "0.1",
          entryPx: "50000",
          positionValue: "5000",
          unrealizedPnl: "0"
        }
      ];
    }

    try {
      const response = await fetch(`${this.apiUrl}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "clearinghouseState"
        })
      });

      const result = await response.json();

      // 解析持仓数据
      return result.assetPositions?.map((p: Record<string, unknown>) => ({
        coin: (p.position as Record<string, unknown>)?.coin as string,
        szi: (p.position as Record<string, unknown>)?.szi as string,
        entryPx: (p.position as Record<string, unknown>)?.entryPx as string,
        positionValue: (p.position as Record<string, unknown>)?.positionValue as string,
        unrealizedPnl: (p.position as Record<string, unknown>)?.unrealizedPnl as string
      })) ?? [];
    } catch (error) {
      logger.error({
        msg: "Failed to fetch Hyperliquid positions",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * 获取市场价格
   */
  async getMarkPrice(coin: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "metaAndAssetCtxs"
        })
      });

      const result = await response.json();

      // 解析价格数据
      const btcData = result.find(
        (item: Array<unknown>) => item[0] === coin || (item[0] as Record<string, unknown>)?.coin === coin
      );

      if (btcData) {
        const ctx = Array.isArray(btcData) ? btcData[1] : btcData;
        return (ctx as Record<string, unknown>)?.markPx as string ?? "50000";
      }

      return "50000"; // Default mock
    } catch {
      return "50000"; // Fallback
    }
  }
}

export const hyperliquidClient = new HyperliquidClient();
```

- [ ] **Write Hyperliquid client**

#### Step 2: 提交 Hyperliquid 客户端

```bash
git add apps/api/src/clients/hyperliquid.ts
git commit -m "feat(api): add Hyperliquid API client for hedge orders"
```

- [ ] **Commit Hyperliquid client**

---

## Chunk 3: Hedge Worker

### Task 3: Hedge Worker

**Files:**
- Create: `apps/api/src/workers/hedge.worker.ts`

#### Step 1: 创建 Hedge Worker

**File:** `apps/api/src/workers/hedge.worker.ts`

```typescript
// apps/api/src/workers/hedge.worker.ts
/**
 * 对冲任务执行器
 * 消费 BullMQ 队列任务，向 Hyperliquid 提交反向订单
 */
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { prisma } from "../db/client";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { hyperliquidClient } from "../clients/hyperliquid";
import { QUEUE_NAMES, type HedgeJobData, type HedgeJobResult } from "../queue/types";
import { moveToDLQ } from "../queue/queue";
import { canTransitionHedgeStatus } from "@perp-dex/shared";

let worker: Worker<HedgeJobData, HedgeJobResult> | null = null;

/**
 * 启动 Hedge Worker
 */
export function startHedgeWorker(): Worker<HedgeJobData, HedgeJobResult> {
  if (worker) {
    logger.warn({ msg: "Hedge worker already running" });
    return worker;
  }

  const connection = new Redis(config.queue.redisUrl, {
    maxRetriesPerRequest: null
  });

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
async function processHedgeJob(
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
    if (!canTransitionHedgeStatus(hedgeOrder.status, "SUBMITTED")) {
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
    await prisma.hedgeOrder.update({
      where: { taskId: data.taskId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date()
      }
    });

    // 4. 执行反向订单
    // 对冲方向：用户做多 -> 平台做空，用户做空 -> 平台做多
    const hedgeSide = data.side === "LONG" ? "sell" : "buy";

    const result = await hyperliquidClient.submitMarketOrder(
      data.symbol,
      hedgeSide,
      data.size
    );

    // 5. 更新订单状态
    await prisma.hedgeOrder.update({
      where: { taskId: data.taskId },
      data: {
        status: "FILLED",
        externalOrderId: result.orderId,
        referencePrice: result.averagePrice ? BigInt(Math.floor(parseFloat(result.averagePrice) * 1e6)) : null,
        filledAt: new Date()
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

    // 更新失败状态
    await prisma.hedgeOrder.update({
      where: { taskId: data.taskId },
      data: {
        status: "FAILED",
        errorMessage,
        failedAt: new Date()
      }
    });

    // 检查是否应该移到 DLQ
    if (job.attemptsMade >= job.opts.attempts ?? 3) {
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
```

- [ ] **Write hedge worker**

#### Step 2: 集成 Trade Engine 与队列

**File:** `apps/api/src/engines/trade-engine.ts` (修改)

在 `createMarketOrder` 和 `closePosition` 方法中添加对冲任务：

```typescript
// 在文件顶部添加导入
import { addHedgeTask } from "../queue/queue";

// 在 createMarketOrder 成功后添加：
// 6. 创建对冲任务
const hedgeTaskId = await addHedgeTask({
  taskId: crypto.randomUUID(),
  source: "orderFill",
  userId,
  orderId: result.order.id,
  positionId: result.position.id,
  symbol,
  side: side === "LONG" ? "SHORT" : "LONG", // 反向
  size: size.toString(),
  referencePrice: markPrice.toString(),
  priority: "normal",
  retryCount: 0,
  maxRetries: 3,
  idempotencyKey: `hedge-${result.order.id}`,
  requestedAt: new Date().toISOString()
});

// 同时创建 HedgeOrder 记录
await prisma.hedgeOrder.create({
  data: {
    taskId: hedgeTaskId,
    userId,
    orderId: result.order.id,
    positionId: result.position.id,
    symbol,
    side: side === "LONG" ? "SHORT" : "LONG",
    size,
    referencePrice: markPrice,
    trigger: "OPEN",
    priority: 5,
    status: "PENDING",
    payload: {}
  }
});
```

- [ ] **Integrate trade engine with queue**

#### Step 3: 提交 Hedge Worker

```bash
git add apps/api/src/workers/ apps/api/src/engines/trade-engine.ts
git commit -m "feat(api): add hedge worker with BullMQ integration"
```

- [ ] **Commit hedge worker**

---

## Chunk 4: 净头寸对账任务

### Task 4: Reconciliation Job

**Files:**
- Create: `apps/api/src/jobs/reconciliation.ts`

#### Step 1: 创建对账任务

**File:** `apps/api/src/jobs/reconciliation.ts`

```typescript
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
```

- [ ] **Write reconciliation job**

#### Step 2: 更新 jobs 入口

**File:** `apps/api/src/jobs/index.ts` (修改)

```typescript
// apps/api/src/jobs/index.ts
/**
 * 定时任务入口
 */
export {
  runLiquidationCheck,
  startLiquidationScheduler
} from "./liquidation-check";

export {
  runReconciliation,
  startReconciliationScheduler
} from "./reconciliation";
```

- [ ] **Update jobs index**

#### Step 3: 提交对账任务

```bash
git add apps/api/src/jobs/
git commit -m "feat(api): add net position reconciliation job"
```

- [ ] **Commit reconciliation job**

---

## Chunk 5: 集成与启动

### Task 5: Integration

**Files:**
- Modify: `apps/api/src/index.ts`

#### Step 1: 集成到主应用入口

**File:** `apps/api/src/index.ts` (修改)

```typescript
// apps/api/src/index.ts
/**
 * 应用入口
 */
import { buildServer } from "./app";
import { config } from "./config/index";
import { logger } from "./utils/logger";
import { initializeQueues, closeQueues } from "./queue";
import { startHedgeWorker, stopHedgeWorker } from "./workers/hedge.worker";
import {
  startLiquidationScheduler,
  startReconciliationScheduler
} from "./jobs";

async function main() {
  // 初始化队列
  await initializeQueues();

  // 启动 Hedge Worker
  startHedgeWorker();

  // 启动定时任务
  const liquidationScheduler = startLiquidationScheduler();
  const reconciliationScheduler = startReconciliationScheduler();

  // 构建 Fastify 服务器
  const app = await buildServer();

  // 启动服务器
  await app.listen({
    port: config.server.port,
    host: "0.0.0.0"
  });

  logger.info({
    msg: "Server started",
    port: config.server.port,
    nodeEnv: config.server.nodeEnv
  });

  // 优雅关闭
  const shutdown = async (signal: string) => {
    logger.info({ msg: `Received ${signal}, shutting down...` });

    // 停止定时任务
    liquidationScheduler.stop();
    reconciliationScheduler.stop();

    // 停止 Worker
    await stopHedgeWorker();

    // 关闭队列
    await closeQueues();

    // 关闭服务器
    await app.close();

    logger.info({ msg: "Shutdown complete" });
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.fatal({
    msg: "Application failed to start",
    error: error instanceof Error ? error.message : "Unknown error"
  });
  process.exit(1);
});
```

- [ ] **Integrate all components in main entry**

#### Step 2: 最终提交

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): integrate queue, worker and jobs in main entry"
```

- [ ] **Final commit**

---

## Acceptance Criteria

- [ ] BullMQ 队列正常工作，任务持久化到 Redis
- [ ] Hedge Worker 正确消费任务并执行对冲
- [ ] 失败任务自动重试（最多 3 次）
- [ ] 超过重试次数的任务移入 DLQ
- [ ] 清算任务优先级高于普通对冲任务
- [ ] 净头寸对账能检测头寸差异
- [ ] 优雅关闭时正确清理资源

## Notes

- Redis 连接需要在环境变量中配置 `REDIS_URL`
- Hyperliquid API 签名需要实现 EIP-712（MVP 可用 mock）
- 生产环境建议 Worker 单独部署
- 对账失败应触发告警（MVP 可仅记录日志）
