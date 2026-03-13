// apps/api/tests/__mocks__/prisma.ts
/**
 * Prisma 客户端 Mock
 * 支持事务模拟和链式调用
 */
import { vi } from "vitest";
import Decimal from "decimal.js";
import type {
  Prisma,
  Account,
  Order,
  Position,
  Transaction,
  HedgeOrder,
  User
} from "@prisma/client";

// Mock 数据存储
const mockData = {
  users: new Map<string, User>(),
  accounts: new Map<string, Account>(),
  orders: new Map<string, Order>(),
  positions: new Map<string, Position>(),
  transactions: new Map<string, Transaction>(),
  hedgeOrders: new Map<string, HedgeOrder>()
};

// 重置 mock 数据
export function resetMockData(): void {
  mockData.users.clear();
  mockData.accounts.clear();
  mockData.orders.clear();
  mockData.positions.clear();
  mockData.transactions.clear();
  mockData.hedgeOrders.clear();
}

// 事务回调函数类型
type TransactionCallback<T> = (tx: PrismaTransaction) => Promise<T>;

// Prisma Transaction Mock 接口
interface PrismaTransaction {
  user: PrismaUserDelegate;
  account: PrismaAccountDelegate;
  order: PrismaOrderDelegate;
  position: PrismaPositionDelegate;
  transaction: PrismaTransactionDelegate;
  hedgeOrder: PrismaHedgeOrderDelegate;
}

// 用户 Delegate Mock
class PrismaUserDelegate {
  findUnique = vi.fn(async (args: { where: { id?: string; walletAddress?: string } }) => {
    if (args.where.id) {
      return mockData.users.get(args.where.id) || null;
    }
    if (args.where.walletAddress) {
      return Array.from(mockData.users.values()).find(
        (u) => u.walletAddress === args.where.walletAddress
      ) || null;
    }
    return null;
  });

  findFirst = vi.fn(async () => {
    return Array.from(mockData.users.values())[0] || null;
  });

  create = vi.fn(async (args: { data: Partial<User> }) => {
    const user: User = {
      id: args.data.id || `user_${Date.now()}`,
      walletAddress: args.data.walletAddress || "",
      nonce: args.data.nonce || null,
      nonceExpiresAt: args.data.nonceExpiresAt || null,
      createdAt: args.data.createdAt || new Date(),
      updatedAt: args.data.updatedAt || new Date(),
      lastLoginAt: args.data.lastLoginAt || null
    };
    mockData.users.set(user.id, user);
    return user;
  });

  update = vi.fn(async (args: { where: { id: string }; data: Partial<User> }) => {
    const user = mockData.users.get(args.where.id);
    if (!user) {
      throw new Error(`User not found: ${args.where.id}`);
    }
    const updated = { ...user, ...args.data, updatedAt: new Date() };
    mockData.users.set(args.where.id, updated as User);
    return updated as User;
  });

  upsert = vi.fn(async (args: {
    where: { walletAddress: string };
    create: Partial<User>;
    update: Partial<User>;
  }) => {
    const existing = Array.from(mockData.users.values()).find(
      (user) => user.walletAddress === args.where.walletAddress
    );

    if (existing) {
      const updated = {
        ...existing,
        ...args.update,
        updatedAt: new Date()
      } as User;
      mockData.users.set(existing.id, updated);
      return updated;
    }

    return this.create({
      data: {
        ...args.create,
        walletAddress: args.where.walletAddress
      }
    });
  });
}

function matchesBigIntConstraint(
  value: bigint,
  condition: { gte?: bigint | number } | undefined
): boolean {
  if (!condition) {
    return true;
  }

  if (condition.gte !== undefined && value < BigInt(condition.gte)) {
    return false;
  }

  return true;
}

// 账户 Delegate Mock
class PrismaAccountDelegate {
  findUnique = vi.fn(async (args: { where: { id?: string; userId_asset?: { userId: string; asset: string } } }) => {
    if (args.where.id) {
      return mockData.accounts.get(args.where.id) || null;
    }
    if (args.where.userId_asset) {
      return Array.from(mockData.accounts.values()).find(
        (a) =>
          a.userId === args.where.userId_asset!.userId &&
          a.asset === args.where.userId_asset!.asset
      ) || null;
    }
    return null;
  });

  update = vi.fn(async (args: { where: { id?: string; userId_asset?: { userId: string; asset: string } }; data: Prisma.AccountUpdateInput }) => {
    let account: Account | undefined;

    // 支持 id 和 userId_asset 两种查询方式
    if (args.where.id) {
      account = mockData.accounts.get(args.where.id);
    } else if (args.where.userId_asset) {
      account = Array.from(mockData.accounts.values()).find(
        (a) =>
          a.userId === args.where.userId_asset!.userId &&
          a.asset === args.where.userId_asset!.asset
      );
    }

    if (!account) {
      throw new Error(`Account not found: ${JSON.stringify(args.where)}`);
    }

    // 处理 BigInt 运算
    let availableBalance = account.availableBalance;
    if (typeof args.data.availableBalance === "object") {
      const increment = args.data.availableBalance.increment !== undefined ? BigInt(args.data.availableBalance.increment) : BigInt(0);
      const decrement = args.data.availableBalance.decrement !== undefined ? BigInt(args.data.availableBalance.decrement) : BigInt(0);
      availableBalance = account.availableBalance + increment - decrement;
    } else if (typeof args.data.availableBalance === "bigint") {
      availableBalance = args.data.availableBalance;
    } else if (typeof args.data.availableBalance === "number") {
      availableBalance = BigInt(args.data.availableBalance);
    }

    let lockedBalance = account.lockedBalance;
    if (typeof args.data.lockedBalance === "object") {
      const increment = args.data.lockedBalance.increment !== undefined ? BigInt(args.data.lockedBalance.increment) : BigInt(0);
      const decrement = args.data.lockedBalance.decrement !== undefined ? BigInt(args.data.lockedBalance.decrement) : BigInt(0);
      lockedBalance = account.lockedBalance + increment - decrement;
    } else if (typeof args.data.lockedBalance === "bigint") {
      lockedBalance = args.data.lockedBalance;
    } else if (typeof args.data.lockedBalance === "number") {
      lockedBalance = BigInt(args.data.lockedBalance);
    }

    let equity = account.equity;
    if (typeof args.data.equity === "object") {
      const increment = args.data.equity.increment !== undefined ? BigInt(args.data.equity.increment) : BigInt(0);
      const decrement = args.data.equity.decrement !== undefined ? BigInt(args.data.equity.decrement) : BigInt(0);
      equity = account.equity + increment - decrement;
    } else if (typeof args.data.equity === "bigint") {
      equity = args.data.equity;
    } else if (typeof args.data.equity === "number") {
      equity = BigInt(args.data.equity);
    }

    const updated = {
      ...account,
      availableBalance,
      lockedBalance,
      equity,
      updatedAt: new Date()
    };
    mockData.accounts.set(account.id, updated as Account);
    return updated as Account;
  });

  updateMany = vi.fn(async (args: {
    where: {
      id?: string;
      userId_asset?: { userId: string; asset: string };
      availableBalance?: { gte?: bigint | number };
      lockedBalance?: { gte?: bigint | number };
    };
    data: Prisma.AccountUpdateInput;
  }) => {
    const accounts = Array.from(mockData.accounts.values()).filter((account) => {
      if (args.where.id && account.id !== args.where.id) {
        return false;
      }
      if (
        args.where.userId_asset &&
        (
          account.userId !== args.where.userId_asset.userId ||
          account.asset !== args.where.userId_asset.asset
        )
      ) {
        return false;
      }

      return (
        matchesBigIntConstraint(account.availableBalance, args.where.availableBalance) &&
        matchesBigIntConstraint(account.lockedBalance, args.where.lockedBalance)
      );
    });

    for (const account of accounts) {
      await this.update({
        where: { id: account.id },
        data: args.data
      });
    }

    return { count: accounts.length };
  });

  upsert = vi.fn(async (args: {
    where: { userId_asset: { userId: string; asset: string } };
    create: Partial<Account>;
    update: Partial<Account>;
  }) => {
    const existing = Array.from(mockData.accounts.values()).find(
      (account) =>
        account.userId === args.where.userId_asset.userId &&
        account.asset === args.where.userId_asset.asset
    );

    if (existing) {
      const updated = {
        ...existing,
        ...args.update,
        updatedAt: new Date()
      } as Account;
      mockData.accounts.set(existing.id, updated);
      return updated;
    }

    const account: Account = {
      id: args.create.id || `account_${Date.now()}`,
      userId: args.create.userId || args.where.userId_asset.userId,
      asset: (args.create.asset as Account["asset"]) || args.where.userId_asset.asset,
      availableBalance: args.create.availableBalance || 0n,
      lockedBalance: args.create.lockedBalance || 0n,
      equity: args.create.equity || 0n,
      createdAt: args.create.createdAt || new Date(),
      updatedAt: args.create.updatedAt || new Date()
    };
    mockData.accounts.set(account.id, account);
    return account;
  });
}

// 订单 Delegate Mock
class PrismaOrderDelegate {
  findFirst = vi.fn(async (args: { where?: { userId?: string; positionId?: string; symbol?: string; status?: string } }) => {
    const orders = Array.from(mockData.orders.values());
    let result = orders;

    if (args.where?.userId) {
      result = result.filter((o) => o.userId === args.where.userId);
    }
    if (args.where?.positionId) {
      result = result.filter((o) => o.positionId === args.where.positionId);
    }
    if (args.where?.symbol) {
      result = result.filter((o) => o.symbol === args.where.symbol);
    }
    if (args.where?.status) {
      result = result.filter((o) => o.status === args.where.status);
    }

    return result[0] || null;
  });

  create = vi.fn(async (args: { data: Partial<Order> }) => {
    const order: Order = {
      id: args.data.id || `order_${Date.now()}`,
      userId: args.data.userId || "",
      positionId: args.data.positionId || null,
      clientOrderId: args.data.clientOrderId || null,
      symbol: (args.data.symbol as "BTC") || "BTC",
      side: (args.data.side as "LONG" | "SHORT") || "LONG",
      type: (args.data.type as "MARKET") || "MARKET",
      size: args.data.size || new Decimal(0),
      requestedPrice: args.data.requestedPrice || null,
      executedPrice: args.data.executedPrice || null,
      margin: args.data.margin || BigInt(0),
      leverage: args.data.leverage || 10,
      status: (args.data.status as "PENDING" | "FILLED" | "FAILED" | "CANCELED") || "PENDING",
      failureCode: args.data.failureCode || null,
      failureMessage: args.data.failureMessage || null,
      metadata: args.data.metadata || null,
      createdAt: args.data.createdAt || new Date(),
      updatedAt: args.data.updatedAt || new Date(),
      filledAt: args.data.filledAt || null
    };
    mockData.orders.set(order.id, order);
    return order;
  });

  update = vi.fn(async (args: { where: { id: string }; data: Partial<Order> }) => {
    const order = mockData.orders.get(args.where.id);
    if (!order) {
      throw new Error(`Order not found: ${args.where.id}`);
    }
    const updated = { ...order, ...args.data, updatedAt: new Date() };
    mockData.orders.set(args.where.id, updated as Order);
    return updated as Order;
  });
}

// 仓位 Delegate Mock
class PrismaPositionDelegate {
  findFirst = vi.fn(async (args: { where?: { userId?: string; id?: string; symbol?: string; status?: string } }) => {
    const positions = Array.from(mockData.positions.values());
    let result = positions;

    if (args.where?.userId) {
      result = result.filter((p) => p.userId === args.where.userId);
    }
    if (args.where?.id) {
      result = result.filter((p) => p.id === args.where.id);
    }
    if (args.where?.symbol) {
      result = result.filter((p) => p.symbol === args.where.symbol);
    }
    if (args.where?.status) {
      result = result.filter((p) => p.status === args.where.status);
    }

    return result[0] || null;
  });

  findUnique = vi.fn(async (args: { where: { id: string } }) => {
    return mockData.positions.get(args.where.id) || null;
  });

  findMany = vi.fn(async (args?: {
    where?: { userId?: string; status?: string };
    select?: { margin?: boolean };
  }) => {
    let result = Array.from(mockData.positions.values());

    if (args?.where?.userId) {
      result = result.filter((position) => position.userId === args.where!.userId);
    }
    if (args?.where?.status) {
      result = result.filter((position) => position.status === args.where!.status);
    }

    if (args?.select?.margin) {
      return result.map((position) => ({ margin: position.margin }));
    }

    return result;
  });

  create = vi.fn(async (args: { data: Partial<Position> }) => {
    const position: Position = {
      id: args.data.id || `pos_${Date.now()}`,
      userId: args.data.userId || "",
      symbol: (args.data.symbol as "BTC") || "BTC",
      side: (args.data.side as "LONG" | "SHORT") || "LONG",
      positionSize: args.data.positionSize || new Decimal(0),
      entryPrice: args.data.entryPrice || new Decimal(0),
      markPrice: args.data.markPrice || new Decimal(0),
      unrealizedPnl: args.data.unrealizedPnl || new Decimal(0),
      liquidationPrice: args.data.liquidationPrice || new Decimal(0),
      margin: args.data.margin || BigInt(0),
      status: (args.data.status as "OPEN" | "CLOSED" | "LIQUIDATED") || "OPEN",
      riskLevel: (args.data.riskLevel as "SAFE" | "WARNING" | "DANGER") || "SAFE",
      metadata: args.data.metadata || null,
      openedAt: args.data.openedAt || new Date(),
      closedAt: args.data.closedAt || null,
      createdAt: args.data.createdAt || new Date(),
      updatedAt: args.data.updatedAt || new Date()
    };
    mockData.positions.set(position.id, position);
    return position;
  });

  update = vi.fn(async (args: { where: { id: string }; data: Partial<Position> }) => {
    const position = mockData.positions.get(args.where.id);
    if (!position) {
      throw new Error(`Position not found: ${args.where.id}`);
    }
    const updated = { ...position, ...args.data, updatedAt: new Date() };
    mockData.positions.set(args.where.id, updated as Position);
    return updated as Position;
  });

  updateMany = vi.fn(async (args: {
    where: { id?: string; userId?: string; status?: string };
    data: Partial<Position>;
  }) => {
    const positions = Array.from(mockData.positions.values()).filter((position) => {
      if (args.where.id && position.id !== args.where.id) {
        return false;
      }
      if (args.where.userId && position.userId !== args.where.userId) {
        return false;
      }
      if (args.where.status && position.status !== args.where.status) {
        return false;
      }

      return true;
    });

    for (const position of positions) {
      await this.update({
        where: { id: position.id },
        data: args.data
      });
    }

    return { count: positions.length };
  });
}

// 交易记录 Delegate Mock
class PrismaTransactionDelegate {
  findUnique = vi.fn(async (args: { where: { id?: string; idempotencyKey?: string } }) => {
    if (args.where.id) {
      return mockData.transactions.get(args.where.id) || null;
    }

    if (args.where.idempotencyKey) {
      return Array.from(mockData.transactions.values()).find(
        (transaction) => transaction.idempotencyKey === args.where.idempotencyKey
      ) || null;
    }

    return null;
  });

  findFirst = vi.fn(async (args?: {
    where?: {
      userId?: string;
      type?: string;
      status?: string;
      txHash?: string | null;
      amount?: bigint;
    };
    orderBy?: { createdAt: "desc" | "asc" };
  }) => {
    let result = Array.from(mockData.transactions.values());

    if (args?.where?.userId) {
      result = result.filter((tx) => tx.userId === args.where!.userId);
    }
    if (args?.where?.type) {
      result = result.filter((tx) => tx.type === args.where!.type);
    }
    if (args?.where?.status) {
      result = result.filter((tx) => tx.status === args.where!.status);
    }
    if (args?.where?.txHash !== undefined) {
      result = result.filter((tx) => tx.txHash === args.where!.txHash);
    }
    if (args?.where?.amount !== undefined) {
      result = result.filter((tx) => tx.amount === args.where!.amount);
    }

    if (args?.orderBy?.createdAt === "desc") {
      result = result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return result[0] || null;
  });

  findMany = vi.fn(async (args?: { where?: { type?: string } }) => {
    let result = Array.from(mockData.transactions.values());
    if (args?.where?.type) {
      result = result.filter((tx) => tx.type === args.where!.type);
    }
    return result;
  });

  create = vi.fn(async (args: { data: Partial<Transaction> }) => {
    const transaction: Transaction = {
      id: args.data.id || `tx_${Date.now()}`,
      userId: args.data.userId || "",
      accountId: args.data.accountId || null,
      type: (args.data.type as "DEPOSIT" | "WITHDRAW" | "MARGIN_LOCK" | "MARGIN_RELEASE" | "REALIZED_PNL" | "FEE" | "LIQUIDATION") || "DEPOSIT",
      eventName: args.data.eventName || null,
      txHash: args.data.txHash || null,
      logIndex: args.data.logIndex || null,
      blockNumber: args.data.blockNumber || null,
      amount: args.data.amount || BigInt(0),
      status: (args.data.status as "PENDING" | "CONFIRMED" | "FAILED" | "REVERTED") || "PENDING",
      idempotencyKey: args.data.idempotencyKey || null,
      metadata: args.data.metadata || null,
      createdAt: args.data.createdAt || new Date(),
      updatedAt: args.data.updatedAt || new Date(),
      confirmedAt: args.data.confirmedAt || null
    };
    mockData.transactions.set(transaction.id, transaction);
    return transaction;
  });

  update = vi.fn(async (args: { where: { id: string }; data: Partial<Transaction> }) => {
    const transaction = mockData.transactions.get(args.where.id);
    if (!transaction) {
      throw new Error(`Transaction not found: ${args.where.id}`);
    }

    const updated = {
      ...transaction,
      ...args.data,
      updatedAt: new Date()
    } as Transaction;

    mockData.transactions.set(args.where.id, updated);
    return updated;
  });
}

// 对冲订单 Delegate Mock
class PrismaHedgeOrderDelegate {
  findUnique = vi.fn(async (args: { where: { taskId: string } }) => {
    return mockData.hedgeOrders.get(args.where.taskId) || null;
  });

  findMany = vi.fn(async (args?: {
    where?: { userId?: string; status?: string; priority?: number };
    orderBy?: { createdAt: "desc" | "asc" };
    take?: number;
  }) => {
    let result = Array.from(mockData.hedgeOrders.values());

    if (args?.where?.userId) {
      result = result.filter((item) => item.userId === args.where!.userId);
    }
    if (args?.where?.status) {
      result = result.filter((item) => item.status === args.where!.status);
    }
    if (args?.where?.priority !== undefined) {
      result = result.filter((item) => item.priority === args.where!.priority);
    }
    if (args?.orderBy?.createdAt === "desc") {
      result = result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (args?.take !== undefined) {
      result = result.slice(0, args.take);
    }

    return result;
  });

  create = vi.fn(async (args: { data: Partial<HedgeOrder> }) => {
    const hedgeOrder: HedgeOrder = {
      id: args.data.id || `hedge_${Date.now()}`,
      taskId: args.data.taskId || "",
      userId: args.data.userId || "",
      orderId: args.data.orderId || null,
      positionId: args.data.positionId || null,
      externalOrderId: args.data.externalOrderId || null,
      symbol: (args.data.symbol as "BTC") || "BTC",
      side: (args.data.side as "LONG" | "SHORT") || "LONG",
      size: args.data.size || new Decimal(0),
      referencePrice: args.data.referencePrice || null,
      trigger: (args.data.trigger as "OPEN" | "CLOSE" | "MARGIN_ADJUST" | "LIQUIDATION" | "MANUAL") || "OPEN",
      priority: args.data.priority || 5,
      status: (
        args.data.status as
          | "PENDING"
          | "PROCESSING"
          | "SUBMITTED"
          | "FILLED"
          | "FAILED"
          | "SUBMIT_UNKNOWN"
      ) || "PENDING",
      retryCount: args.data.retryCount || 0,
      maxRetryCount: args.data.maxRetryCount || 3,
      errorMessage: args.data.errorMessage || null,
      payload: args.data.payload || {},
      createdAt: args.data.createdAt || new Date(),
      updatedAt: args.data.updatedAt || new Date(),
      submittedAt: args.data.submittedAt || null,
      filledAt: args.data.filledAt || null,
      failedAt: args.data.failedAt || null
    };
    mockData.hedgeOrders.set(hedgeOrder.taskId, hedgeOrder);
    return hedgeOrder;
  });

  update = vi.fn(async (args: { where: { taskId: string }; data: Partial<HedgeOrder> }) => {
    const hedgeOrder = mockData.hedgeOrders.get(args.where.taskId);
    if (!hedgeOrder) {
      throw new Error(`Hedge order not found: ${args.where.taskId}`);
    }

    const updated = { ...hedgeOrder, ...args.data, updatedAt: new Date() };
    mockData.hedgeOrders.set(args.where.taskId, updated as HedgeOrder);
    return updated as HedgeOrder;
  });
}

// 创建 Transaction 实例
function createTransaction(): PrismaTransaction {
  return {
    user: new PrismaUserDelegate(),
    account: new PrismaAccountDelegate(),
    order: new PrismaOrderDelegate(),
    position: new PrismaPositionDelegate(),
    transaction: new PrismaTransactionDelegate(),
    hedgeOrder: new PrismaHedgeOrderDelegate()
  };
}

// Prisma 客户端 Mock
export const mockPrismaClient = {
  // 事务支持
  $transaction: vi.fn(async <T>(
    input: TransactionCallback<T> | Promise<unknown>[]
  ): Promise<T | unknown[]> => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }

    const tx = createTransaction();
    return input(tx);
  }),

  // 用户操作
  user: {
    findUnique: vi.fn(async (args: { where: { id?: string; walletAddress?: string } }) => {
      if (args.where.id) {
        return mockData.users.get(args.where.id) || null;
      }
      if (args.where.walletAddress) {
        return Array.from(mockData.users.values()).find(
          (u) => u.walletAddress === args.where.walletAddress
        ) || null;
      }
      return null;
    }),
    findFirst: vi.fn(async () => {
      return Array.from(mockData.users.values())[0] || null;
    }),
    create: vi.fn(async (args: { data: Partial<User> }) => {
      const user: User = {
        id: args.data.id || `user_${Date.now()}`,
        walletAddress: args.data.walletAddress || "",
        nonce: args.data.nonce || null,
        nonceExpiresAt: args.data.nonceExpiresAt || null,
        createdAt: args.data.createdAt || new Date(),
        updatedAt: args.data.updatedAt || new Date(),
        lastLoginAt: args.data.lastLoginAt || null
      };
      mockData.users.set(user.id, user);
      return user;
    }),
    update: vi.fn(async (args: { where: { id: string }; data: Partial<User> }) => {
      const delegate = new PrismaUserDelegate();
      return delegate.update(args);
    }),
    upsert: vi.fn(async (args: {
      where: { walletAddress: string };
      create: Partial<User>;
      update: Partial<User>;
    }) => {
      const delegate = new PrismaUserDelegate();
      return delegate.upsert(args);
    })
  },

  // 账户操作
  account: {
    findUnique: vi.fn(async (args: { where: { id?: string; userId_asset?: { userId: string; asset: string } } }) => {
      if (args.where.id) {
        return mockData.accounts.get(args.where.id) || null;
      }
      if (args.where.userId_asset) {
        return Array.from(mockData.accounts.values()).find(
          (a) =>
            a.userId === args.where.userId_asset!.userId &&
            a.asset === args.where.userId_asset!.asset
        ) || null;
      }
      return null;
    }),
    update: vi.fn(async (args: { where: { id?: string; userId_asset?: { userId: string; asset: string } }; data: Prisma.AccountUpdateInput }) => {
      let account: Account | undefined;

      // 支持 id 和 userId_asset 两种查询方式
      if (args.where.id) {
        account = mockData.accounts.get(args.where.id);
      } else if (args.where.userId_asset) {
        account = Array.from(mockData.accounts.values()).find(
          (a) =>
            a.userId === args.where.userId_asset!.userId &&
            a.asset === args.where.userId_asset!.asset
        );
      }

      if (!account) {
        throw new Error(`Account not found: ${JSON.stringify(args.where)}`);
      }

      // 处理 BigInt 运算
      let availableBalance = account.availableBalance;
      if (typeof args.data.availableBalance === "object") {
        const increment = args.data.availableBalance.increment !== undefined ? BigInt(args.data.availableBalance.increment) : BigInt(0);
        const decrement = args.data.availableBalance.decrement !== undefined ? BigInt(args.data.availableBalance.decrement) : BigInt(0);
        availableBalance = account.availableBalance + increment - decrement;
      } else if (typeof args.data.availableBalance === "bigint") {
        availableBalance = args.data.availableBalance;
      } else if (typeof args.data.availableBalance === "number") {
        availableBalance = BigInt(args.data.availableBalance);
      }

      let lockedBalance = account.lockedBalance;
      if (typeof args.data.lockedBalance === "object") {
        const increment = args.data.lockedBalance.increment !== undefined ? BigInt(args.data.lockedBalance.increment) : BigInt(0);
        const decrement = args.data.lockedBalance.decrement !== undefined ? BigInt(args.data.lockedBalance.decrement) : BigInt(0);
        lockedBalance = account.lockedBalance + increment - decrement;
      } else if (typeof args.data.lockedBalance === "bigint") {
        lockedBalance = args.data.lockedBalance;
      } else if (typeof args.data.lockedBalance === "number") {
        lockedBalance = BigInt(args.data.lockedBalance);
      }

      let equity = account.equity;
      if (typeof args.data.equity === "object") {
        const increment = args.data.equity.increment !== undefined ? BigInt(args.data.equity.increment) : BigInt(0);
        const decrement = args.data.equity.decrement !== undefined ? BigInt(args.data.equity.decrement) : BigInt(0);
        equity = account.equity + increment - decrement;
      } else if (typeof args.data.equity === "bigint") {
        equity = args.data.equity;
      } else if (typeof args.data.equity === "number") {
        equity = BigInt(args.data.equity);
      }

      const updated = {
        ...account,
        availableBalance,
        lockedBalance,
        equity,
        updatedAt: new Date()
      };
      mockData.accounts.set(account.id, updated as Account);
      return updated as Account;
    }),
    updateMany: vi.fn(async (args: {
      where: {
        id?: string;
        userId_asset?: { userId: string; asset: string };
        availableBalance?: { gte?: bigint | number };
        lockedBalance?: { gte?: bigint | number };
      };
      data: Prisma.AccountUpdateInput;
    }) => {
      const delegate = new PrismaAccountDelegate();
      return delegate.updateMany(args);
    }),
    upsert: vi.fn(async (args: {
      where: { userId_asset: { userId: string; asset: string } };
      create: Partial<Account>;
      update: Partial<Account>;
    }) => {
      const delegate = new PrismaAccountDelegate();
      return delegate.upsert(args);
    })
  },

  // 订单操作
  order: {
    findFirst: vi.fn(async (args: { where?: { userId?: string; positionId?: string; symbol?: string; status?: string } }) => {
      const orders = Array.from(mockData.orders.values());
      let result = orders;

      if (args.where?.userId) {
        result = result.filter((o) => o.userId === args.where.userId);
      }
      if (args.where?.positionId) {
        result = result.filter((o) => o.positionId === args.where.positionId);
      }
      if (args.where?.symbol) {
        result = result.filter((o) => o.symbol === args.where.symbol);
      }
      if (args.where?.status) {
        result = result.filter((o) => o.status === args.where.status);
      }

      return result[0] || null;
    }),
    create: vi.fn(async (args: { data: Partial<Order> }) => {
      const order: Order = {
        id: args.data.id || `order_${Date.now()}`,
        userId: args.data.userId || "",
        positionId: args.data.positionId || null,
        clientOrderId: args.data.clientOrderId || null,
        symbol: (args.data.symbol as "BTC") || "BTC",
        side: (args.data.side as "LONG" | "SHORT") || "LONG",
        type: (args.data.type as "MARKET") || "MARKET",
        size: args.data.size || new Decimal(0),
        requestedPrice: args.data.requestedPrice || null,
        executedPrice: args.data.executedPrice || null,
        margin: args.data.margin || BigInt(0),
        leverage: args.data.leverage || 10,
        status: (args.data.status as "PENDING" | "FILLED" | "FAILED" | "CANCELED") || "PENDING",
        failureCode: args.data.failureCode || null,
        failureMessage: args.data.failureMessage || null,
        metadata: args.data.metadata || null,
        createdAt: args.data.createdAt || new Date(),
        updatedAt: args.data.updatedAt || new Date(),
        filledAt: args.data.filledAt || null
      };
      mockData.orders.set(order.id, order);
      return order;
    }),
    update: vi.fn(async (args: { where: { id: string }; data: Partial<Order> }) => {
      const order = mockData.orders.get(args.where.id);
      if (!order) {
        throw new Error(`Order not found: ${args.where.id}`);
      }
      const updated = { ...order, ...args.data, updatedAt: new Date() };
      mockData.orders.set(args.where.id, updated as Order);
      return updated as Order;
    })
  },

  // 仓位操作
  position: {
    findFirst: vi.fn(async (args: { where?: { userId?: string; id?: string; symbol?: string; status?: string } }) => {
      const positions = Array.from(mockData.positions.values());
      let result = positions;

      if (args.where?.userId) {
        result = result.filter((p) => p.userId === args.where.userId);
      }
      if (args.where?.id) {
        result = result.filter((p) => p.id === args.where.id);
      }
      if (args.where?.symbol) {
        result = result.filter((p) => p.symbol === args.where.symbol);
      }
      if (args.where?.status) {
        result = result.filter((p) => p.status === args.where.status);
      }

      return result[0] || null;
    }),
    findUnique: vi.fn(async (args: { where: { id: string } }) => {
      return mockData.positions.get(args.where.id) || null;
    }),
    findMany: vi.fn(async (args?: {
      where?: { userId?: string; status?: string };
      select?: { margin?: boolean };
    }) => {
      const delegate = new PrismaPositionDelegate();
      return delegate.findMany(args);
    }),
    create: vi.fn(async (args: { data: Partial<Position> }) => {
      const position: Position = {
        id: args.data.id || `pos_${Date.now()}`,
        userId: args.data.userId || "",
        symbol: (args.data.symbol as "BTC") || "BTC",
        side: (args.data.side as "LONG" | "SHORT") || "LONG",
        positionSize: args.data.positionSize || new Decimal(0),
        entryPrice: args.data.entryPrice || new Decimal(0),
        markPrice: args.data.markPrice || new Decimal(0),
        unrealizedPnl: args.data.unrealizedPnl || new Decimal(0),
        liquidationPrice: args.data.liquidationPrice || new Decimal(0),
        margin: args.data.margin || BigInt(0),
        status: (args.data.status as "OPEN" | "CLOSED" | "LIQUIDATED") || "OPEN",
        riskLevel: (args.data.riskLevel as "SAFE" | "WARNING" | "DANGER") || "SAFE",
        metadata: args.data.metadata || null,
        openedAt: args.data.openedAt || new Date(),
        closedAt: args.data.closedAt || null,
        createdAt: args.data.createdAt || new Date(),
        updatedAt: args.data.updatedAt || new Date()
      };
      mockData.positions.set(position.id, position);
      return position;
    }),
    update: vi.fn(async (args: { where: { id: string }; data: Partial<Position> }) => {
      const position = mockData.positions.get(args.where.id);
      if (!position) {
        throw new Error(`Position not found: ${args.where.id}`);
      }
      const updated = { ...position, ...args.data, updatedAt: new Date() };
      mockData.positions.set(args.where.id, updated as Position);
      return updated as Position;
    }),
    updateMany: vi.fn(async (args: {
      where: { id?: string; userId?: string; status?: string };
      data: Partial<Position>;
    }) => {
      const delegate = new PrismaPositionDelegate();
      return delegate.updateMany(args);
    })
  },

  // 交易记录操作
  transaction: {
    findUnique: vi.fn(async (args: { where: { id?: string; idempotencyKey?: string } }) => {
      const delegate = new PrismaTransactionDelegate();
      return delegate.findUnique(args);
    }),
    findFirst: vi.fn(async (args?: {
      where?: {
        userId?: string;
        type?: string;
        status?: string;
        txHash?: string | null;
        amount?: bigint;
      };
      orderBy?: { createdAt: "desc" | "asc" };
    }) => {
      const delegate = new PrismaTransactionDelegate();
      return delegate.findFirst(args);
    }),
    findMany: vi.fn(async (args?: { where?: { type?: string } }) => {
      const delegate = new PrismaTransactionDelegate();
      return delegate.findMany(args);
    }),
    create: vi.fn(async (args: { data: Partial<Transaction> }) => {
      const transaction: Transaction = {
        id: args.data.id || `tx_${Date.now()}`,
        userId: args.data.userId || "",
        accountId: args.data.accountId || null,
        type: (args.data.type as "DEPOSIT" | "WITHDRAW" | "MARGIN_LOCK" | "MARGIN_RELEASE" | "REALIZED_PNL" | "FEE" | "LIQUIDATION") || "DEPOSIT",
        eventName: args.data.eventName || null,
        txHash: args.data.txHash || null,
        logIndex: args.data.logIndex || null,
        blockNumber: args.data.blockNumber || null,
        amount: args.data.amount || BigInt(0),
        status: (args.data.status as "PENDING" | "CONFIRMED" | "FAILED" | "REVERTED") || "PENDING",
        idempotencyKey: args.data.idempotencyKey || null,
        metadata: args.data.metadata || null,
        createdAt: args.data.createdAt || new Date(),
        updatedAt: args.data.updatedAt || new Date(),
        confirmedAt: args.data.confirmedAt || null
      };
      mockData.transactions.set(transaction.id, transaction);
      return transaction;
    }),
    update: vi.fn(async (args: { where: { id: string }; data: Partial<Transaction> }) => {
      const delegate = new PrismaTransactionDelegate();
      return delegate.update(args);
    })
  },

  // 对冲订单操作
  hedgeOrder: {
    findUnique: vi.fn(async (args: { where: { taskId: string } }) => {
      return mockData.hedgeOrders.get(args.where.taskId) || null;
    }),
    findMany: vi.fn(async (args?: {
      where?: { userId?: string; status?: string; priority?: number };
      orderBy?: { createdAt: "desc" | "asc" };
      take?: number;
    }) => {
      let result = Array.from(mockData.hedgeOrders.values());

      if (args?.where?.userId) {
        result = result.filter((item) => item.userId === args.where!.userId);
      }
      if (args?.where?.status) {
        result = result.filter((item) => item.status === args.where!.status);
      }
      if (args?.where?.priority !== undefined) {
        result = result.filter((item) => item.priority === args.where!.priority);
      }
      if (args?.orderBy?.createdAt === "desc") {
        result = result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (args?.take !== undefined) {
        result = result.slice(0, args.take);
      }

      return result;
    }),
    create: vi.fn(async (args: { data: Partial<HedgeOrder> }) => {
      const hedgeOrder: HedgeOrder = {
        id: args.data.id || `hedge_${Date.now()}`,
        taskId: args.data.taskId || "",
        userId: args.data.userId || "",
        orderId: args.data.orderId || null,
        positionId: args.data.positionId || null,
        externalOrderId: args.data.externalOrderId || null,
        symbol: (args.data.symbol as "BTC") || "BTC",
        side: (args.data.side as "LONG" | "SHORT") || "LONG",
        size: args.data.size || new Decimal(0),
        referencePrice: args.data.referencePrice || null,
        trigger: (args.data.trigger as "OPEN" | "CLOSE" | "MARGIN_ADJUST" | "LIQUIDATION" | "MANUAL") || "OPEN",
        priority: args.data.priority || 5,
        status: (
          args.data.status as
            | "PENDING"
            | "PROCESSING"
            | "SUBMITTED"
            | "FILLED"
            | "FAILED"
            | "SUBMIT_UNKNOWN"
        ) || "PENDING",
        retryCount: args.data.retryCount || 0,
        maxRetryCount: args.data.maxRetryCount || 3,
        errorMessage: args.data.errorMessage || null,
        payload: args.data.payload || {},
        createdAt: args.data.createdAt || new Date(),
        updatedAt: args.data.updatedAt || new Date(),
        submittedAt: args.data.submittedAt || null,
        filledAt: args.data.filledAt || null,
        failedAt: args.data.failedAt || null
      };
      mockData.hedgeOrders.set(hedgeOrder.taskId, hedgeOrder);
      return hedgeOrder;
    }),
    update: vi.fn(async (args: { where: { taskId: string }; data: Partial<HedgeOrder> }) => {
      const hedgeOrder = mockData.hedgeOrders.get(args.where.taskId);
      if (!hedgeOrder) {
        throw new Error(`Hedge order not found: ${args.where.taskId}`);
      }

      const updated = { ...hedgeOrder, ...args.data, updatedAt: new Date() };
      mockData.hedgeOrders.set(args.where.taskId, updated as HedgeOrder);
      return updated as HedgeOrder;
    })
  }
};

// 导出数据存储，供测试使用
export { mockData };
