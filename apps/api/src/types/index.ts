// apps/api/src/types/index.ts
/**
 * 后端 API 类型定义
 */
import type { FastifyRequest } from "fastify";

/**
 * 已认证的请求，包含用户信息
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    walletAddress: string;
  };
}

/**
 * JWT Token 载荷
 */
export interface JwtPayload {
  sub: string;
  walletAddress: string;
  iat: number;
  exp: number;
}

/**
 * API 响应格式
 */
export interface ApiResponse<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
  } | null;
  meta?: {
    requestId?: string;
    nextCursor?: string;
  };
}
