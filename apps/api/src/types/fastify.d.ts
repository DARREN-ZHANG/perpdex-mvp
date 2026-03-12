// apps/api/src/types/fastify.d.ts
/**
 * Fastify 类型扩展
 * 为 FastifyRequest 添加 user 属性
 */
import type { JwtUser } from "../middleware/auth";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtUser;
  }
}
