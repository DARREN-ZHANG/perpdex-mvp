import { beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";

const createMarketOrderMock = vi.fn();
const closePositionMock = vi.fn();

vi.mock("../../src/engines/trade-engine", () => ({
  tradeEngine: {
    createMarketOrder: createMarketOrderMock,
    closePosition: closePositionMock
  }
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe("tradeRoutes", () => {
  beforeEach(() => {
    createMarketOrderMock.mockReset();
    closePositionMock.mockReset();
  });

  it("accepts both /api/trade/order and /api/trade/orders for order creation", async () => {
    const { tradeRoutes } = await import("../../src/routes/trade");
    const app = Fastify();

    await app.register(jwt, {
      secret: "test-secret"
    });
    await app.register(tradeRoutes);

    const token = app.jwt.sign({
      sub: "user_123",
      walletAddress: "0x1234567890123456789012345678901234567890"
    });

    createMarketOrderMock.mockResolvedValue({
      order: {
        id: "order_123",
        status: "FILLED",
        executedPrice: "50000"
      },
      position: {
        id: "position_123",
        status: "OPEN"
      },
      hedgeTaskId: "hedge_123"
    });

    const payload = {
      symbol: "BTC",
      side: "LONG",
      size: "0.1",
      margin: "500000000",
      leverage: 10,
      clientOrderId: "client_123"
    };

    const singularResponse = await app.inject({
      method: "POST",
      url: "/api/trade/order",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload
    });

    const pluralResponse = await app.inject({
      method: "POST",
      url: "/api/trade/orders",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload
    });

    expect(singularResponse.statusCode).toBe(200);
    expect(pluralResponse.statusCode).toBe(200);
    expect(createMarketOrderMock).toHaveBeenCalledTimes(2);
    expect(createMarketOrderMock).toHaveBeenNthCalledWith(1, {
      userId: "user_123",
      symbol: "BTC",
      side: "LONG",
      size: expect.objectContaining({
        toString: expect.any(Function)
      }),
      margin: BigInt("500000000"),
      leverage: 10,
      clientOrderId: "client_123"
    });

    await app.close();
  });

  it("accepts both DELETE /api/trade/positions/:id and POST /api/trade/positions/:id/close for position closing", async () => {
    const { tradeRoutes } = await import("../../src/routes/trade");
    const app = Fastify();

    await app.register(jwt, {
      secret: "test-secret"
    });
    await app.register(tradeRoutes);

    const token = app.jwt.sign({
      sub: "user_123",
      walletAddress: "0x1234567890123456789012345678901234567890"
    });

    closePositionMock.mockResolvedValue({
      order: {
        id: "close_order_123",
        realizedPnl: "12.34"
      },
      position: {
        id: "position_123",
        status: "CLOSED"
      },
      hedgeTaskId: "hedge_close_123"
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: "/api/trade/positions/position_123",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    const postResponse = await app.inject({
      method: "POST",
      url: "/api/trade/positions/position_123/close",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(postResponse.statusCode).toBe(200);
    expect(closePositionMock).toHaveBeenCalledTimes(2);
    expect(closePositionMock).toHaveBeenNthCalledWith(1, "user_123", "position_123");
    expect(closePositionMock).toHaveBeenNthCalledWith(2, "user_123", "position_123");

    await app.close();
  });

  it("accepts empty-body JSON delete requests in the full server config", async () => {
    const { buildServer } = await import("../../src/app");
    const app = await buildServer();

    const token = app.jwt.sign({
      sub: "user_123",
      walletAddress: "0x1234567890123456789012345678901234567890"
    });

    closePositionMock.mockResolvedValue({
      order: {
        id: "close_order_123",
        realizedPnl: "12.34"
      },
      position: {
        id: "position_123",
        status: "CLOSED"
      },
      hedgeTaskId: "hedge_close_123"
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/trade/positions/position_123",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(closePositionMock).toHaveBeenCalledWith("user_123", "position_123");

    await app.close();
  });
});
