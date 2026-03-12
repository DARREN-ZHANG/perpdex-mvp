# Sprint 2 泳道 B: 账户接口与 Trade Engine 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现账户余额接口、提现校验和 Trade Engine（下单/平仓核心逻辑）

**Architecture:** REST API 路由 → Service 层 → Trade Engine。Trade Engine 是交易核心，负责订单执行、仓位管理、保证金锁定。

**Tech Stack:** TypeScript, Fastify, Prisma, Decimal.js, viem

**Dependencies:**
- T11 Prisma (✅)
- T12 鉴权 (✅)
- T13 日志/错误处理 (✅)
- T41 PnL Calculator (泳道 A)
- T22 Vault 合约 (✅)

**Deliverables:**
- `routes/user.ts` - 账户路由（余额、历史）
- `services/balance.service.ts` - 余额服务
- `services/withdraw.service.ts` - 提现服务
- `engines/trade-engine.ts` - 交易引擎
- `routes/trade.ts` - 交易路由

---

## File Structure

```
apps/api/src/
├── routes/
│   ├── user.ts               # 账户路由
│   └── trade.ts              # 交易路由
├── services/
│   ├── balance.service.ts    # 余额查询
│   └── withdraw.service.ts   # 提现服务
├── engines/
│   └── trade-engine.ts       # 交易引擎
├── clients/
│   └── blockchain.ts         # viem client
└── middleware/
    └── auth.ts               # 已存在
```

---

## Chunk 1: 账户余额接口 (T30)

### Task 1: Balance Service

**Files:**
- Create: `apps/api/src/services/balance.service.ts`
- Create: `apps/api/src/routes/user.ts`
- Modify: `apps/api/src/routes/index.ts`

#### Step 1: 创建 Balance Service

**File:** `apps/api/src/services/balance.service.ts`

```typescript
// apps/api/src/services/balance.service.ts
/**
 * 余额服务
 * 处理账户余额查询和历史记录
 */
import { prisma } from "../db/client";
import { logger } from "../utils/logger";

export interface BalanceResult {
  userId: string;
  asset: "USDC";
  availableBalance: string;
  lockedBalance: string;
  equity: string;
  updatedAt: string;
}

export interface TransactionHistoryItem {
  id: string;
  type: string;
  amount: string;
  status: string;
  txHash: string | null;
  createdAt: string;
}

export interface HistoryQuery {
  cursor?: string;
  limit?: number;
  type?: string;
}

export class BalanceService {
  async getBalance(userId: string): Promise<BalanceResult | null> {
    const account = await prisma.account.findUnique({
      where: {
        userId_asset: {
          userId,
          asset: "USDC"
        }
      }
    });

    if (!account) {
      return null;
    }

    // 计算权益 = 可用 + 锁定
    const equity = account.availableBalance + account.lockedBalance;

    return {
      userId: account.userId,
      asset: "USDC",
      availableBalance: account.availableBalance.toString(),
      lockedBalance: account.lockedBalance.toString(),
      equity: equity.toString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }

  async getTransactionHistory(
    userId: string,
    query: HistoryQuery
  ): Promise<{ items: TransactionHistoryItem[]; nextCursor?: string }> {
    const limit = Math.min(query.limit ?? 20, 100);

    const where: {
      userId: string;
      type?: { in: string[] };
      id?: { lt: string };
    } = { userId };

    if (query.type) {
      where.type = { in: [query.type] };
    }

    if (query.cursor) {
      where.id = { lt: query.cursor };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1
    });

    const items = transactions.slice(0, limit).map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      status: tx.status,
      txHash: tx.txHash,
      createdAt: tx.createdAt.toISOString()
    }));

    const nextCursor =
      transactions.length > limit ? transactions[limit - 1].id : undefined;

    return { items, nextCursor };
  }

  async getPositions(userId: string) {
    const positions = await prisma.position.findMany({
      where: {
        userId,
        status: "OPEN"
      },
      orderBy: { createdAt: "desc" }
    });

    return positions.map((p) => ({
      id: p.id,
      userId: p.userId,
      symbol: p.symbol,
      side: p.side,
      positionSize: p.positionSize.toString(),
      entryPrice: p.entryPrice.toString(),
      markPrice: p.markPrice.toString(),
      unrealizedPnl: p.unrealizedPnl.toString(),
      liquidationPrice: p.liquidationPrice.toString(),
      margin: p.margin.toString(),
      status: p.status,
      riskLevel: p.riskLevel,
      openedAt: p.openedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString()
    }));
  }
}
```

- [ ] **Write balance service**

#### Step 2: 创建 User Routes

**File:** `apps/api/src/routes/user.ts`

```typescript
// apps/api/src/routes/user.ts
/**
 * 用户路由
 * 处理余额查询、历史记录、提现
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireAuth, type JwtUser } from "../middleware/auth";
import { BalanceService } from "../services/balance.service";
import { WithdrawService } from "../services/withdraw.service";

function getJwtUser(request: FastifyRequest): JwtUser {
  return request.user as JwtUser;
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const balanceService = new BalanceService();
  const withdrawService = new WithdrawService();

  // GET /api/user/balance
  app.get(
    "/api/user/balance",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const balance = await balanceService.getBalance(user.id);

      if (!balance) {
        return {
          data: {
            userId: user.id,
            asset: "USDC",
            availableBalance: "0",
            lockedBalance: "0",
            equity: "0",
            updatedAt: new Date().toISOString()
          },
          error: null,
          meta: { requestId: request.id }
        };
      }

      return {
        data: balance,
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // GET /api/user/positions
  app.get(
    "/api/user/positions",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const positions = await balanceService.getPositions(user.id);

      return {
        data: { items: positions },
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // GET /api/user/history
  app.get(
    "/api/user/history",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const query = request.query as {
        cursor?: string;
        limit?: number;
        type?: string;
      };

      const result = await balanceService.getTransactionHistory(user.id, query);

      return {
        data: result,
        error: null,
        meta: {
          requestId: request.id,
          nextCursor: result.nextCursor
        }
      };
    }
  );

  // POST /api/user/withdraw
  app.post(
    "/api/user/withdraw",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const body = request.body as { amount: string };

      const result = await withdrawService.requestWithdrawal(
        user.id,
        user.walletAddress,
        BigInt(body.amount)
      );

      return {
        data: result,
        error: null,
        meta: { requestId: request.id }
      };
    }
  );
}
```

- [ ] **Write user routes**

#### Step 3: 注册路由

**File:** `apps/api/src/routes/index.ts`

```typescript
// apps/api/src/routes/index.ts
/**
 * 路由注册入口
 */
import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { healthRoutes } from "./health";
import { userRoutes } from "./user";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(healthRoutes);
  await app.register(userRoutes);
}
```

- [ ] **Update routes index**

#### Step 4: 添加 requireAuth 中间件

**File:** `apps/api/src/middleware/auth.ts` (修改)

```typescript
// apps/api/src/middleware/auth.ts
/**
 * 鉴权中间件
 */
import type { FastifyInstance, FastifyRequest } from "fastify";

export interface JwtUser {
  id: string;
  walletAddress: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtUser;
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _reply: unknown
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<{ userId: string; walletAddress: string }>();
    request.user = {
      id: decoded.userId,
      walletAddress: decoded.walletAddress
    };
  } catch {
    // Optional auth, ignore errors
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: unknown
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<{ userId: string; walletAddress: string }>();
    request.user = {
      id: decoded.userId,
      walletAddress: decoded.walletAddress
    };
  } catch (error) {
    const replyObj = reply as { status: (code: number) => { send: (body: unknown) => void } };
    replyObj.status(401).send({
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required"
      }
    });
  }
}
```

- [ ] **Update auth middleware with requireAuth**

#### Step 5: 提交账户接口

```bash
git add apps/api/src/services/balance.service.ts apps/api/src/routes/user.ts apps/api/src/routes/index.ts apps/api/src/middleware/auth.ts
git commit -m "feat(api): add balance and position API endpoints"
```

- [ ] **Commit balance service**

---

## Chunk 2: 提现服务 (T33)

### Task 2: Withdraw Service

**Files:**
- Create: `apps/api/src/services/withdraw.service.ts`
- Create: `apps/api/src/clients/blockchain.ts`

#### Step 1: 创建 Blockchain Client

**File:** `apps/api/src/clients/blockchain.ts`

```typescript
// apps/api/src/clients/blockchain.ts
/**
 * 区块链客户端
 * 封装 viem 与合约交互
 */
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { config } from "../config/index";
import { logger } from "../utils/logger";

// Vault ABI (仅包含需要的方法)
const VAULT_ABI = [
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

export class BlockchainClient {
  private publicClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient> | null = null;
  private vaultAddress: Address;

  constructor() {
    this.vaultAddress = config.external.vaultContractAddress as Address;

    this.publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(config.external.rpcUrl)
    });

    // Initialize wallet client if private key is available
    const privateKey = process.env.HEDGE_PRIVATE_KEY;
    if (privateKey) {
      this.walletClient = createWalletClient({
        chain: arbitrumSepolia,
        transport: http(config.external.rpcUrl),
        account: privateKey as Address
      });
    }
  }

  async getVaultBalance(userAddress: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.vaultAddress,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [userAddress]
    }) as Promise<bigint>;
  }

  async executeWithdraw(userAddress: Address, amount: bigint): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized. Set HEDGE_PRIVATE_KEY");
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.vaultAddress,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [userAddress, amount],
      account: this.walletClient.account
    });

    const hash = await this.walletClient.writeContract(request);

    logger.info({
      msg: "Withdraw transaction submitted",
      userAddress,
      amount: amount.toString(),
      txHash: hash
    });

    return hash;
  }

  async waitForTransaction(txHash: string): Promise<"success" | "reverted"> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash as Address
    });

    return receipt.status === "success" ? "success" : "reverted";
  }
}

export const blockchainClient = new BlockchainClient();
```

- [ ] **Write blockchain client**

#### Step 2: 创建 Withdraw Service

**File:** `apps/api/src/services/withdraw.service.ts`

```typescript
// apps/api/src/services/withdraw.service.ts
/**
 * 提现服务
 * 处理提现请求校验和链上执行
 */
import { prisma } from "../db/client";
import { blockchainClient } from "../clients/blockchain";
import { logger } from "../utils/logger";

export interface WithdrawResult {
  transactionId: string;
  txHash?: string;
  status: string;
}

export class WithdrawService {
  async requestWithdrawal(
    userId: string,
    walletAddress: string,
    amount: bigint
  ): Promise<WithdrawResult> {
    // 1. 校验金额
    if (amount <= 0n) {
      throw new Error("Withdrawal amount must be positive");
    }

    // 2. 获取账户余额
    const account = await prisma.account.findUnique({
      where: {
        userId_asset: {
          userId,
          asset: "USDC"
        }
      }
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // 3. 检查可用余额
    if (account.availableBalance < amount) {
      throw new Error("Insufficient available balance");
    }

    // 4. 预扣余额（事务）
    const transaction = await prisma.$transaction(async (tx) => {
      // 锁定余额
      await tx.account.update({
        where: { id: account.id },
        data: {
          availableBalance: { decrement: amount },
          lockedBalance: { increment: amount }
        }
      });

      // 创建提现交易记录
      return tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: "WITHDRAW",
          amount,
          status: "PENDING"
        }
      });
    });

    logger.info({
      msg: "Withdrawal request created",
      userId,
      transactionId: transaction.id,
      amount: amount.toString()
    });

    // 5. 异步执行链上提现（不阻塞响应）
    this.executeOnchainWithdraw(
      transaction.id,
      walletAddress,
      amount
    ).catch((error) => {
      logger.error({
        msg: "Onchain withdraw failed",
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    });

    return {
      transactionId: transaction.id,
      status: "PENDING"
    };
  }

  private async executeOnchainWithdraw(
    transactionId: string,
    walletAddress: string,
    amount: bigint
  ): Promise<void> {
    try {
      // 执行链上提现
      const txHash = await blockchainClient.executeWithdraw(
        walletAddress as `0x${string}`,
        amount
      );

      // 更新交易状态
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          txHash,
          status: "PENDING" // 等待 Indexer 确认
        }
      });

      // 等待交易确认
      const result = await blockchainClient.waitForTransaction(txHash);

      if (result === "reverted") {
        await this.handleWithdrawalFailure(transactionId, "Transaction reverted");
      }
    } catch (error) {
      await this.handleWithdrawalFailure(
        transactionId,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async handleWithdrawalFailure(
    transactionId: string,
    errorMessage: string
  ): Promise<void> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { account: true }
    });

    if (!transaction || !transaction.account) {
      return;
    }

    // 回滚余额
    await prisma.$transaction([
      prisma.account.update({
        where: { id: transaction.account.id },
        data: {
          availableBalance: { increment: transaction.amount },
          lockedBalance: { decrement: transaction.amount }
        }
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "FAILED",
          metadata: { error: errorMessage }
        }
      })
    ]);

    logger.error({
      msg: "Withdrawal failed, balance rolled back",
      transactionId,
      error: errorMessage
    });
  }
}
```

- [ ] **Write withdraw service**

#### Step 3: 安装 viem 依赖

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/apps/api && pnpm add viem`

- [ ] **Install viem dependency**

#### Step 4: 提交提现服务

```bash
git add apps/api/src/services/withdraw.service.ts apps/api/src/clients/blockchain.ts
git commit -m "feat(api): add withdraw service with onchain execution"
```

- [ ] **Commit withdraw service**

---

## Chunk 3: Trade Engine (T40)

### Task 3: Trade Engine Core

**Files:**
- Create: `apps/api/src/engines/trade-engine.ts`
- Create: `apps/api/src/routes/trade.ts`
- Create: `apps/api/src/services/market.service.ts`

**前置条件:** PnL Calculator (T41) 已完成

#### Step 1: 创建 Market Service（价格服务）

**File:** `apps/api/src/services/market.service.ts`

```typescript
// apps/api/src/services/market.service.ts
/**
 * 市场服务
 * 获取实时价格数据
 */
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../utils/logger";

// MVP: Mock 价格服务，后续接入 Hyperliquid
export class MarketService {
  private prices: Map<string, Decimal> = new Map();

  constructor() {
    // 初始化 mock 价格
    this.prices.set("BTC", new Decimal("50000"));
  }

  async getMarkPrice(symbol: string): Promise<Decimal> {
    // TODO: 从 Hyperliquid API 获取实时价格
    const price = this.prices.get(symbol);
    if (!price) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }
    return price;
  }

  // 供测试使用
  setMarkPrice(symbol: string, price: Decimal): void {
    this.prices.set(symbol, price);
    logger.info({ msg: "Mark price updated", symbol, price: price.toString() });
  }
}

export const marketService = new MarketService();
```

- [ ] **Write market service**

#### Step 2: 创建 Trade Engine

**File:** `apps/api/src/engines/trade-engine.ts`

```typescript
// apps/api/src/engines/trade-engine.ts
/**
 * 交易引擎
 * 核心交易逻辑：下单、平仓、保证金管理
 */
import { prisma } from "../db/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../utils/logger";
import { marketService } from "../services/market.service";
import {
  calculatePositionMetrics,
  calculateLiquidationPrice,
  type PositionInput,
  type MarkPriceInput
} from "./pnl-calculator";

export interface CreateOrderInput {
  userId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  size: Decimal;
  margin: bigint;
  leverage: number;
  clientOrderId?: string;
}

export interface CreateOrderResult {
  order: {
    id: string;
    status: string;
    executedPrice: string;
  };
  position?: {
    id: string;
    status: string;
  };
  hedgeTaskId?: string;
}

export interface ClosePositionResult {
  order: {
    id: string;
    realizedPnl: string;
  };
  position: {
    id: string;
    status: string;
  };
  hedgeTaskId?: string;
}

export class TradeEngine {
  /**
   * 创建市价订单
   */
  async createMarketOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { userId, symbol, side, size, margin, leverage, clientOrderId } = input;

    // 1. 获取当前价格
    const markPrice = await marketService.getMarkPrice(symbol);

    // 2. 验证用户余额
    const account = await prisma.account.findUnique({
      where: {
        userId_asset: { userId, asset: "USDC" }
      }
    });

    if (!account || account.availableBalance < margin) {
      throw new Error("Insufficient balance");
    }

    // 3. 检查是否已有同方向仓位（单仓模式）
    const existingPosition = await prisma.position.findFirst({
      where: {
        userId,
        symbol: symbol as "BTC",
        status: "OPEN"
      }
    });

    if (existingPosition) {
      throw new Error("Position already exists for this symbol");
    }

    // 4. 计算清算价格
    const positionInput: PositionInput = {
      side,
      positionSize: size,
      entryPrice: markPrice,
      margin: new Decimal(margin.toString()),
      leverage
    };

    const liquidationResult = calculateLiquidationPrice(positionInput);

    // 5. 事务：锁定保证金、创建订单、创建仓位
    const result = await prisma.$transaction(async (tx) => {
      // 锁定保证金
      await tx.account.update({
        where: { id: account.id },
        data: {
          availableBalance: { decrement: margin },
          lockedBalance: { increment: margin }
        }
      });

      // 创建保证金锁定交易记录
      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: "MARGIN_LOCK",
          amount: margin,
          status: "CONFIRMED"
        }
      });

      // 创建订单
      const order = await tx.order.create({
        data: {
          userId,
          symbol: symbol as "BTC",
          side,
          type: "MARKET",
          size,
          margin,
          leverage,
          executedPrice: markPrice,
          status: "FILLED",
          filledAt: new Date(),
          clientOrderId
        }
      });

      // 创建仓位
      const position = await tx.position.create({
        data: {
          userId,
          symbol: symbol as "BTC",
          side,
          positionSize: size,
          entryPrice: markPrice,
          markPrice,
          unrealizedPnl: new Decimal(0),
          liquidationPrice: liquidationResult.liquidationPrice,
          margin,
          status: "OPEN",
          riskLevel: "SAFE"
        }
      });

      // 关联订单和仓位
      await tx.order.update({
        where: { id: order.id },
        data: { positionId: position.id }
      });

      return { order, position };
    });

    logger.info({
      msg: "Market order created",
      userId,
      orderId: result.order.id,
      positionId: result.position.id,
      symbol,
      side,
      size: size.toString(),
      executedPrice: markPrice.toString()
    });

    // 6. 创建对冲任务（异步）
    // TODO: 调用 BullMQ 添加对冲任务
    const hedgeTaskId = undefined; // await queueService.addHedgeTask(...)

    return {
      order: {
        id: result.order.id,
        status: "FILLED",
        executedPrice: markPrice.toString()
      },
      position: {
        id: result.position.id,
        status: "OPEN"
      },
      hedgeTaskId
    };
  }

  /**
   * 平仓
   */
  async closePosition(
    userId: string,
    positionId: string
  ): Promise<ClosePositionResult> {
    // 1. 获取仓位
    const position = await prisma.position.findFirst({
      where: {
        id: positionId,
        userId,
        status: "OPEN"
      }
    });

    if (!position) {
      throw new Error("Position not found or already closed");
    }

    // 2. 获取当前价格
    const markPrice = await marketService.getMarkPrice(position.symbol);

    // 3. 计算 PnL
    const positionInput: PositionInput = {
      side: position.side,
      positionSize: new Decimal(position.positionSize),
      entryPrice: new Decimal(position.entryPrice),
      margin: new Decimal(position.margin.toString()),
      leverage: 10 // TODO: 从 position 获取
    };

    const marketInput: MarkPriceInput = { markPrice };
    const metrics = calculatePositionMetrics(positionInput, marketInput);

    const realizedPnl = metrics.unrealizedPnl;
    const marginReturn = new Decimal(position.margin.toString()).plus(realizedPnl);

    // 4. 事务：更新仓位、创建平仓订单、释放保证金
    const result = await prisma.$transaction(async (tx) => {
      // 创建平仓订单
      const order = await tx.order.create({
        data: {
          userId,
          positionId,
          symbol: position.symbol,
          side: position.side === "LONG" ? "SHORT" : "LONG", // 反向
          type: "MARKET",
          size: position.positionSize,
          margin: BigInt(0), // 平仓不需要额外保证金
          leverage: position.leverage ?? 10,
          executedPrice: markPrice,
          status: "FILLED",
          filledAt: new Date()
        }
      });

      // 更新仓位状态
      await tx.position.update({
        where: { id: positionId },
        data: {
          status: "CLOSED",
          unrealizedPnl: realizedPnl,
          markPrice,
          closedAt: new Date()
        }
      });

      // 获取账户
      const account = await tx.account.findUnique({
        where: {
          userId_asset: { userId, asset: "USDC" }
        }
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // 释放保证金 + 结算盈亏
      const balanceChange = marginReturn.toBigInt();
      await tx.account.update({
        where: { id: account.id },
        data: {
          lockedBalance: { decrement: position.margin },
          availableBalance: { increment: balanceChange }
        }
      });

      // 创建保证金释放交易记录
      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: "MARGIN_RELEASE",
          amount: position.margin,
          status: "CONFIRMED"
        }
      });

      // 如果有盈亏，创建盈亏交易记录
      if (!realizedPnl.isZero()) {
        await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: "REALIZED_PNL",
            amount: realizedPnl.abs().toBigInt(),
            status: "CONFIRMED"
          }
        });
      }

      return { order };
    });

    logger.info({
      msg: "Position closed",
      userId,
      positionId,
      orderId: result.order.id,
      realizedPnl: realizedPnl.toString(),
      markPrice: markPrice.toString()
    });

    // 5. 创建对冲任务（异步）
    const hedgeTaskId = undefined; // TODO

    return {
      order: {
        id: result.order.id,
        realizedPnl: realizedPnl.toString()
      },
      position: {
        id: positionId,
        status: "CLOSED"
      },
      hedgeTaskId
    };
  }

  /**
   * 清算仓位
   */
  async liquidatePosition(
    positionId: string,
    markPrice: Decimal
  ): Promise<void> {
    const position = await prisma.position.findUnique({
      where: { id: positionId }
    });

    if (!position || position.status !== "OPEN") {
      return;
    }

    logger.warn({
      msg: "Liquidating position",
      positionId,
      userId: position.userId,
      markPrice: markPrice.toString()
    });

    // 类似 closePosition，但标记为 LIQUIDATED
    await prisma.$transaction(async (tx) => {
      await tx.position.update({
        where: { id: positionId },
        data: {
          status: "LIQUIDATED",
          markPrice,
          closedAt: new Date()
        }
      });

      await tx.account.update({
        where: {
          userId_asset: { userId: position.userId, asset: "USDC" }
        },
        data: {
          lockedBalance: { decrement: position.margin }
          // 清算时保证金损失
        }
      });

      await tx.transaction.create({
        data: {
          userId: position.userId,
          type: "LIQUIDATION",
          amount: position.margin,
          status: "CONFIRMED"
        }
      });
    });

    // TODO: 创建清算对冲任务
  }
}

export const tradeEngine = new TradeEngine();
```

- [ ] **Write trade engine**

#### Step 3: 创建 Trade Routes

**File:** `apps/api/src/routes/trade.ts`

```typescript
// apps/api/src/routes/trade.ts
/**
 * 交易路由
 * 处理下单、平仓、保证金调整
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Decimal } from "@prisma/client/runtime/library";
import { requireAuth, type JwtUser } from "../middleware/auth";
import { tradeEngine } from "../engines/trade-engine";
import { logger } from "../utils/logger";

function getJwtUser(request: FastifyRequest): JwtUser {
  return request.user as JwtUser;
}

export async function tradeRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/trade/order - 创建订单
  app.post(
    "/api/trade/order",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const body = request.body as {
        symbol: string;
        side: "LONG" | "SHORT";
        size: string;
        margin: string;
        leverage: number;
        clientOrderId?: string;
      };

      const result = await tradeEngine.createMarketOrder({
        userId: user.id,
        symbol: body.symbol,
        side: body.side,
        size: new Decimal(body.size),
        margin: BigInt(body.margin),
        leverage: body.leverage,
        clientOrderId: body.clientOrderId
      });

      logger.info({
        msg: "Order created via API",
        userId: user.id,
        orderId: result.order.id
      });

      return {
        data: {
          order: {
            id: result.order.id,
            userId: user.id,
            positionId: result.position?.id,
            symbol: body.symbol,
            side: body.side,
            type: "MARKET",
            size: body.size,
            margin: body.margin,
            leverage: body.leverage,
            executedPrice: result.order.executedPrice,
            status: result.order.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            filledAt: new Date().toISOString()
          },
          position: result.position
            ? {
                id: result.position.id,
                userId: user.id,
                symbol: body.symbol,
                side: body.side,
                positionSize: body.size,
                entryPrice: result.order.executedPrice,
                markPrice: result.order.executedPrice,
                unrealizedPnl: "0",
                liquidationPrice: "0", // TODO
                margin: body.margin,
                status: result.position.status,
                riskLevel: "SAFE",
                openedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            : undefined,
          hedgeTaskId: result.hedgeTaskId
        },
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // DELETE /api/trade/positions/:id - 平仓
  app.delete(
    "/api/trade/positions/:id",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const params = request.params as { id: string };

      const result = await tradeEngine.closePosition(user.id, params.id);

      return {
        data: {
          order: {
            id: result.order.id,
            userId: user.id,
            positionId: result.position.id,
            status: "FILLED",
            executedPrice: "0", // TODO
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          position: null,
          hedgeTaskId: result.hedgeTaskId
        },
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // GET /api/trade/positions/:id - 获取仓位详情
  app.get(
    "/api/trade/positions/:id",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const params = request.params as { id: string };

      const position = await tradeEngine.getPosition(user.id, params.id);

      if (!position) {
        return {
          data: null,
          error: {
            code: "POSITION_NOT_FOUND",
            message: "Position not found"
          },
          meta: { requestId: request.id }
        };
      }

      return {
        data: position,
        error: null,
        meta: { requestId: request.id }
      };
    }
  );
}
```

- [ ] **Write trade routes**

#### Step 4: 注册 Trade Routes

**File:** `apps/api/src/routes/index.ts`

```typescript
// apps/api/src/routes/index.ts
import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { healthRoutes } from "./health";
import { userRoutes } from "./user";
import { tradeRoutes } from "./trade";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(healthRoutes);
  await app.register(userRoutes);
  await app.register(tradeRoutes);
}
```

- [ ] **Register trade routes**

#### Step 5: 提交 Trade Engine

```bash
git add apps/api/src/engines/trade-engine.ts apps/api/src/routes/trade.ts apps/api/src/services/market.service.ts apps/api/src/routes/index.ts
git commit -m "feat(api): add trade engine with market order execution"
```

- [ ] **Commit trade engine**

---

## Acceptance Criteria

- [ ] GET /api/user/balance 返回正确余额
- [ ] GET /api/user/history 支持分页和类型过滤
- [ ] POST /api/user/withdraw 校验余额并执行链上提现
- [ ] POST /api/trade/order 创建订单并锁定保证金
- [ ] DELETE /api/trade/positions/:id 平仓并释放保证金
- [ ] 保证金计算正确，余额变化原子性
- [ ] 所有 API 有鉴权保护

## Notes

- Trade Engine 是核心模块，需要仔细测试边界情况
- 对冲任务接口预留，等待泳道 D 完成 BullMQ 后集成
- 价格服务暂时 Mock，后续接入 Hyperliquid
