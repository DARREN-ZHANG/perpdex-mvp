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

    const updated = {
      ...account,
      availableBalance,
      lockedBalance,
      updatedAt: new Date()
    };
    mockData.accounts.set(account.id, updated as Account);
    return updated as Account;
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
}

// 交易记录 Delegate Mock
class PrismaTransactionDelegate {
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
}

// 对冲订单 Delegate Mock
class PrismaHedgeOrderDelegate {
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
      status: (args.data.status as "PENDING" | "SUBMITTED" | "FILLED" | "FAILED") || "PENDING",
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
  $transaction: vi.fn(async <T>(callback: TransactionCallback<T>): Promise<T> => {
    const tx = createTransaction();
    return callback(tx);
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

      const updated = {
        ...account,
        availableBalance,
        lockedBalance,
        updatedAt: new Date()
      };
      mockData.accounts.set(account.id, updated as Account);
      return updated as Account;
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
    })
  },

  // 交易记录操作
  transaction: {
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
    })
  },

  // 对冲订单操作
  hedgeOrder: {
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
        status: (args.data.status as "PENDING" | "SUBMITTED" | "FILLED" | "FAILED") || "PENDING",
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
    })
  }
};

// 导出数据存储，供测试使用
export { mockData };
