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
  const user = request.user as JwtUser | undefined;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user;
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
        limit?: string;
        type?: string;
      };

      const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;

      const result = await balanceService.getTransactionHistory(user.id, {
        cursor: query.cursor,
        limit,
        type: query.type
      });

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

  // GET /api/user/transactions/:transactionId
  app.get(
    "/api/user/transactions/:transactionId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = getJwtUser(request);
      const params = request.params as { transactionId: string };
      const transaction = await balanceService.getTransactionDetail(
        user.id,
        params.transactionId
      );

      if (!transaction) {
        reply.code(404);
        return {
          data: null,
          error: {
            code: "TRANSACTION_NOT_FOUND",
            message: "交易记录不存在"
          },
          meta: { requestId: request.id }
        };
      }

      return {
        data: transaction,
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // GET /api/user/orders
  app.get(
    "/api/user/orders",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const query = request.query as {
        cursor?: string;
        limit?: string;
      };

      const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;

      const result = await balanceService.getOrderHistory(user.id, {
        cursor: query.cursor,
        limit
      });

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
