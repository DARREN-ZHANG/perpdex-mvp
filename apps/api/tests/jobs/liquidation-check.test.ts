// apps/api/tests/jobs/liquidation-check.test.ts
/**
 * 清算逻辑测试
 * 测试 TradeEngine.liquidatePosition 方法的行为
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import Decimal from "decimal.js";
import { mockPrismaClient, resetMockData, mockData } from "../__mocks__/prisma";
import {
  mockUser,
  mockAccount,
  createMockPosition,
  TEST_CONSTANTS
} from "../__mocks__/test-fixtures";

// Mock Prisma 客户端 - 必须在最顶部
vi.mock("../../src/db/client", () => {
  return {
    prisma: mockPrismaClient
  };
});

// Mock 队列服务
vi.mock("../../src/queue/queue", () => ({
  addHedgeTask: vi.fn(async () => "hedge-task-id"),
  initializeQueues: vi.fn(async () => {}),
  closeQueues: vi.fn(async () => {})
}));

// Mock 市场服务
vi.mock("../../src/services/market.service", () => ({
  marketService: {
    getMarkPrice: vi.fn(async (symbol: string) => {
      if (symbol === "BTC") {
        return new Decimal("50000");
      }
      throw new Error(`Unknown symbol: ${symbol}`);
    })
  }
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
beforeAll(async () => {
  TradeModule = await import("../../src/engines/trade-engine");
});

describe("Liquidation", () => {
  let tradeEngine: any;

  beforeEach(() => {
    // 重置所有 mock 数据
    resetMockData();
    vi.clearAllMocks();

    // 初始化测试数据
    mockData.users.set(mockUser.id, mockUser);
    mockData.accounts.set(mockAccount.id, mockAccount);

    // 创建 TradeEngine 实例
    tradeEngine = new TradeModule.TradeEngine();
  });

  describe("liquidatePosition", () => {
    describe("清算条件判断", () => {
      it("当 markPrice 触及 liquidationPrice 时应触发清算", async () => {
        // 创建一个 LONG 仓位，清算价格为 45250
        const position = createMockPosition({
          side: "LONG",
          positionSize: "0.1",
          entryPrice: "50000",
          margin: "5000000000", // 5000 USDC
          leverage: 10
        });

        mockData.positions.set(position.id, position);

        // 使用清算价格触发清算
        const liquidationPrice = position.liquidationPrice;
        await tradeEngine.liquidatePosition(position.id, liquidationPrice);

        // 验证仓位状态已更新
        const liquidatedPosition = mockData.positions.get(position.id);
        expect(liquidatedPosition?.status).toBe("LIQUIDATED");
        expect(liquidatedPosition?.closedAt).not.toBeNull();
      });

      it("当 markPrice 未触及 liquidationPrice 时仍可清算（由清算检查任务决定是否调用）", async () => {
        // 创建一个 LONG 仓位
        const position = createMockPosition({
          side: "LONG",
          positionSize: "0.1",
          entryPrice: "50000",
          margin: "5000000000",
          leverage: 10
        });

        mockData.positions.set(position.id, position);

        // 使用正常价格（未触发清算条件）- 但 liquidatePosition 本身不检查条件
        // 条件检查应该由调用方（清算检查任务）完成
        const normalPrice = new Decimal("50000");
        await tradeEngine.liquidatePosition(position.id, normalPrice);

        // liquidatePosition 方法本身不检查清算条件，只执行清算
        const liquidatedPosition = mockData.positions.get(position.id);
        expect(liquidatedPosition?.status).toBe("LIQUIDATED");
      });
    });

    describe("状态转换", () => {
      it("仓位状态应从 OPEN 变为 LIQUIDATED", async () => {
        const position = createMockPosition({
          side: "LONG",
          status: "OPEN"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.status).toBe("LIQUIDATED");
      });

      it("仓位应记录 closedAt 时间", async () => {
        const position = createMockPosition({
          side: "LONG",
          status: "OPEN",
          closedAt: null
        });

        mockData.positions.set(position.id, position);

        const beforeLiquidation = Date.now();
        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));
        const afterLiquidation = Date.now();

        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.closedAt).not.toBeNull();

        const closedAtTime = updatedPosition?.closedAt?.getTime() || 0;
        expect(closedAtTime).toBeGreaterThanOrEqual(beforeLiquidation);
        expect(closedAtTime).toBeLessThanOrEqual(afterLiquidation);
      });
    });

    describe("保证金损失", () => {
      it("清算时保证金应被扣除（不返还给用户）", async () => {
        const position = createMockPosition({
          side: "LONG",
          margin: "5000000000" // 5000 USDC
        });

        mockData.positions.set(position.id, position);

        // 获取清算前的 lockedBalance
        const accountBefore = mockData.accounts.get(mockAccount.id);
        const lockedBefore = accountBefore?.lockedBalance || BigInt(0);

        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        // 验证 lockedBalance 减少了（保证金被扣除）
        const accountAfter = mockData.accounts.get(mockAccount.id);
        expect(accountAfter?.lockedBalance).toBe(lockedBefore - position.margin);

        // 验证 availableBalance 没有增加（保证金不返还）
        expect(accountAfter?.availableBalance).toBe(accountBefore?.availableBalance);
      });

      it("lockedBalance 应减少保证金金额", async () => {
        const marginAmount = BigInt("5000000000"); // 5000 USDC
        const position = createMockPosition({
          side: "LONG",
          margin: marginAmount.toString()
        });

        // 设置账户初始 lockedBalance
        const accountWithLocked = {
          ...mockAccount,
          lockedBalance: marginAmount
        };
        mockData.accounts.set(accountWithLocked.id, accountWithLocked);
        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        const accountAfter = mockData.accounts.get(mockAccount.id);
        expect(accountAfter?.lockedBalance).toBe(BigInt(0));
      });
    });

    describe("对冲任务创建", () => {
      it("清算时应创建对冲订单记录", async () => {
        const { addHedgeTask } = await import("../../src/queue/queue");
        const addHedgeTaskMock = vi.mocked(addHedgeTask);

        const position = createMockPosition({
          side: "LONG",
          positionSize: "0.1"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        // 验证对冲任务被添加
        expect(addHedgeTaskMock).toHaveBeenCalledTimes(1);
      });

      it("对冲任务的 trigger 应为 LIQUIDATION", async () => {
        const position = createMockPosition({
          side: "LONG"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        // 验证数据库中的 hedgeOrder 记录
        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const liquidationHedge = hedgeOrders.find(h => h.trigger === "LIQUIDATION");

        expect(liquidationHedge).toBeDefined();
        expect(liquidationHedge?.positionId).toBe(position.id);
      });

      it("对冲任务的 priority 应为 1（最高优先级）", async () => {
        const position = createMockPosition({
          side: "SHORT"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, new Decimal("55000"));

        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const liquidationHedge = hedgeOrders.find(h => h.trigger === "LIQUIDATION");

        expect(liquidationHedge?.priority).toBe(1);
      });

      it("对冲任务的 side 应与仓位 side 相同（平仓时同向对冲）", async () => {
        const position = createMockPosition({
          side: "SHORT",
          positionSize: "0.5"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, new Decimal("55000"));

        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const liquidationHedge = hedgeOrders.find(h => h.trigger === "LIQUIDATION");

        expect(liquidationHedge?.side).toBe("SHORT");
      });

      it("对冲任务应包含正确的 referencePrice", async () => {
        const markPrice = new Decimal("42100");
        const position = createMockPosition({
          side: "LONG"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, markPrice);

        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const liquidationHedge = hedgeOrders.find(h => h.trigger === "LIQUIDATION");

        expect(liquidationHedge?.referencePrice?.toString()).toBe(markPrice.toString());
      });
    });

    describe("重复清算保护", () => {
      it("已清算的仓位不应再次清算", async () => {
        const position = createMockPosition({
          side: "LONG",
          status: "LIQUIDATED"
        });

        mockData.positions.set(position.id, position);

        // 尝试清算已清算的仓位
        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        // 状态应保持 LIQUIDATED
        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.status).toBe("LIQUIDATED");

        // 不应创建新的对冲订单
        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const newHedgeOrders = hedgeOrders.filter(h => h.positionId === position.id);
        expect(newHedgeOrders.length).toBe(0);
      });

      it("已关闭的仓位不应清算", async () => {
        const position = createMockPosition({
          side: "LONG",
          status: "CLOSED"
        });

        mockData.positions.set(position.id, position);

        // 尝试清算已关闭的仓位
        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        // 状态应保持 CLOSED
        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.status).toBe("CLOSED");

        // 不应创建对冲订单
        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const liquidationHedges = hedgeOrders.filter(h => h.positionId === position.id && h.trigger === "LIQUIDATION");
        expect(liquidationHedges.length).toBe(0);
      });

      it("不存在的仓位应安全处理（不抛出错误）", async () => {
        const nonExistentPositionId = "non_existent_position";

        // 不应抛出错误
        await expect(
          tradeEngine.liquidatePosition(nonExistentPositionId, new Decimal("45000"))
        ).resolves.not.toThrow();
      });
    });

    describe("交易记录", () => {
      it("清算时应创建 LIQUIDATION 类型的交易记录", async () => {
        const position = createMockPosition({
          side: "LONG",
          margin: "5000000000"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        const transactions = Array.from(mockData.transactions.values());
        const liquidationTx = transactions.find(t => t.type === "LIQUIDATION");

        expect(liquidationTx).toBeDefined();
        expect(liquidationTx?.userId).toBe(position.userId);
        expect(liquidationTx?.amount).toBe(position.margin);
        expect(liquidationTx?.status).toBe("CONFIRMED");
      });
    });

    describe("多空双向清算", () => {
      it("应正确处理 LONG 仓位清算", async () => {
        const position = createMockPosition({
          side: "LONG",
          entryPrice: "50000",
          positionSize: "1"
        });

        mockData.positions.set(position.id, position);

        // LONG 仓位：价格下跌触发清算
        await tradeEngine.liquidatePosition(position.id, new Decimal("45000"));

        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.status).toBe("LIQUIDATED");

        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const hedge = hedgeOrders.find(h => h.trigger === "LIQUIDATION");
        expect(hedge?.side).toBe("LONG");
      });

      it("应正确处理 SHORT 仓位清算", async () => {
        const position = createMockPosition({
          side: "SHORT",
          entryPrice: "50000",
          positionSize: "1"
        });

        mockData.positions.set(position.id, position);

        // SHORT 仓位：价格上涨触发清算
        await tradeEngine.liquidatePosition(position.id, new Decimal("55000"));

        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.status).toBe("LIQUIDATED");

        const hedgeOrders = Array.from(mockData.hedgeOrders.values());
        const hedge = hedgeOrders.find(h => h.trigger === "LIQUIDATION");
        expect(hedge?.side).toBe("SHORT");
      });
    });

    describe("清算价格边界情况", () => {
      it("应处理零清算价格情况", async () => {
        const position = createMockPosition({
          side: "LONG",
          entryPrice: "100", // 极低价格
          positionSize: "1",
          margin: "1" // 极低保证金
        });

        mockData.positions.set(position.id, position);

        await expect(
          tradeEngine.liquidatePosition(position.id, new Decimal("0"))
        ).resolves.not.toThrow();
      });

      it("应处理极端高价格情况", async () => {
        const position = createMockPosition({
          side: "SHORT",
          entryPrice: "50000"
        });

        mockData.positions.set(position.id, position);

        await expect(
          tradeEngine.liquidatePosition(position.id, new Decimal("1000000"))
        ).resolves.not.toThrow();

        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.status).toBe("LIQUIDATED");
      });
    });

    describe("markPrice 更新", () => {
      it("清算时应更新仓位的 markPrice", async () => {
        const newPositionPrice = new Decimal("42100");
        const position = createMockPosition({
          side: "LONG",
          markPrice: "50000"
        });

        mockData.positions.set(position.id, position);

        await tradeEngine.liquidatePosition(position.id, newPositionPrice);

        const updatedPosition = mockData.positions.get(position.id);
        expect(updatedPosition?.markPrice.toString()).toBe(newPositionPrice.toString());
      });
    });
  });
});
