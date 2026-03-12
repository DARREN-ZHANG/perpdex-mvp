// apps/api/src/middleware/auth.ts
/**
 * JWT 鉴权中间件
 * 验证 Bearer token 并注入用户信息到请求对象
 */
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      walletAddress: string;
    };
  }
}

/**
 * 必须鉴权中间件
 * 如果没有有效 token 则返回 401
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    await reply.status(401).send({
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid authorization header",
        requestId: request.id
      },
      meta: { requestId: request.id }
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const decoded = request.server.jwt.verify(token) as {
      sub: string;
      walletAddress: string;
    };
    request.user = {
      id: decoded.sub,
      walletAddress: decoded.walletAddress
    };
  } catch {
    await reply.status(401).send({
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
        requestId: request.id
      },
      meta: { requestId: request.id }
    });
    return;
  }
}

/**
 * 可选鉴权中间件
 * 如果 token 存在则注入用户信息，否则继续
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return; // No token, continue without user
  }

  const token = authHeader.slice(7);

  try {
    const decoded = request.server.jwt.verify(token) as {
      sub: string;
      walletAddress: string;
    };
    request.user = {
      id: decoded.sub,
      walletAddress: decoded.walletAddress
    };
  } catch {
    // Token invalid, continue without user
  }
}
