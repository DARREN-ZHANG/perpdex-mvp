# Sprint 2 泳道 C: 链上同步 (Indexer) 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Vault 合约事件监听器，同步链上 Deposit/Withdraw 事件到数据库

**Architecture:** viem 事件监听 → 幂等检查 → 事务更新余额。独立的 Indexer 进程，可单独部署。

**Tech Stack:** TypeScript, viem, Prisma, node-cron

**Dependencies:**
- T04 事件模型 (✅)
- T11 Prisma (✅)
- T20 Vault 合约 (✅)

**Deliverables:**
- `indexer/index.ts` - Indexer 入口
- `indexer/vault-indexer.ts` - Vault 事件监听
- `indexer/event-handler.ts` - 事件处理器
- `indexer/block-cursor.ts` - 区块游标管理

---

## File Structure

```
apps/api/src/
├── indexer/
│   ├── index.ts              # Indexer 入口
│   ├── vault-indexer.ts      # Vault 合约事件监听
│   ├── event-handler.ts      # 事件处理逻辑
│   └── block-cursor.ts       # 区块游标管理
└── types/
    └── index.ts              # 添加相关类型
```

---

## Chunk 1: 区块游标管理

### Task 1: Block Cursor Manager

**Files:**
- Create: `apps/api/src/indexer/block-cursor.ts`

#### Step 1: 创建区块游标 Schema（如果不存在）

检查 Prisma schema 是否有 block_cursor 表。如果没有，添加：

```prisma
model BlockCursor {
  id        String   @id @default(cuid())
  chainId   Int      @unique
  cursor    BigInt
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("block_cursors")
}
```

- [ ] **Check and add BlockCursor model to Prisma schema**

#### Step 2: 运行数据库迁移

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/apps/api && pnpm prisma migrate dev --name add_block_cursor`

- [ ] **Run Prisma migration**

#### Step 3: 创建 Block Cursor Manager

**File:** `apps/api/src/indexer/block-cursor.ts`

```typescript
// apps/api/src/indexer/block-cursor.ts
/**
 * 区块游标管理器
 * 追踪已处理的区块高度，支持断点续传
 */
import { prisma } from "../db/client";
import { logger } from "../utils/logger";

export const CHAIN_ID = 421614; // Arbitrum Sepolia

export class BlockCursorManager {
  private chainId: number;
  private cursorId: string | null = null;

  constructor(chainId: number = CHAIN_ID) {
    this.chainId = chainId;
  }

  /**
   * 初始化游标
   * 如果不存在则创建，从起始区块开始
   */
  async initialize(startBlock: bigint): Promise<void> {
    const existing = await prisma.blockCursor.findUnique({
      where: { chainId: this.chainId }
    });

    if (existing) {
      this.cursorId = existing.id;
      logger.info({
        msg: "Block cursor loaded",
        chainId: this.chainId,
        cursor: existing.cursor.toString()
      });
    } else {
      const created = await prisma.blockCursor.create({
        data: {
          chainId: this.chainId,
          cursor: startBlock
        }
      });
      this.cursorId = created.id;
      logger.info({
        msg: "Block cursor created",
        chainId: this.chainId,
        startBlock: startBlock.toString()
      });
    }
  }

  /**
   * 获取当前游标
   */
  async getCursor(): Promise<bigint> {
    if (!this.cursorId) {
      throw new Error("Cursor not initialized. Call initialize() first.");
    }

    const cursor = await prisma.blockCursor.findUnique({
      where: { id: this.cursorId }
    });

    if (!cursor) {
      throw new Error("Cursor record not found");
    }

    return cursor.cursor;
  }

  /**
   * 更新游标
   * 仅当新区块 > 当前游标时才更新
   */
  async advanceCursor(newBlock: bigint): Promise<void> {
    if (!this.cursorId) {
      throw new Error("Cursor not initialized. Call initialize() first.");
    }

    const current = await this.getCursor();

    if (newBlock > current) {
      await prisma.blockCursor.update({
        where: { id: this.cursorId },
        data: { cursor: newBlock }
      });

      logger.debug({
        msg: "Block cursor advanced",
        chainId: this.chainId,
        fromBlock: current.toString(),
        toBlock: newBlock.toString()
      });
    }
  }

  /**
   * 批量更新游标（带事务）
   */
  async advanceCursorWithTx(newBlock: bigint, tx: typeof prisma): Promise<void> {
    if (!this.cursorId) {
      throw new Error("Cursor not initialized. Call initialize() first.");
    }

    await tx.blockCursor.update({
      where: { id: this.cursorId },
      data: { cursor: newBlock }
    });
  }
}
```

- [ ] **Write block cursor manager**

#### Step 4: 提交区块游标

```bash
git add apps/api/prisma/schema.prisma apps/api/src/indexer/block-cursor.ts
git commit -m "feat(api): add block cursor manager for indexer"
```

- [ ] **Commit block cursor**

---

## Chunk 2: 事件处理器

### Task 2: Event Handler

**Files:**
- Create: `apps/api/src/indexer/event-handler.ts`

#### Step 1: 创建事件处理器

**File:** `apps/api/src/indexer/event-handler.ts`

```typescript
// apps/api/src/indexer/event-handler.ts
/**
 * 事件处理器
 * 处理 Vault 合约的 Deposit/Withdraw 事件
 */
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import {
  createOnchainEventIdempotencyKey,
  type OnchainEventRecord
} from "@perp-dex/shared";

export interface DepositEvent {
  user: `0x${string}`;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface WithdrawEvent {
  user: `0x${string}`;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export class EventHandler {
  /**
   * 处理 Deposit 事件
   */
  async handleDeposit(event: DepositEvent): Promise<void> {
    const idempotencyKey = createOnchainEventIdempotencyKey({
      txHash: event.transactionHash,
      logIndex: event.logIndex,
      eventName: "Deposit"
    });

    logger.info({
      msg: "Processing Deposit event",
      user: event.user,
      amount: event.amount.toString(),
      txHash: event.transactionHash,
      idempotencyKey
    });

    // 查找或创建用户
    const user = await prisma.user.upsert({
      where: { walletAddress: event.user.toLowerCase() },
      create: {
        walletAddress: event.user.toLowerCase()
      },
      update: {}
    });

    // 幂等检查
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey }
    });

    if (existingTx) {
      logger.debug({
        msg: "Deposit event already processed, skipping",
        idempotencyKey
      });
      return;
    }

    // 获取或创建账户
    const account = await prisma.account.upsert({
      where: {
        userId_asset: {
          userId: user.id,
          asset: "USDC"
        }
      },
      create: {
        userId: user.id,
        asset: "USDC",
        availableBalance: BigInt(0),
        lockedBalance: BigInt(0),
        equity: BigInt(0)
      },
      update: {}
    });

    // 事务：更新余额 + 创建交易记录
    await prisma.$transaction(async (tx) => {
      // 增加可用余额
      await tx.account.update({
        where: { id: account.id },
        data: {
          availableBalance: { increment: event.amount },
          equity: { increment: event.amount }
        }
      });

      // 创建交易记录
      await tx.transaction.create({
        data: {
          userId: user.id,
          accountId: account.id,
          type: "DEPOSIT",
          eventName: "DEPOSIT",
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          amount: event.amount,
          status: "CONFIRMED",
          idempotencyKey,
          confirmedAt: new Date()
        }
      });
    });

    logger.info({
      msg: "Deposit event processed successfully",
      userId: user.id,
      amount: event.amount.toString(),
      txHash: event.transactionHash
    });
  }

  /**
   * 处理 Withdraw 事件
   */
  async handleWithdraw(event: WithdrawEvent): Promise<void> {
    const idempotencyKey = createOnchainEventIdempotencyKey({
      txHash: event.transactionHash,
      logIndex: event.logIndex,
      eventName: "Withdraw"
    });

    logger.info({
      msg: "Processing Withdraw event",
      user: event.user,
      amount: event.amount.toString(),
      txHash: event.transactionHash,
      idempotencyKey
    });

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { walletAddress: event.user.toLowerCase() }
    });

    if (!user) {
      logger.warn({
        msg: "User not found for Withdraw event, skipping",
        walletAddress: event.user
      });
      return;
    }

    // 幂等检查
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey }
    });

    if (existingTx) {
      logger.debug({
        msg: "Withdraw event already processed, skipping",
        idempotencyKey
      });
      return;
    }

    // 获取账户
    const account = await prisma.account.findUnique({
      where: {
        userId_asset: {
          userId: user.id,
          asset: "USDC"
        }
      }
    });

    if (!account) {
      logger.warn({
        msg: "Account not found for Withdraw event",
        userId: user.id
      });
      return;
    }

    // 事务：更新余额 + 更新交易状态
    await prisma.$transaction(async (tx) => {
      // 释放锁定余额（提现在请求时已锁定）
      await tx.account.update({
        where: { id: account.id },
        data: {
          lockedBalance: { decrement: event.amount },
          equity: { decrement: event.amount }
        }
      });

      // 查找并更新对应的提现请求
      const pendingWithdraw = await tx.transaction.findFirst({
        where: {
          userId: user.id,
          type: "WITHDRAW",
          status: "PENDING",
          amount: event.amount
        },
        orderBy: { createdAt: "desc" }
      });

      if (pendingWithdraw) {
        await tx.transaction.update({
          where: { id: pendingWithdraw.id },
          data: {
            txHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
            status: "CONFIRMED",
            confirmedAt: new Date()
          }
        });
      } else {
        // 创建新的交易记录（如果没有对应的 pending 请求）
        await tx.transaction.create({
          data: {
            userId: user.id,
            accountId: account.id,
            type: "WITHDRAW",
            eventName: "WITHDRAW",
            txHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
            amount: event.amount,
            status: "CONFIRMED",
            idempotencyKey,
            confirmedAt: new Date()
          }
        });
      }
    });

    logger.info({
      msg: "Withdraw event processed successfully",
      userId: user.id,
      amount: event.amount.toString(),
      txHash: event.transactionHash
    });
  }
}
```

- [ ] **Write event handler**

#### Step 2: 提交事件处理器

```bash
git add apps/api/src/indexer/event-handler.ts
git commit -m "feat(api): add indexer event handler with idempotent processing"
```

- [ ] **Commit event handler**

---

## Chunk 3: Vault Indexer

### Task 3: Vault Indexer

**Files:**
- Create: `apps/api/src/indexer/vault-indexer.ts`
- Create: `apps/api/src/indexer/index.ts`

#### Step 1: 创建 Vault Indexer

**File:** `apps/api/src/indexer/vault-indexer.ts`

```typescript
// apps/api/src/indexer/vault-indexer.ts
/**
 * Vault 合约事件监听器
 * 监听 Deposit/Withdraw 事件并同步到数据库
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Log
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { BlockCursorManager } from "./block-cursor";
import { EventHandler, type DepositEvent, type WithdrawEvent } from "./event-handler";

// Vault 合约 ABI (事件定义)
const VAULT_EVENTS = [
  parseAbiItem("event Deposit(address indexed user, uint256 amount)"),
  parseAbiItem("event Withdraw(address indexed user, uint256 amount)")
] as const;

export class VaultIndexer {
  private client: ReturnType<typeof createPublicClient>;
  private vaultAddress: Address;
  private cursorManager: BlockCursorManager;
  private eventHandler: EventHandler;
  private isRunning: boolean = false;
  private pollInterval: number = 2000; // 2 秒

  constructor() {
    this.vaultAddress = config.external.vaultContractAddress as Address;
    this.cursorManager = new BlockCursorManager();
    this.eventHandler = new EventHandler();

    this.client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(config.external.rpcUrl)
    });
  }

  /**
   * 启动 Indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn({ msg: "Vault indexer already running" });
      return;
    }

    logger.info({
      msg: "Starting Vault indexer",
      vaultAddress: this.vaultAddress,
      chainId: arbitrumSepolia.id
    });

    // 初始化游标（从当前区块 - 100 开始，避免错过事件）
    const latestBlock = await this.client.getBlockNumber();
    const startBlock = latestBlock - 100n;
    await this.cursorManager.initialize(startBlock);

    this.isRunning = true;

    // 启动轮询
    this.poll();
  }

  /**
   * 停止 Indexer
   */
  stop(): void {
    this.isRunning = false;
    logger.info({ msg: "Vault indexer stopped" });
  }

  /**
   * 轮询事件
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.fetchAndProcessEvents();
      } catch (error) {
        logger.error({
          msg: "Error in indexer poll loop",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }

      // 等待下一次轮询
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * 获取并处理事件
   */
  private async fetchAndProcessEvents(): Promise<void> {
    const fromBlock = await this.cursorManager.getCursor();
    const latestBlock = await this.client.getBlockNumber();

    // 没有新区块
    if (fromBlock >= latestBlock) {
      return;
    }

    // 限制单次查询的区块范围，避免 RPC 超时
    const toBlock = fromBlock + 1000n > latestBlock ? latestBlock : fromBlock + 1000n;

    logger.debug({
      msg: "Fetching events",
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString()
    });

    // 获取 Deposit 事件
    const depositLogs = await this.client.getLogs({
      address: this.vaultAddress,
      event: VAULT_EVENTS[0],
      fromBlock,
      toBlock
    });

    // 获取 Withdraw 事件
    const withdrawLogs = await this.client.getLogs({
      address: this.vaultAddress,
      event: VAULT_EVENTS[1],
      fromBlock,
      toBlock
    });

    logger.debug({
      msg: "Events fetched",
      depositCount: depositLogs.length,
      withdrawCount: withdrawLogs.length
    });

    // 处理 Deposit 事件
    for (const log of depositLogs) {
      await this.processDepositLog(log);
    }

    // 处理 Withdraw 事件
    for (const log of withdrawLogs) {
      await this.processWithdrawLog(log);
    }

    // 更新游标
    await this.cursorManager.advanceCursor(toBlock + 1n);
  }

  /**
   * 处理 Deposit 日志
   */
  private async processDepositLog(log: Log<bigint, number, typeof VAULT_EVENTS[0]>): Promise<void> {
    if (!log.args || log.blockNumber === undefined) {
      return;
    }

    const event: DepositEvent = {
      user: log.args.user,
      amount: log.args.amount,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex
    };

    try {
      await this.eventHandler.handleDeposit(event);
    } catch (error) {
      logger.error({
        msg: "Failed to process Deposit event",
        txHash: event.transactionHash,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * 处理 Withdraw 日志
   */
  private async processWithdrawLog(log: Log<bigint, number, typeof VAULT_EVENTS[1]>): Promise<void> {
    if (!log.args || log.blockNumber === undefined) {
      return;
    }

    const event: WithdrawEvent = {
      user: log.args.user,
      amount: log.args.amount,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex
    };

    try {
      await this.eventHandler.handleWithdraw(event);
    } catch (error) {
      logger.error({
        msg: "Failed to process Withdraw event",
        txHash: event.transactionHash,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Write vault indexer**

#### Step 2: 创建 Indexer 入口

**File:** `apps/api/src/indexer/index.ts`

```typescript
// apps/api/src/indexer/index.ts
/**
 * Indexer 入口
 * 可独立运行的事件监听服务
 */
import { VaultIndexer } from "./vault-indexer";
import { logger } from "../utils/logger";

export { VaultIndexer } from "./vault-indexer";
export { EventHandler } from "./event-handler";
export { BlockCursorManager } from "./block-cursor";

export function startIndexer(): VaultIndexer {
  const indexer = new VaultIndexer();

  // 优雅关闭
  process.on("SIGINT", () => {
    logger.info({ msg: "Received SIGINT, shutting down indexer..." });
    indexer.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info({ msg: "Received SIGTERM, shutting down indexer..." });
    indexer.stop();
    process.exit(0);
  });

  // 启动
  indexer.start().catch((error) => {
    logger.error({
      msg: "Indexer failed to start",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    process.exit(1);
  });

  return indexer;
}

// 如果直接运行此文件
if (require.main === module) {
  startIndexer();
}
```

- [ ] **Write indexer entry point**

#### Step 3: 集成到主应用（可选）

**File:** `apps/api/src/index.ts` (修改)

```typescript
// apps/api/src/index.ts
// 在现有代码末尾添加：

// 启动 Indexer（如果配置为在主进程中运行）
if (config.server.nodeEnv !== "test") {
  const { startIndexer } = await import("./indexer");
  startIndexer();
}
```

- [ ] **Integrate indexer into main app (optional)**

#### Step 4: 提交 Indexer

```bash
git add apps/api/src/indexer/
git commit -m "feat(api): add Vault indexer for Deposit/Withdraw events"
```

- [ ] **Commit vault indexer**

---

## Chunk 4: Indexer 单元测试

### Task 4: Indexer Tests

**Files:**
- Create: `apps/api/src/indexer/__tests__/event-handler.test.ts`

#### Step 1: 编写事件处理器测试

**File:** `apps/api/src/indexer/__tests__/event-handler.test.ts`

```typescript
// apps/api/src/indexer/__tests__/event-handler.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../db/client";
import { EventHandler, type DepositEvent, type WithdrawEvent } from "../event-handler";

describe("EventHandler", () => {
  const handler = new EventHandler();

  const mockDepositEvent: DepositEvent = {
    user: "0x1234567890123456789012345678901234567890",
    amount: BigInt("1000000"), // 1 USDC
    blockNumber: BigInt("12345"),
    transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    logIndex: 0
  };

  const mockWithdrawEvent: WithdrawEvent = {
    user: "0x1234567890123456789012345678901234567890",
    amount: BigInt("500000"), // 0.5 USDC
    blockNumber: BigInt("12346"),
    transactionHash: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
    logIndex: 0
  };

  beforeEach(async () => {
    // 清理测试数据
    await prisma.transaction.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("handleDeposit", () => {
    it("should create user and account on first deposit", async () => {
      await handler.handleDeposit(mockDepositEvent);

      const user = await prisma.user.findUnique({
        where: { walletAddress: mockDepositEvent.user.toLowerCase() }
      });

      expect(user).not.toBeNull();

      const account = await prisma.account.findUnique({
        where: {
          userId_asset: { userId: user!.id, asset: "USDC" }
        }
      });

      expect(account).not.toBeNull();
      expect(account!.availableBalance.toString()).toBe("1000000");
    });

    it("should be idempotent - same event processed only once", async () => {
      await handler.handleDeposit(mockDepositEvent);
      await handler.handleDeposit(mockDepositEvent); // 第二次

      const transactions = await prisma.transaction.findMany();
      expect(transactions.length).toBe(1);
    });

    it("should accumulate balance on multiple deposits", async () => {
      await handler.handleDeposit(mockDepositEvent);

      const event2: DepositEvent = {
        ...mockDepositEvent,
        amount: BigInt("2000000"),
        transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        logIndex: 1
      };
      await handler.handleDeposit(event2);

      const user = await prisma.user.findUnique({
        where: { walletAddress: mockDepositEvent.user.toLowerCase() },
        include: { accounts: true }
      });

      expect(user!.accounts[0].availableBalance.toString()).toBe("3000000");
    });
  });

  describe("handleWithdraw", () => {
    it("should handle withdraw event", async () => {
      // 先存入
      await handler.handleDeposit(mockDepositEvent);

      // 再提取
      await handler.handleWithdraw(mockWithdrawEvent);

      const user = await prisma.user.findUnique({
        where: { walletAddress: mockDepositEvent.user.toLowerCase() },
        include: { accounts: true }
      });

      // 余额应该减少
      expect(user!.accounts[0].availableBalance.toString()).toBe("500000");
    });

    it("should be idempotent for withdraw", async () => {
      await handler.handleDeposit(mockDepositEvent);
      await handler.handleWithdraw(mockWithdrawEvent);
      await handler.handleWithdraw(mockWithdrawEvent); // 重复

      const transactions = await prisma.transaction.findMany({
        where: { type: "WITHDRAW" }
      });

      // 只应该有一条 WITHDRAW 记录
      const confirmedWithdraws = transactions.filter(t => t.status === "CONFIRMED");
      expect(confirmedWithdraws.length).toBe(1);
    });
  });
});
```

- [ ] **Write event handler tests**

#### Step 2: 运行测试

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/apps/api && pnpm test indexer/__tests__/event-handler.test.ts`

- [ ] **Run indexer tests**

#### Step 3: 提交测试

```bash
git add apps/api/src/indexer/__tests__/
git commit -m "test(api): add indexer event handler tests"
```

- [ ] **Commit indexer tests**

---

## Acceptance Criteria

- [ ] Indexer 能正确监听 Vault 合约事件
- [ ] Deposit 事件正确增加用户余额
- [ ] Withdraw 事件正确释放锁定余额
- [ ] 幂等处理：同一事件不会重复处理
- [ ] 区块游标正确推进，支持断点续传
- [ ] 所有测试通过

## Notes

- Indexer 可独立部署为单独进程
- 轮询间隔默认 2 秒，可通过环境变量配置
- 事件处理失败会记录错误日志，但不阻塞后续事件
- 生产环境建议使用 WebSocket 订阅而非轮询
