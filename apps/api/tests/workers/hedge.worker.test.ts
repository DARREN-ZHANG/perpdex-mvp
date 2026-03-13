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
vi.mock("../../src/clients/hyperliquid", () => ({
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
    expect(mockData.hedgeOrders.get("hedge_task_1")?.status).toBe("FILLED");
    expect(mockData.hedgeOrders.get("hedge_task_1")?.referencePrice?.toString()).toBe("50123.5");
  });

  it("keeps retryable failures in PENDING so BullMQ retries can continue", async () => {
    submitMarketOrder.mockRejectedValue(new Error("socket timeout"));

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
    ).rejects.toThrow("socket timeout");

    const hedgeOrder = mockData.hedgeOrders.get("hedge_task_1");
    expect(hedgeOrder?.status).toBe("PENDING");
    expect(hedgeOrder?.retryCount).toBe(1);
    expect(moveToDLQ).not.toHaveBeenCalled();
  });

  it("moves terminal failures to DLQ and marks the hedge as FAILED", async () => {
    submitMarketOrder.mockRejectedValue(new Error("Asset BTC not found in Hyperliquid"));

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
    ).rejects.toThrow("Asset BTC not found in Hyperliquid");

    expect(mockData.hedgeOrders.get("hedge_task_1")?.status).toBe("FAILED");
    expect(moveToDLQ).toHaveBeenCalledTimes(1);
  });
});
