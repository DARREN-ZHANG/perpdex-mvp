// apps/api/tests/engines/trade-engine.test.ts
/**
 * Trade Engine 单元测试
 * 测试核心交易逻辑：下单、平仓、保证金管理
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import Decimal from "decimal.js";
import { mockPrismaClient, resetMockData, mockData } from "../__mocks__/prisma";
import { mockUser, mockAccount, createMockAccount, createMockPosition } from "../__mocks__/test-fixtures";

// Mock Prisma 客户端 - 必须在最顶部
vi.mock("../../src/db/client", () => {
  return {
    prisma: mockPrismaClient
  };
});

// Mock 市场服务
vi.mock("../../src/services/market.service", () => ({
  marketService: {
    getMarkPrice: vi.fn(async (symbol: string) => {
      if (symbol === "BTC") {
        return new Decimal("50000");
      }
      throw new Error(`Unknown symbol: ${symbol}`);
    }),
    setMarkPrice: vi.fn((symbol: string, price: Decimal) => {
      // Mock 实现
    }),
    resetPrices: vi.fn(() => {
      // Mock 实现
    })
  }
}));

// Mock 队列服务
vi.mock("../../src/queue/queue", () => ({
  addHedgeTask: vi.fn(async () => {}),
  initializeQueues: vi.fn(async () => {}),
  closeQueues: vi.fn(async () => {})
}));

// Mock logger
vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// 动态导入 TradeEngine
let TradeModule: any;
let marketServiceMock: any;
let queueModule: any;

beforeAll(async () => {
  TradeModule = await import("../../src/engines/trade-engine");
  marketServiceMock = await import("../../src/services/market.service");
  queueModule = await import("../../src/queue/queue");
});

describe("TradeEngine", () => {
  let tradeEngine: any;

  beforeEach(() => {
    // 重置所有 Mock
    resetMockData();
    vi.clearAllMocks();

    // 设置默认测试数据
    mockData.users.set(mockUser.id, mockUser);
    mockData.accounts.set(mockAccount.id, mockAccount);

    // 重置市场服务价格
    vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("50000"));

    // 创建 TradeEngine 实例
    tradeEngine = new TradeModule.TradeEngine();
  });

  describe("createMarketOrder", () => {
    const defaultOrderInput = {
      userId: mockUser.id,
      symbol: "BTC",
      side: "LONG" as const,
      size: new Decimal("0.1"),
      margin: BigInt("500000000"), // 500 USDC (10x leverage on 5000 USD notional)
      leverage: 10
    };

    describe("余额验证", () => {
      it("应该在余额不足时抛出 'Insufficient balance' 错误", async () => {
        // 清空默认账户，创建余额不足的账户（只有 100 USDC，但需要 500 USDC）
        mockData.accounts.clear();
        const lowBalanceAccount = createMockAccount({
          userId: mockUser.id,
          availableBalance: "100000000" // 100 USDC
        });
        mockData.accounts.set(lowBalanceAccount.id, lowBalanceAccount);

        await expect(
          tradeEngine.createMarketOrder(defaultOrderInput)
        ).rejects.toThrow("Insufficient balance");
      });

      it("应该在账户不存在时抛出 'Insufficient balance' 错误", async () => {
        // 清空账户
        mockData.accounts.clear();

        await expect(
          tradeEngine.createMarketOrder(defaultOrderInput)
        ).rejects.toThrow("Insufficient balance");
      });

      it("应该在余额刚好等于所需保证金时允许下单", async () => {
        // 清空默认账户，创建刚好够余额的账户
        mockData.accounts.clear();
        const exactBalanceAccount = createMockAccount({
          userId: mockUser.id,
          availableBalance: "500000000" // 刚好 500 USDC
        });
        mockData.accounts.set(exactBalanceAccount.id, exactBalanceAccount);

        const result = await tradeEngine.createMarketOrder(defaultOrderInput);

        expect(result.order.status).toBe("FILLED");
        expect(result.position?.status).toBe("OPEN");
      });

      it("应该在余额充足时成功下单", async () => {
        const result = await tradeEngine.createMarketOrder(defaultOrderInput);

        expect(result.order.status).toBe("FILLED");
        expect(result.order.executedPrice).toBe("50000");
        expect(result.position?.status).toBe("OPEN");
        expect(result.hedgeTaskId).toBeDefined();
      });
    });

    describe("仓位冲突检查", () => {
      it("应该在已存在同符号开仓仓位时抛出 'Position already exists' 错误", async () => {
        // 创建一个已存在的 BTC 仓位
        const existingPosition = createMockPosition({
          userId: mockUser.id,
          symbol: "BTC",
          side: "LONG",
          status: "OPEN"
        });
        mockData.positions.set(existingPosition.id, existingPosition);

        await expect(
          tradeEngine.createMarketOrder(defaultOrderInput)
        ).rejects.toThrow("Position already exists for this symbol");
      });

      it("应该在已存在同符号 SHORT 仓位时抛出错误（单仓模式）", async () => {
        // 创建一个已存在的 SHORT 仓位
        const shortPosition = createMockPosition({
          userId: mockUser.id,
          symbol: "BTC",
          side: "SHORT",
          status: "OPEN"
        });
        mockData.positions.set(shortPosition.id, shortPosition);

        await expect(
          tradeEngine.createMarketOrder({
            ...defaultOrderInput,
            side: "LONG"
          })
        ).rejects.toThrow("Position already exists for this symbol");
      });

      it("应该允许在已有 CLOSED 仓位时开新仓", async () => {
        // 创建一个已平仓的仓位
        const closedPosition = createMockPosition({
          userId: mockUser.id,
          symbol: "BTC",
          side: "LONG",
          status: "CLOSED"
        });
        mockData.positions.set(closedPosition.id, closedPosition);

        const result = await tradeEngine.createMarketOrder(defaultOrderInput);

        expect(result.order.status).toBe("FILLED");
        expect(result.position?.status).toBe("OPEN");
      });
    });

    describe("事务完整性", () => {
      it("应该正确锁定保证金", async () => {
        const initialAvailable = mockAccount.availableBalance;
        const margin = defaultOrderInput.margin;

        await tradeEngine.createMarketOrder(defaultOrderInput);

        // 获取更新后的账户
        const updatedAccount = Array.from(mockData.accounts.values())[0];

        expect(updatedAccount.availableBalance).toBe(initialAvailable - margin);
        expect(updatedAccount.lockedBalance).toBe(margin);
      });

      it("应该创建订单和仓位记录", async () => {
        const result = await tradeEngine.createMarketOrder(defaultOrderInput);

        // 验证订单
        const orders = Array.from(mockData.orders.values());
        expect(orders).toHaveLength(1);
        const order = orders[0];
        expect(order.userId).toBe(mockUser.id);
        expect(order.symbol).toBe("BTC");
        expect(order.side).toBe("LONG");
        expect(order.metadata).toEqual({ action: "OPEN" });
        expect(order.status).toBe("FILLED");
        expect(order.size.toString()).toBe("0.1");
        expect(order.margin).toBe(defaultOrderInput.margin);
        expect(order.leverage).toBe(10);

        // 验证仓位
        const positions = Array.from(mockData.positions.values());
        expect(positions).toHaveLength(1);
        const position = positions[0];
        expect(position.userId).toBe(mockUser.id);
        expect(position.symbol).toBe("BTC");
        expect(position.side).toBe("LONG");
        expect(position.status).toBe("OPEN");
        expect(position.positionSize.toString()).toBe("0.1");
        expect(position.margin).toBe(defaultOrderInput.margin);

        // 验证订单和仓位关联
        expect(order.positionId).toBe(position.id);
      });

      it("应该创建保证金锁定交易记录", async () => {
        await tradeEngine.createMarketOrder(defaultOrderInput);

        const transactions = Array.from(mockData.transactions.values());
        const lockTx = transactions.find((tx) => tx.type === "MARGIN_LOCK");

        expect(lockTx).toBeDefined();
        expect(lockTx?.userId).toBe(mockUser.id);
        expect(lockTx?.amount).toBe(defaultOrderInput.margin);
        expect(lockTx?.status).toBe("CONFIRMED");
      });

      it("应该创建对冲任务", async () => {
        const result = await tradeEngine.createMarketOrder(defaultOrderInput);

        expect(result.hedgeTaskId).toBeDefined();
        expect(queueModule.addHedgeTask).toHaveBeenCalledTimes(1);

        const addedTask = queueModule.addHedgeTask.mock.calls[0][0];
        expect(addedTask.source).toBe("ORDER_FILL");
        expect(addedTask.userId).toBe(mockUser.id);
        expect(addedTask.side).toBe("SHORT"); // 用户做多，平台做空
        expect(addedTask.size).toBe("0.1");
      });

      it("应该创建 HedgeOrder 数据库记录", async () => {
        await tradeEngine.createMarketOrder(defaultOrderInput);

        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        expect(hedgeOrders).toHaveLength(1);

        const hedgeOrder = hedgeOrders[0];
        expect(hedgeOrder.userId).toBe(mockUser.id);
        expect(hedgeOrder.symbol).toBe("BTC");
        expect(hedgeOrder.side).toBe("SHORT");
        expect(hedgeOrder.trigger).toBe("OPEN");
        expect(hedgeOrder.status).toBe("PENDING");
      });

      it("应该正确计算清算价格", async () => {
        await tradeEngine.createMarketOrder(defaultOrderInput);

        const position = Array.from(mockData.positions.values())[0];

        // Long 清算价格 = entryPrice * (1 - marginRatio + maintenanceRate)
        // = 50000 * (1 - 0.1 + 0.005) = 45250
        expect(position.liquidationPrice.toString()).toBe("45250");
      });

      it("SHORT 订单应该创建反向对冲任务", async () => {
        const result = await tradeEngine.createMarketOrder({
          ...defaultOrderInput,
          side: "SHORT"
        });

        expect(result.hedgeTaskId).toBeDefined();

        const addedTask = queueModule.addHedgeTask.mock.calls[0][0];
        expect(addedTask.side).toBe("LONG"); // 用户做空，平台做多
      });
    });

    describe("clientOrderId", () => {
      it("应该支持自定义 clientOrderId", async () => {
        const clientOrderId = "client_order_123";

        const result = await tradeEngine.createMarketOrder({
          ...defaultOrderInput,
          clientOrderId
        });

        const order = Array.from(mockData.orders.values())[0];
        expect(order.clientOrderId).toBe(clientOrderId);
        expect(result.order.id).toBeDefined();
      });
    });
  });

  describe("closePosition", () => {
    let testPosition: ReturnType<typeof createMockPosition>;

    beforeEach(() => {
      // 创建一个测试仓位
      testPosition = createMockPosition({
        userId: mockUser.id,
        symbol: "BTC",
        side: "LONG",
        positionSize: "0.1",
        entryPrice: "50000",
        margin: "5000000000",
        status: "OPEN"
      });
      mockData.positions.set(testPosition.id, testPosition);

      // 模拟开仓后锁定保证金的状态
      // 初始: available = 10000, locked = 0
      // 开仓后: available = 5000, locked = 5000
      const accountWithLockedMargin = {
        ...mockAccount,
        availableBalance: BigInt("5000000000"), // 5000 USDC
        lockedBalance: BigInt("5000000000") // 5000 USDC (保证金已锁定)
      };
      mockData.accounts.set(accountWithLockedMargin.id, accountWithLockedMargin);
    });

    describe("仓位不存在检查", () => {
      it("应该在仓位不存在时抛出错误", async () => {
        await expect(
          tradeEngine.closePosition(mockUser.id, "non_existent_position")
        ).rejects.toThrow("Position not found or already closed");
      });

      it("应该在仓位已关闭时抛出错误", async () => {
        const closedPosition = createMockPosition({
          userId: mockUser.id,
          status: "CLOSED"
        });
        mockData.positions.set(closedPosition.id, closedPosition);

        await expect(
          tradeEngine.closePosition(mockUser.id, closedPosition.id)
        ).rejects.toThrow("Position not found or already closed");
      });

      it("应该在仓位属于其他用户时抛出错误", async () => {
        const otherUserId = "other_user_123";
        const otherPosition = createMockPosition({
          userId: otherUserId,
          status: "OPEN"
        });
        mockData.positions.set(otherPosition.id, otherPosition);

        await expect(
          tradeEngine.closePosition(mockUser.id, otherPosition.id)
        ).rejects.toThrow("Position not found or already closed");
      });
    });

    describe("PnL 计算", () => {
      it("应该正确计算盈利仓位的 PnL", async () => {
        // 价格从 50000 涨到 55000
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("55000"));

        const result = await tradeEngine.closePosition(mockUser.id, testPosition.id);

        // Long PnL = (55000 - 50000) * 0.1 = 500 USDC
        expect(result.order.realizedPnl).toBe("500");
        expect(result.position.status).toBe("CLOSED");
      });

      it("应该正确计算亏损仓位的 PnL", async () => {
        // 价格从 50000 跌到 45000
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("45000"));

        const result = await tradeEngine.closePosition(mockUser.id, testPosition.id);

        // Long PnL = (45000 - 50000) * 0.1 = -500 USDC
        expect(result.order.realizedPnl).toBe("-500");
        expect(result.position.status).toBe("CLOSED");
      });

      it("应该正确计算 SHORT 仓位的盈利", async () => {
        // 创建 SHORT 仓位
        const shortPosition = createMockPosition({
          userId: mockUser.id,
          side: "SHORT",
          entryPrice: "50000",
          positionSize: "0.1",
          status: "OPEN"
        });
        mockData.positions.set(shortPosition.id, shortPosition);

        // 价格从 50000 跌到 45000，Short 盈利
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("45000"));

        const result = await tradeEngine.closePosition(mockUser.id, shortPosition.id);

        // Short PnL = (50000 - 45000) * 0.1 = 500 USDC
        expect(result.order.realizedPnl).toBe("500");
      });

      it("应该正确计算 SHORT 仓位的亏损", async () => {
        // 创建 SHORT 仓位
        const shortPosition = createMockPosition({
          userId: mockUser.id,
          side: "SHORT",
          entryPrice: "50000",
          positionSize: "0.1",
          status: "OPEN"
        });
        mockData.positions.set(shortPosition.id, shortPosition);

        // 价格从 50000 涨到 55000，Short 亏损
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("55000"));

        const result = await tradeEngine.closePosition(mockUser.id, shortPosition.id);

        // Short PnL = (50000 - 55000) * 0.1 = -500 USDC
        expect(result.order.realizedPnl).toBe("-500");
      });

      it("应该在无盈亏时返回零", async () => {
        // 价格不变
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("50000"));

        const result = await tradeEngine.closePosition(mockUser.id, testPosition.id);

        expect(result.order.realizedPnl).toBe("0");
      });
    });

    describe("保证金释放", () => {
      it("应该释放保证金到可用余额", async () => {
        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const updatedAccount = Array.from(mockData.accounts.values())[0];

        // 初始: available = 10000, locked = 0
        // 开仓后: available = 5000, locked = 5000
        // 平仓后: available = 10000, locked = 0
        expect(updatedAccount.lockedBalance).toBe(BigInt(0));
        expect(updatedAccount.availableBalance).toBe(BigInt("10000000000"));
      });

      it("应该在盈利时增加可用余额", async () => {
        // 盈利 500 USDC
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("55000"));

        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const updatedAccount = Array.from(mockData.accounts.values())[0];

        // 初始: available = 10000
        // 开仓后: available = 5000, locked = 5000
        // 平仓后: available = 10500, locked = 0
        expect(updatedAccount.availableBalance).toBe(BigInt("10500000000"));
        expect(updatedAccount.lockedBalance).toBe(BigInt(0));
      });

      it("应该在亏损时减少可用余额", async () => {
        // 亏损 500 USDC
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("45000"));

        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const updatedAccount = Array.from(mockData.accounts.values())[0];

        // 初始: available = 10000
        // 开仓后: available = 5000, locked = 5000
        // 平仓后: available = 9500, locked = 0
        expect(updatedAccount.availableBalance).toBe(BigInt("9500000000"));
        expect(updatedAccount.lockedBalance).toBe(BigInt(0));
      });

      it("应该将最大亏损限制在已锁定保证金内", async () => {
        const shortPosition = createMockPosition({
          userId: mockUser.id,
          side: "SHORT",
          entryPrice: "50000",
          positionSize: "0.1",
          margin: "5000000000",
          status: "OPEN"
        });
        mockData.positions.set(shortPosition.id, shortPosition);

        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("1000000"));

        await tradeEngine.closePosition(mockUser.id, shortPosition.id);

        const updatedAccount = Array.from(mockData.accounts.values())[0];
        expect(updatedAccount.availableBalance).toBe(BigInt("5000000000"));
        expect(updatedAccount.lockedBalance).toBe(BigInt(0));
      });

      it("应该创建保证金释放交易记录", async () => {
        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const transactions = Array.from(mockData.transactions.values());
        const releaseTx = transactions.find((tx) => tx.type === "MARGIN_RELEASE");

        expect(releaseTx).toBeDefined();
        expect(releaseTx?.amount).toBe(testPosition.margin);
        expect(releaseTx?.status).toBe("CONFIRMED");
      });

      it("应该创建 PnL 交易记录（盈利）", async () => {
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("55000"));

        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const transactions = Array.from(mockData.transactions.values());
        const pnlTx = transactions.find((tx) => tx.type === "REALIZED_PNL");

        expect(pnlTx).toBeDefined();
        expect(pnlTx?.amount).toBe(BigInt("500000000")); // 500 USDC
      });

      it("应该创建 PnL 交易记录（亏损）", async () => {
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("45000"));

        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const transactions = Array.from(mockData.transactions.values());
        const pnlTx = transactions.find((tx) => tx.type === "REALIZED_PNL");

        expect(pnlTx).toBeDefined();
        expect(pnlTx?.amount).toBe(BigInt("500000000")); // 绝对值 500 USDC
      });

      it("应该在无盈亏时不创建 PnL 交易记录", async () => {
        vi.mocked(marketServiceMock.marketService.getMarkPrice).mockResolvedValue(new Decimal("50000"));

        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const transactions = Array.from(mockData.transactions.values());
        const pnlTx = transactions.find((tx) => tx.type === "REALIZED_PNL");

        expect(pnlTx).toBeUndefined();
      });
    });

    describe("对冲任务创建", () => {
      it("应该创建平仓对冲任务（同向）", async () => {
        const result = await tradeEngine.closePosition(mockUser.id, testPosition.id);

        expect(result.hedgeTaskId).toBeDefined();
        expect(queueModule.addHedgeTask).toHaveBeenCalledTimes(1);

        const addedTask = queueModule.addHedgeTask.mock.calls[0][0];
        expect(addedTask.source).toBe("POSITION_CLOSE");
        expect(addedTask.side).toBe("LONG"); // 平仓时对冲方向与原仓位相同
      });

      it("应该创建 HedgeOrder 数据库记录", async () => {
        await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        expect(hedgeOrders).toHaveLength(1);

        const hedgeOrder = hedgeOrders[0];
        expect(hedgeOrder.trigger).toBe("CLOSE");
        expect(hedgeOrder.status).toBe("PENDING");
      });
    });

    describe("订单创建", () => {
      it("应该创建反向平仓订单", async () => {
        const result = await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const orders = Array.from(mockData.orders.values());
        expect(orders).toHaveLength(1);

        const closeOrder = orders[0];
        expect(closeOrder.userId).toBe(mockUser.id);
        expect(closeOrder.positionId).toBe(testPosition.id);
        expect(closeOrder.side).toBe("SHORT"); // Long 仓位平仓是 Short 订单
        expect(closeOrder.metadata).toEqual({
          action: "CLOSE",
          closingPositionSide: "LONG"
        });
        expect(closeOrder.type).toBe("MARKET");
        expect(closeOrder.status).toBe("FILLED");
        expect(closeOrder.margin).toBe(BigInt(0)); // 平仓不需要保证金
      });

      it("应该更新仓位状态为 CLOSED", async () => {
        const result = await tradeEngine.closePosition(mockUser.id, testPosition.id);

        const updatedPosition = mockData.positions.get(testPosition.id);
        expect(updatedPosition?.status).toBe("CLOSED");
        expect(updatedPosition?.closedAt).toBeDefined();
      });
    });
  });

  describe("liquidatePosition", () => {
    let testPosition: ReturnType<typeof createMockPosition>;

    beforeEach(() => {
      testPosition = createMockPosition({
        userId: mockUser.id,
        symbol: "BTC",
        side: "LONG",
        positionSize: "0.1",
        entryPrice: "50000",
        margin: "5000000000",
        status: "OPEN"
      });
      mockData.positions.set(testPosition.id, testPosition);
    });

    it("应该将仓位标记为 LIQUIDATED", async () => {
      const liquidationPrice = new Decimal("44000");

      await tradeEngine.liquidatePosition(testPosition.id, liquidationPrice);

      const updatedPosition = mockData.positions.get(testPosition.id);
      expect(updatedPosition?.status).toBe("LIQUIDATED");
      expect(updatedPosition?.closedAt).toBeDefined();
    });

    it("应该扣除锁定的保证金", async () => {
      // 设置账户初始 lockedBalance
      const initialLockedBalance = testPosition.margin;
      const accountWithLocked = {
        ...mockAccount,
        lockedBalance: initialLockedBalance
      };
      mockData.accounts.set(accountWithLocked.id, accountWithLocked);

      const liquidationPrice = new Decimal("44000");

      await tradeEngine.liquidatePosition(testPosition.id, liquidationPrice);

      const updatedAccount = mockData.accounts.get(mockAccount.id);
      expect(updatedAccount?.lockedBalance).toBe(BigInt(0));
      // 清算时不返还保证金
    });

    it("应该创建清算交易记录", async () => {
      const liquidationPrice = new Decimal("44000");

      await tradeEngine.liquidatePosition(testPosition.id, liquidationPrice);

      const transactions = Array.from(mockData.transactions.values());
      const liqTx = transactions.find((tx) => tx.type === "LIQUIDATION");

      expect(liqTx).toBeDefined();
      expect(liqTx?.userId).toBe(testPosition.userId);
      expect(liqTx?.status).toBe("CONFIRMED");
    });

    it("应该创建高优先级对冲任务", async () => {
      // 设置账户初始 lockedBalance
      const initialLockedBalance = testPosition.margin;
      const accountWithLocked = {
        ...mockAccount,
        lockedBalance: initialLockedBalance
      };
      mockData.accounts.set(accountWithLocked.id, accountWithLocked);

      const liquidationPrice = new Decimal("44000");

      await tradeEngine.liquidatePosition(testPosition.id, liquidationPrice);

      expect(queueModule.addHedgeTask).toHaveBeenCalledTimes(1);

      const addedTask = queueModule.addHedgeTask.mock.calls[0][0];
      expect(addedTask.source).toBe("LIQUIDATION");
      expect(addedTask.priority).toBe("HIGH");
    });

    it("应该在仓位不存在时静默返回", async () => {
      // 不应该抛出错误
      await expect(
        tradeEngine.liquidatePosition("non_existent", new Decimal("44000"))
      ).resolves.not.toThrow();
    });

    it("应该在仓位已关闭时静默返回", async () => {
      const closedPosition = createMockPosition({
        userId: mockUser.id,
        status: "CLOSED"
      });
      mockData.positions.set(closedPosition.id, closedPosition);

      await expect(
        tradeEngine.liquidatePosition(closedPosition.id, new Decimal("44000"))
      ).resolves.not.toThrow();
    });
  });

  describe("getPosition", () => {
    it("应该返回仓位详情", async () => {
      const testPosition = createMockPosition({
        userId: mockUser.id,
        status: "OPEN"
      });
      mockData.positions.set(testPosition.id, testPosition);

      const result = await tradeEngine.getPosition(mockUser.id, testPosition.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testPosition.id);
      expect(result?.userId).toBe(testPosition.userId);
      expect(result?.symbol).toBe(testPosition.symbol);
      expect(result?.side).toBe(testPosition.side);
      expect(result?.status).toBe(testPosition.status);
    });

    it("应该在仓位不存在时返回 null", async () => {
      const result = await tradeEngine.getPosition(mockUser.id, "non_existent");

      expect(result).toBeNull();
    });

    it("应该在仓位属于其他用户时返回 null", async () => {
      const otherPosition = createMockPosition({
        userId: "other_user",
        status: "OPEN"
      });
      mockData.positions.set(otherPosition.id, otherPosition);

      const result = await tradeEngine.getPosition(mockUser.id, otherPosition.id);

      expect(result).toBeNull();
    });
  });
});
