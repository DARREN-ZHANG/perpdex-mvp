import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { mockPrismaClient, mockData, resetMockData } from "../__mocks__/prisma";
import { mockUser } from "../__mocks__/test-fixtures";

vi.mock("../../src/db/client", () => ({
  prisma: mockPrismaClient
}));

const moveToDLQ = vi.fn(async () => {});
vi.mock("../../src/queue/queue", () => ({
  moveToDLQ
}));

const submitMarketOrder = vi.fn();
class HyperliquidOrderError extends Error {
  constructor(
    readonly kind: "CONFIG" | "VALIDATION" | "RETRYABLE" | "SUBMIT_UNKNOWN",
    message: string
  ) {
    super(message);
    this.name = "HyperliquidOrderError";
  }
}

vi.mock("../../src/clients/hyperliquid", () => ({
  HyperliquidOrderError,
  hyperliquidClient: {
    submitMarketOrder
  }
}));

vi.mock("../../src/config/index", () => ({
  config: {
    queue: {
      redisUrl: "redis://localhost:6379",
      workerConcurrency: 1
    }
  }
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

let processHedgeJob: typeof import("../../src/workers/hedge.worker").processHedgeJob;

beforeAll(async () => {
  ({ processHedgeJob } = await import("../../src/workers/hedge.worker"));
});

describe("processHedgeJob", () => {
  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();

    mockData.hedgeOrders.set("hedge_task_1", {
      id: "hedge_1",
      taskId: "hedge_task_1",
      userId: mockUser.id,
      orderId: "order_1",
      positionId: "position_1",
      externalOrderId: null,
      symbol: "BTC",
      side: "SHORT",
      size: new Decimal("0.1"),
      referencePrice: new Decimal("50000"),
      trigger: "OPEN",
      priority: 5,
      status: "PENDING",
      retryCount: 0,
      maxRetryCount: 3,
      errorMessage: null,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: null,
      filledAt: null,
      failedAt: null
    });
  });

  it("marks the hedge as FILLED and stores the average price in the original unit", async () => {
    submitMarketOrder.mockResolvedValue({
      status: "FILLED",
      orderId: "external_1",
      averagePrice: "50123.5"
    });

    const result = await processHedgeJob({
      id: "job_1",
      data: {
        taskId: "hedge_task_1",
        source: "ORDER_FILL",
        userId: mockUser.id,
        orderId: "order_1",
        positionId: "position_1",
        symbol: "BTC",
        side: "SHORT",
        size: "0.1",
        referencePrice: "50000",
        priority: "NORMAL",
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: "hedge-order-1",
        requestedAt: new Date().toISOString()
      },
      opts: { attempts: 4 },
      attemptsMade: 0
    } as any);

    expect(result.status).toBe("FILLED");
    expect(submitMarketOrder).toHaveBeenCalledWith("BTC", "sell", "0.1", false);
    expect(mockData.hedgeOrders.get("hedge_task_1")?.status).toBe("FILLED");
    expect(mockData.hedgeOrders.get("hedge_task_1")?.referencePrice?.toString()).toBe("50123.5");
  });

  it("uses buy reduce-only when closing a short hedge", async () => {
    submitMarketOrder.mockResolvedValue({
      status: "FILLED",
      orderId: "external_2",
      averagePrice: "49950"
    });

    mockData.hedgeOrders.set("hedge_close_task", {
      id: "hedge_2",
      taskId: "hedge_close_task",
      userId: mockUser.id,
      orderId: "order_2",
      positionId: "position_1",
      externalOrderId: null,
      symbol: "BTC",
      side: "LONG",
      size: new Decimal("0.1"),
      referencePrice: new Decimal("50000"),
      trigger: "CLOSE",
      priority: 5,
      status: "PENDING",
      retryCount: 0,
      maxRetryCount: 3,
      errorMessage: null,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: null,
      filledAt: null,
      failedAt: null
    });

    await processHedgeJob({
      id: "job_2",
      data: {
        taskId: "hedge_close_task",
        source: "POSITION_CLOSE",
        userId: mockUser.id,
        orderId: "order_2",
        positionId: "position_1",
        symbol: "BTC",
        side: "LONG",
        size: "0.1",
        referencePrice: "50000",
        priority: "NORMAL",
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: "hedge-close-1",
        requestedAt: new Date().toISOString()
      },
      opts: { attempts: 4 },
      attemptsMade: 0
    } as any);

    expect(submitMarketOrder).toHaveBeenCalledWith("BTC", "buy", "0.1", true);
  });

  it("uses reduce-only when liquidating an existing hedge", async () => {
    submitMarketOrder.mockResolvedValue({
      status: "FILLED",
      orderId: "external_3",
      averagePrice: "49880"
    });

    mockData.hedgeOrders.set("hedge_liq_task", {
      id: "hedge_3",
      taskId: "hedge_liq_task",
      userId: mockUser.id,
      orderId: null,
      positionId: "position_1",
      externalOrderId: null,
      symbol: "BTC",
      side: "LONG",
      size: new Decimal("0.1"),
      referencePrice: new Decimal("50000"),
      trigger: "LIQUIDATION",
      priority: 1,
      status: "PENDING",
      retryCount: 0,
      maxRetryCount: 3,
      errorMessage: null,
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: null,
      filledAt: null,
      failedAt: null
    });

    await processHedgeJob({
      id: "job_3",
      data: {
        taskId: "hedge_liq_task",
        source: "LIQUIDATION",
        userId: mockUser.id,
        positionId: "position_1",
        symbol: "BTC",
        side: "LONG",
        size: "0.1",
        referencePrice: "50000",
        priority: "HIGH",
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: "hedge-liq-1",
        requestedAt: new Date().toISOString()
      },
      opts: { attempts: 4 },
      attemptsMade: 0
    } as any);

    expect(submitMarketOrder).toHaveBeenCalledWith("BTC", "buy", "0.1", true);
  });

  it("keeps accepted but not fully confirmed orders in SUBMITTED", async () => {
    submitMarketOrder.mockResolvedValue({
      status: "SUBMITTED",
      orderId: "external_resting_1"
    });

    const result = await processHedgeJob({
      id: "job_4",
      data: {
        taskId: "hedge_task_1",
        source: "ORDER_FILL",
        userId: mockUser.id,
        orderId: "order_1",
        positionId: "position_1",
        symbol: "BTC",
        side: "SHORT",
        size: "0.1",
        referencePrice: "50000",
        priority: "NORMAL",
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: "hedge-order-1",
        requestedAt: new Date().toISOString()
      },
      opts: { attempts: 4 },
      attemptsMade: 0
    } as any);

    expect(result.status).toBe("SUBMITTED");
    expect(mockData.hedgeOrders.get("hedge_task_1")?.status).toBe("SUBMITTED");
    expect(mockData.hedgeOrders.get("hedge_task_1")?.filledAt).toBeNull();
  });

  it("marks ambiguous submission errors as SUBMIT_UNKNOWN without blind retry", async () => {
    submitMarketOrder.mockRejectedValue(
      new HyperliquidOrderError("SUBMIT_UNKNOWN", "socket timeout")
    );

    const result = await processHedgeJob({
      id: "job_1",
      data: {
        taskId: "hedge_task_1",
        source: "ORDER_FILL",
        userId: mockUser.id,
        orderId: "order_1",
        positionId: "position_1",
        symbol: "BTC",
        side: "SHORT",
        size: "0.1",
        referencePrice: "50000",
        priority: "NORMAL",
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: "hedge-order-1",
        requestedAt: new Date().toISOString()
      },
      opts: { attempts: 4 },
      attemptsMade: 0
    } as any);

    expect(result.status).toBe("SUBMIT_UNKNOWN");
    const hedgeOrder = mockData.hedgeOrders.get("hedge_task_1");
    expect(hedgeOrder?.status).toBe("SUBMIT_UNKNOWN");
    expect(hedgeOrder?.retryCount).toBe(1);
    expect(moveToDLQ).not.toHaveBeenCalled();
  });

  it("keeps retryable failures in PENDING so BullMQ retries can continue", async () => {
    submitMarketOrder.mockRejectedValue(
      new HyperliquidOrderError("RETRYABLE", "rate limit exceeded")
    );

    await expect(
      processHedgeJob({
        id: "job_1",
        data: {
          taskId: "hedge_task_1",
          source: "ORDER_FILL",
          userId: mockUser.id,
          orderId: "order_1",
          positionId: "position_1",
          symbol: "BTC",
          side: "SHORT",
          size: "0.1",
          referencePrice: "50000",
          priority: "NORMAL",
          retryCount: 0,
          maxRetries: 3,
          idempotencyKey: "hedge-order-1",
          requestedAt: new Date().toISOString()
        },
        opts: { attempts: 4 },
        attemptsMade: 0
      } as any)
    ).rejects.toThrow("rate limit exceeded");

    const hedgeOrder = mockData.hedgeOrders.get("hedge_task_1");
    expect(hedgeOrder?.status).toBe("PENDING");
    expect(hedgeOrder?.retryCount).toBe(1);
    expect(moveToDLQ).not.toHaveBeenCalled();
  });

  it("moves terminal failures to DLQ and marks the hedge as FAILED", async () => {
    submitMarketOrder.mockRejectedValue(
      new HyperliquidOrderError("VALIDATION", "Asset BTC not found in Hyperliquid")
    );

    const result = await processHedgeJob({
      id: "job_1",
      data: {
        taskId: "hedge_task_1",
        source: "ORDER_FILL",
        userId: mockUser.id,
        orderId: "order_1",
        positionId: "position_1",
        symbol: "BTC",
        side: "SHORT",
        size: "0.1",
        referencePrice: "50000",
        priority: "NORMAL",
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: "hedge-order-1",
        requestedAt: new Date().toISOString()
      },
      opts: { attempts: 4 },
      attemptsMade: 0
    } as any);

    expect(result.status).toBe("FAILED");
    expect(mockData.hedgeOrders.get("hedge_task_1")?.status).toBe("FAILED");
    expect(moveToDLQ).toHaveBeenCalledTimes(1);
  });
});
