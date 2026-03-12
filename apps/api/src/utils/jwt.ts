// apps/api/src/utils/jwt.ts
/**
 * JWT 工具函数
 * 用于签名和验证 JWT token
 */
import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "../types/index";

export interface SignJwtInput {
  userId: string;
  walletAddress: string;
}

/**
 * 签名 JWT token
 */
export function signJwt(app: FastifyInstance, payload: SignJwtInput): string {
  return app.jwt.sign({
    sub: payload.userId,
    walletAddress: payload.walletAddress
  });
}

/**
 * 验证 JWT token 并返回解码后的载荷
 */
export function verifyJwt(app: FastifyInstance, token: string): JwtPayload {
  return app.jwt.verify<JwtPayload>(token);
}

/**
 * 从请求头提取 Bearer token
 */
export function extractBearerToken(
  authHeader: string | undefined
): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
