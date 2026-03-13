# 对冲系统可靠性重构设计

**日期：** 2026-03-13
**状态：** 设计阶段
**优先级：** P0（阻塞生产）

---

## 1. 背景与问题

代码审查发现对冲系统存在多个严重问题，影响系统可靠性：

| ID | 严重度 | 问题 | 影响 |
|----|--------|------|------|
| P1 | 严重 | 对冲重试失效 | 失败后直接写 FAILED，重试时状态机阻止再执行 |
| P2 | 严重 | 开仓并发不安全 | 余额/单仓检查在事务外，可能重复开仓 |
| P3 | 严重 | 事务原子性缺失 | hedgeOrder 和 addHedgeTask 在事务外，可能悬空风险敞口 |
| P4 | 高 | 优先级映射错误 | 枚举 "HIGH" vs 队列 "high"，清算无法抢占 |
| P5 | 高 | 清算巡检未实现 | liquidation-check 是 TODO 空实现 |
| P6 | 高 | 亏损保护缺失 | 平仓可能导致账户余额为负 |
| P7 | 中 | API 错误处理粗糙 | 靠 message substring 匹配错误 |

---

## 2. 设计目标

1. **可靠性**：对冲任务不丢失、可重试、状态可追溯
2. **一致性**：交易记账和对冲派发原子完成
3. **并发安全**：防止重复开仓和超额锁定保证金
4. **风控闭环**：自动清算巡检、亏损保护

---

## 3. 详细设计

### 3.1 对冲状态机重构（P1 + P4）

#### 新状态机

```
PENDING → ENQUEUED → PROCESSING → FILLED
                 ↓              ↓
              RETRYABLE ←──────┘
                 ↓ (重试次数耗尽)
              FAILED (终态)
```

#### 状态说明

| 状态 | 说明 | 可转换到 |
|------|------|---------|
| PENDING | 初始状态，已写入数据库 | ENQUEUED |
| ENQUEUED | 已进入 BullMQ 队列 | PROCESSING |
| PROCESSING | Worker 正在处理 | FILLED, RETRYABLE |
| RETRYABLE | 本次尝试失败，可重试 | PROCESSING, FAILED |
| FILLED | 成功完成（终态） | - |
| FAILED | 重试次数耗尽，需人工介入（终态） | - |

#### 重试策略

- 最大重试次数：5 次
- 重试间隔：指数退避（1s, 2s, 4s, 8s, 16s）
- 重试条件：网络错误、API 限流、临时故障
- 不重试：参数错误、资产不存在

#### 状态转换定义（packages/shared/src/hedge.ts）

```typescript
// 更新状态转换规则
export const hedgeStatusTransitions: Record<HedgeStatus, HedgeStatus[]> = {
  PENDING: ["ENQUEUED"],
  ENQUEUED: ["PROCESSING", "FAILED"],
  PROCESSING: ["FILLED", "RETRYABLE", "FAILED"],
  RETRYABLE: ["ENQUEUED", "FAILED"],
  FILLED: [],
  FAILED: []
};

export function canTransitionHedgeStatus(from: HedgeStatus, to: HedgeStatus): boolean {
  return hedgeStatusTransitions[from]?.includes(to) ?? false;
}
```

#### RETRYABLE 重试调度器

```typescript
// apps/api/src/workers/retry-scheduler.ts
const MAX_RETRY_COUNT = 5;

export function startRetryScheduler() {
  // 每 5 秒扫描一次 RETRYABLE 任务
  setInterval(async () => {
    const retryable = await prisma.hedgeOrder.findMany({
      where: {
        status: "RETRYABLE",
        retryCount: { lt: MAX_RETRY_COUNT }
      },
      take: 50
    });

    for (const task of retryable) {
      // 指数退避检查
      const lastAttempt = task.updatedAt;
      const backoffMs = Math.pow(2, task.retryCount) * 1000;
      if (Date.now() - lastAttempt.getTime() < backoffMs) {
        continue; // 还在退避期
      }

      // 重新写入 Outbox
      await prisma.$transaction([
        prisma.hedgeOrder.update({
          where: { id: task.id },
          data: {
            status: "ENQUEUED",
            retryCount: { increment: 1 }
          }
        }),
        prisma.hedgeOutbox.create({
          data: {
            taskId: task.taskId,
            payload: task.payload,
            status: "PENDING"
          }
        })
      ]);
    }
  }, 5000);
}
```

#### 优先级修复（P4）

```typescript
// queue.ts - getPriorityNumber
function getPriorityNumber(priority?: string): number {
  switch (priority) {
    case "HIGH":
      return 1;  // 最高优先级（清算）
    case "LOW":
      return 10;
    case "NORMAL":
    default:
      return 5;
  }
}
```

---

### 3.2 并发安全与原子性（P2 + P3）

#### Schema 修改

```prisma
// 更新 HedgeStatus 枚举
enum HedgeStatus {
  PENDING    // 初始状态
  ENQUEUED   // 已入队
  PROCESSING // 处理中
  RETRYABLE  // 可重试
  FILLED     // 成功
  FAILED     // 终态失败
}

model Position {
  // ... existing fields

  // 新增：版本号（乐观锁）
  version     Int      @default(0)

  // 唯一约束：一个用户同一币种只能有一个 OPEN 仓位
  // 使用部分唯一索引（PostgreSQL）
}

model HedgeOutbox {
  id          String   @id @default(cuid())
  taskId      String   @unique
  payload     Json
  status      String   @default("PENDING") // PENDING, SENT, FAILED
  createdAt   DateTime @default(now())
  sentAt      DateTime?
  error       String?
  attempts    Int      @default(0)

  @@index([status, createdAt])
}

// 新增：坏账记录
model BadDebt {
  id         String   @id @default(cuid())
  userId     String
  positionId String
  amount     BigInt      // 坏账金额 (USDC, 6 decimals)
  reason     String      @db.VarChar(64) // SHORT_OVERLOSS, LIQUIDATION_SHORTFALL
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id])
  position Position @relation(fields: [positionId], references: [id])

  @@index([userId])
  @@map("bad_debts")
}
```

#### 部分唯一索引迁移

```sql
-- 创建部分唯一索引：仅对 status=OPEN 的记录生效
CREATE UNIQUE INDEX unique_open_position
ON "Position"(userId, symbol)
WHERE status = 'OPEN';
```

#### 交易流程重构

```typescript
async createMarketOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const hedgeTaskId = crypto.randomUUID();

  // 事务内完成所有数据库写入
  const result = await prisma.$transaction(async (tx) => {
    // 1. 获取账户（带版本号用于乐观锁）
    const account = await tx.account.findUnique({
      where: { userId_asset: { userId, asset: "USDC" } }
    });

    if (!account) {
      throw new TradeError("ACCOUNT_NOT_FOUND", "Account not found");
    }

    if (account.availableBalance < margin) {
      throw new TradeError("INSUFFICIENT_BALANCE",
        `Available balance ${account.availableBalance} USDC is less than required margin ${margin} USDC`,
        { available: account.availableBalance.toString(), required: margin.toString() }
      );
    }

    // 2. 检查现有仓位（唯一约束会二次保护）
    const existing = await tx.position.findFirst({
      where: { userId, symbol, status: "OPEN" }
    });
    if (existing) {
      throw new TradeError("POSITION_EXISTS",
        "Position already exists for this symbol",
        { existingPositionId: existing.id }
      );
    }

    // 3. 更新账户余额（乐观锁：version 自增）
    const updateResult = await tx.account.updateMany({
      where: {
        id: account.id,
        version: account.version  // 乐观锁检查
      },
      data: {
        availableBalance: { decrement: margin },
        lockedBalance: { increment: margin },
        version: { increment: 1 }
      }
    });

    if (updateResult.count === 0) {
      throw new TradeError("CONCURRENT_MODIFICATION",
        "Account was modified by another transaction, please retry"
      );
    }

    // 4. 创建订单和仓位
    const order = await tx.order.create({ ... });
    const position = await tx.position.create({
      data: {
        ...
        version: 1
      }
    });

    // 5. 创建对冲订单（PENDING 状态）
    await tx.hedgeOrder.create({
      data: {
        taskId: hedgeTaskId,
        status: "PENDING",
        retryCount: 0,
        ...
      }
    });

    // 6. 写入 Outbox（唯一入队入口）
    await tx.hedgeOutbox.create({
      data: {
        taskId: hedgeTaskId,
        payload: {
          taskId: hedgeTaskId,
          symbol,
          side: hedgeSide,
          size: size.toString(),
          priority: "NORMAL"
        },
        status: "PENDING"
      }
    });

    return { order, position };
  });

  // 注意：不再调用异步的 addHedgeTask
  // 由 Outbox Dispatcher 负责入队

  return result;
}
```

#### Outbox Dispatcher

```typescript
// apps/api/src/workers/outbox-dispatcher.ts
const OUTBOX_POLL_INTERVAL = 1000; // 1秒
const OUTBOX_BATCH_SIZE = 100;

export function startOutboxDispatcher() {
  setInterval(async () => {
    try {
      await processOutbox();
    } catch (error) {
      logger.error({ msg: "Outbox dispatcher error", error });
    }
  }, OUTBOX_POLL_INTERVAL);
}

async function processOutbox() {
  const pending = await prisma.hedgeOutbox.findMany({
    where: { status: "PENDING" },
    take: OUTBOX_BATCH_SIZE,
    orderBy: { createdAt: "asc" }
  });

  for (const item of pending) {
    try {
      // 发送到 BullMQ
      await addHedgeTask(item.payload as HedgeJobData);

      // 事务内更新状态：确保 outbox 和 hedgeOrder 一致
      await prisma.$transaction([
        prisma.hedgeOutbox.update({
          where: { id: item.id },
          data: { status: "SENT", sentAt: new Date() }
        }),
        prisma.hedgeOrder.update({
          where: { taskId: item.taskId },
          data: { status: "ENQUEUED", enqueuedAt: new Date() }
        })
      ]);
    } catch (error) {
      // 单独更新 outbox 失败状态
      await prisma.hedgeOutbox.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
          attempts: { increment: 1 }
        }
      });
      // hedgeOrder 保持 PENDING 状态，等待下次调度
    }
  }
}
```

---

### 3.3 风控闭环（P5 + P6）

#### 清算巡检实现

```typescript
const MAINTENANCE_MARGIN_RATIO = 0.5; // 50%

async function runLiquidationCheck(): Promise<void> {
  const positions = await prisma.position.findMany({
    where: { status: "OPEN" },
    include: { user: { include: { accounts: true } } }
  });

  for (const position of positions) {
    try {
      const markPrice = await marketService.getMarkPrice(position.symbol);

      // 更新仓位标记价格
      await prisma.position.update({
        where: { id: position.id },
        data: { markPrice }
      });

      // 计算保证金率
      const metrics = calculatePositionMetrics({
        side: position.side,
        positionSize: position.positionSize,
        entryPrice: position.entryPrice,
        markPrice,
        margin: position.margin
      });

      // 判断是否需要清算
      if (metrics.marginRatio < MAINTENANCE_MARGIN_RATIO) {
        logger.warn({
          msg: "Position requires liquidation",
          positionId: position.id,
          marginRatio: metrics.marginRatio,
          markPrice
        });

        await triggerLiquidation(position, markPrice, metrics);
      } else if (metrics.marginRatio < 0.8) {
        // 风险预警
        await prisma.position.update({
          where: { id: position.id },
          data: { riskLevel: "WARNING" }
        });
      }
    } catch (error) {
      logger.error({
        msg: "Liquidation check failed for position",
        positionId: position.id,
        error
      });
    }
  }
}

async function triggerLiquidation(position, markPrice, metrics) {
  // 再次检查仓位状态（防止与手动平仓竞争）
  const freshPosition = await prisma.position.findUnique({
    where: { id: position.id }
  });
  if (!freshPosition || freshPosition.status !== "OPEN") {
    logger.info({ msg: "Position already closed, skip liquidation", positionId: position.id });
    return;
  }

  // 调用现有的 liquidatePosition
  await tradeEngine.liquidatePosition(position.id, "AUTO_LIQUIDATION");
}

// 清算调度器（使用 BullMQ Repeatable Job 更可靠）
// apps/api/src/jobs/liquidation-scheduler.ts
import { Queue, Worker } from "bullmq";

const LIQUIDATION_QUEUE = "liquidation-check";

export function startLiquidationScheduler() {
  const queue = new Queue(LIQUIDATION_QUEUE, { connection });

  // 每 5 分钟执行一次
  queue.add("check", {}, {
    repeat: { every: 5 * 60 * 1000 },
    jobId: "liquidation-check"
  });

  const worker = new Worker(LIQUIDATION_QUEUE, async (job) => {
    // 使用 Redis 分布式锁防止多实例重复执行
    const lockKey = "liquidation:check:lock";
    const locked = await redis.set(lockKey, "1", "NX", "EX", 300); // 5分钟过期

    if (!locked) {
      logger.info({ msg: "Liquidation check already running on another instance" });
      return;
    }

    try {
      await runLiquidationCheck();
    } finally {
      await redis.del(lockKey);
    }
  }, { connection });

  return { queue, worker };
}
```

#### 亏损保护

```typescript
async function closePosition(userId: string, positionId: string) {
  // ... 计算 realizedPnl

  const maxLoss = position.margin;
  const actualLoss = Math.abs(realizedPnl);

  let balanceChange = realizedPnl;

  // 检查是否超过保证金亏损
  if (actualLoss > maxLoss && realizedPnl < 0) {
    // 记录坏账
    const badDebtAmount = actualLoss - maxLoss;

    await prisma.badDebt.create({
      data: {
        userId,
        positionId,
        amount: badDebtAmount,
        reason: realizedPnl < 0 ? "SHORT_OVERLOSS" : "LIQUIDATION_SHORTFALL"
      }
    });

    // 限制账户余额最多扣到 0
    const account = await tx.account.findUnique({ ... });
    balanceChange = Math.max(
      -account.availableBalance,
      realizedPnl
    );

    logger.warn({
      msg: "Bad debt recorded",
      userId,
      positionId,
      badDebtAmount,
      originalPnl: realizedPnl,
      adjustedPnl: balanceChange
    });
  }

  // 使用调整后的 balanceChange 更新账户
  // ...
}
```

---

### 3.4 API 错误处理（P7）

#### 错误码枚举

```typescript
// packages/shared/src/errors.ts
export enum TradeErrorCode {
  // 余额相关
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",

  // 仓位相关
  POSITION_EXISTS = "POSITION_EXISTS",
  POSITION_NOT_FOUND = "POSITION_NOT_FOUND",
  POSITION_ALREADY_CLOSED = "POSITION_ALREADY_CLOSED",

  // 参数验证
  INVALID_SIZE = "INVALID_SIZE",
  INVALID_LEVERAGE = "INVALID_LEVERAGE",
  INVALID_SYMBOL = "INVALID_SYMBOL",

  // 对冲相关
  HEDGE_FAILED = "HEDGE_FAILED",
  HEDGE_TIMEOUT = "HEDGE_TIMEOUT",

  // 系统错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export class TradeError extends Error {
  constructor(
    public code: TradeErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TradeError";
  }
}
```

#### 结构化错误响应

```typescript
// 错误响应格式
interface ErrorResponse {
  success: false;
  error: {
    code: TradeErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

// 使用示例
throw new TradeError(
  TradeErrorCode.INSUFFICIENT_BALANCE,
  "Available balance 100 USDC is less than required margin 500 USDC",
  { available: "100", required: "500", asset: "USDC" }
);
```

#### 错误处理器

```typescript
// apps/api/src/middleware/error-handler.ts
export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof TradeError) {
    const statusCode = getStatusCode(error.code);
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }

  // 其他错误...
}

function getStatusCode(code: TradeErrorCode): number {
  switch (code) {
    case TradeErrorCode.INSUFFICIENT_BALANCE:
    case TradeErrorCode.POSITION_EXISTS:
      return 400;
    case TradeErrorCode.POSITION_NOT_FOUND:
    case TradeErrorCode.ACCOUNT_NOT_FOUND:
      return 404;
    case TradeErrorCode.SERVICE_UNAVAILABLE:
      return 503;
    default:
      return 500;
  }
}
```

---

## 4. 实施顺序

1. **Phase 1: 基础设施**
   - Schema 迁移：添加 version 字段、唯一约束、HedgeOutbox 表
   - 错误码枚举和 TradeError 类

2. **Phase 2: 状态机重构**
   - 更新 hedgeOrder 状态定义
   - 重写 hedge.worker.ts 重试逻辑
   - 修复优先级映射

3. **Phase 3: 原子性保证**
   - 重构 createMarketOrder 事务
   - 实现 Outbox Dispatcher

4. **Phase 4: 风控闭环**
   - 实现清算巡检
   - 添加亏损保护

5. **Phase 5: 错误处理**
   - 更新所有路由使用 TradeError
   - 更新错误处理器

---

## 5. 验收标准

- [ ] 对冲任务失败后可自动重试
- [ ] 并发开仓请求不会重复创建仓位
- [ ] 事务失败不会留下悬空风险敞口
- [ ] 清算任务优先级高于普通对冲
- [ ] 清算巡检每 5 分钟执行并触发清算
- [ ] 平仓不会导致账户余额为负
- [ ] API 返回结构化错误码

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Schema 迁移失败 | 阻塞部署 | 先在测试环境验证，准备回滚脚本 |
| Outbox 轮询延迟 | 对冲延迟增加 | 可接受（秒级延迟），后续可优化为事件驱动 |
| 清算巡检性能 | 数据库压力 | 分批处理，添加索引 |
| Outbox 单点故障 | Dispatcher 崩溃导致对冲停止 | 使用 BullMQ Repeatable Job 替代 setInterval |
| RETRYABLE 堆积 | 大量任务需人工介入 | Retry Scheduler 自动重入队，添加堆积告警 |
| 清算与平仓竞争 | 状态不一致 | 执行前再次检查 position.status |
| Hyperliquid API 限流 | 对冲失败 | 识别 429 错误，增加退避时间 |

---

## 7. 后续优化（非本次范围）

- 事件驱动替代 Outbox 轮询（PG NOTIFY）
- 部分平仓支持
- 加减保证金
- Bull Board 监控面板
- 对冲任务查询 API
