// apps/api/src/routes/auth.ts
/**
 * 鉴权路由
 * 处理 SIWE 登录流程
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuthService } from "../services/auth.service";
import { optionalAuth, type JwtUser } from "../middleware/auth";
import { config } from "../config/index";

const AUTH_CHALLENGE_PATH = "/api/auth/challenge";
const AUTH_VERIFY_PATH = "/api/auth/verify";
const AUTH_SESSION_PATH = "/api/auth/session";
const AUTH_LOGOUT_PATH = "/api/auth/logout";

function getJwtUser(request: FastifyRequest): JwtUser | undefined {
  return request.user as JwtUser | undefined;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app);

  // GET /api/auth/challenge - 获取 SIWE 挑战消息（兼容旧版）
  app.get(AUTH_CHALLENGE_PATH, async (request) => {
    const query = request.query as { walletAddress: string; chainId?: string };

    const chainId = query.chainId
      ? Number.parseInt(query.chainId, 10)
      : config.siwe.chainId;

    const result = await authService.createChallenge({
      walletAddress: query.walletAddress,
      chainId
    });

    return {
      data: result,
      error: null,
      meta: { requestId: request.id }
    };
  });

  // POST /api/auth/challenge - 获取 SIWE 挑战消息
  app.post(AUTH_CHALLENGE_PATH, async (request) => {
    const body = request.body as { address: string; chainId?: number };

    const chainId = body.chainId ?? config.siwe.chainId;

    const result = await authService.createChallenge({
      walletAddress: body.address,
      chainId
    });

    return {
      data: result,
      error: null,
      meta: { requestId: request.id }
    };
  });

  // POST /api/auth/verify - 验证签名并获取 token
  app.post(AUTH_VERIFY_PATH, async (request) => {
    const body = request.body as {
      walletAddress: string;
      chainId: number;
      nonce: string;
      message: string;
      signature: string;
    };

    const result = await authService.verifySignature({
      walletAddress: body.walletAddress,
      chainId: body.chainId,
      nonce: body.nonce,
      message: body.message,
      signature: body.signature
    });

    return {
      data: result,
      error: null,
      meta: { requestId: request.id }
    };
  });

  // GET /api/auth/session - 获取当前会话状态
  app.get(
    AUTH_SESSION_PATH,
    {
      preHandler: [optionalAuth]
    },
    async (request) => {
      const user = getJwtUser(request);

      if (!user) {
        return {
          data: {
            authenticated: false,
            user: null
          },
          error: null,
          meta: { requestId: request.id }
        };
      }

      const result = await authService.getSession(user.id);

      return {
        data: result,
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // GET /api/auth/me - 获取当前用户信息
  app.get(
    "/api/auth/me",
    {
      preHandler: [optionalAuth]
    },
    async (request) => {
      const user = getJwtUser(request);

      if (!user) {
        return {
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: '未登录'
          },
          meta: { requestId: request.id }
        };
      }

      const result = await authService.getSession(user.id);

      if (!result.authenticated || !result.user) {
        return {
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: '未登录'
          },
          meta: { requestId: request.id }
        };
      }

      return {
        data: {
          id: result.user.id,
          address: result.user.walletAddress,
          lastLoginAt: result.user.lastLoginAt,
          createdAt: null,
          updatedAt: null
        },
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // POST /api/auth/logout - 登出
  app.post(AUTH_LOGOUT_PATH, async (request) => {
    const user = getJwtUser(request);

    if (!user) {
      return {
        data: { success: true },
        error: null,
        meta: { requestId: request.id }
      };
    }

    const result = await authService.logout(user.id);

    return {
      data: result,
      error: null,
      meta: { requestId: request.id }
    };
  });
}
