// apps/api/src/routes/trade.ts
/**
 * 交易路由
 * 处理下单、平仓、保证金调整
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import Decimal from "decimal.js";
import { requireAuth, type JwtUser } from "../middleware/auth";
import { tradeEngine } from "../engines/trade-engine";
import { logger } from "../utils/logger";

function getJwtUser(request: FastifyRequest): JwtUser {
  const user = request.user as JwtUser | undefined;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user;
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
            realizedPnl: result.order.realizedPnl,
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
