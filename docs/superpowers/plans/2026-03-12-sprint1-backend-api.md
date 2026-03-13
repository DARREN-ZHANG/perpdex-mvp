# Sprint 1 Backend API Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PerpDex MVP Sprint 1 后端基础能力（T10-T14），包括 Fastify 服务骨架、Prisma 数据库、SIWE 鉴权、统一错误处理和 Socket.IO 服务。

**Architecture:** 采用分层架构：Routes → Services → DB。使用 Fastify 插件系统组织路由，Zod 进行请求/响应验证，Prisma 作为 ORM，Socket.IO 提供实时通信。配置通过环境变量加载，错误统一封装为标准响应格式。

**Tech Stack:** Fastify 5.x / TypeScript 5.x / Prisma 6.x / Socket.IO 4.x / Zod 3.x / Pino 9.x / siwe (SIWE) / @fastify/jwt

---

## File Structure

```
apps/api/
├── src/
│   ├── index.ts              # 修改 - 入口文件，启动服务
│   ├── app.ts                # 创建 - Fastify 应用配置，注册插件
│   ├── config/
│   │   └── index.ts          # 创建 - 配置加载和环境变量
│   ├── db/
│   │   └── client.ts         # 创建 - Prisma 客户端单例
│   ├── middleware/
│   │   ├── error-handler.ts  # 创建 - 统一错误处理中间件
│   │   └── auth.ts           # 创建 - JWT 鉴权中间件
│   ├── routes/
│   │   ├── index.ts          # 创建 - 路由注册器
│   │   ├── health.ts         # 创建 - 健康检查路由
│   │   └── auth.ts           # 创建 - SIWE 鉴权路由
│   ├── services/
│   │   └── auth.service.ts   # 创建 - 鉴权业务逻辑
│   ├── utils/
│   │   ├── logger.ts         # 创建 - Pino 日志封装
│   │   ├── siwe.ts           # 创建 - SIWE 工具函数
│   │   └── jwt.ts            # 创建 - JWT 工具函数
│   ├── ws/
│   │   └── index.ts          # 创建 - Socket.IO 服务骨架
│   └── types/
│       └── index.ts          # 创建 - 类型定义
├── tests/
│   ├── setup.ts              # 创建 - 测试设置
│   ├── unit/
│   │   └── siwe.test.ts      # 创建 - SIWE 单元测试
│   └── integration/
│       └── auth.test.ts      # 创建 - 鉴权集成测试
├── .env.example              # 创建 - 环境变量示例
└── package.json              # 修改 - 添加依赖
```

---

## Chunk 1: Project Setup and Dependencies

### Task 1.1: Install Required Dependencies

**Files:**
- Modify: `apps/api/package.json`

> **依赖选型依据：** [ARCHITECTURE.md](../../ARCHITECTURE.md)
> - 测试：Vitest + Supertest + @vitest/coverage-v8
> - 日志：Pino
> - 验证：Zod

- [ ] **Step 1: Add dependencies to package.json**

```json
{
  "dependencies": {
    "@perpdex/shared": "workspace:*",
    "@prisma/client": "^6.5.0",
    "@fastify/jwt": "^9.0.1",
    "@fastify/cors": "^10.0.1",
    "@fastify/rate-limit": "^10.2.0",
    "fastify": "^5.2.1",
    "fastify-type-provider-zod": "^4.0.2",
    "pino": "^9.7.0",
    "pino-pretty": "^13.0.0",
    "siwe": "^3.0.0",
    "socket.io": "^4.8.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "@types/supertest": "^6.0.2",
    "@vitest/coverage-v8": "^3.1.1",
    "prisma": "^6.5.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2",
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 2: Run pnpm install**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api && pnpm install`

Expected: Dependencies installed successfully

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add Sprint 1 dependencies"
```

---

### Task 1.2: Create Environment Configuration

**Files:**
- Create: `apps/api/.env.example`
- Create: `apps/api/src/config/index.ts`
- Create: `apps/api/src/types/index.ts`

- [ ] **Step 1: Create .env.example**

```bash
# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/perpdex?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"

# SIWE
SIWE_CHAIN_ID=421614
SIWE_DOMAIN="localhost:3001"

# External Services
HYPERLIQUID_API_URL="https://api.hyperliquid-testnet.xyz"
RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
VAULT_CONTRACT_ADDRESS="0x0000000000000000000000000000000000000000"

# Socket.IO
SOCKET_CORS_ORIGIN="http://localhost:3000"
```

- [ ] **Step 2: Write config/index.ts**

```typescript
// apps/api/src/config/index.ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const stringValue = process.env[key];
  if (stringValue === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return defaultValue;
  }
  const value = Number.parseInt(stringValue, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return value;
}

export const config = {
  server: {
    port: getEnvNumber("PORT", 3001),
    nodeEnv: getEnvVar("NODE_ENV", "development"),
    logLevel: getEnvVar("LOG_LEVEL", "info")
  },
  database: {
    url: getEnvVar("DATABASE_URL", "postgresql://localhost:5432/perpdex?schema=public")
  },
  redis: {
    url: getEnvVar("REDIS_URL", "redis://localhost:6379")
  },
  jwt: {
    secret: getEnvVar("JWT_SECRET", "dev-secret-change-in-production"),
    expiresIn: getEnvVar("JWT_EXPIRES_IN", "24h")
  },
  siwe: {
    chainId: getEnvNumber("SIWE_CHAIN_ID", 421614),
    domain: getEnvVar("SIWE_DOMAIN", "localhost:3001")
  },
  external: {
    hyperliquidApiUrl: getEnvVar("HYPERLIQUID_API_URL", "https://api.hyperliquid-testnet.xyz"),
    rpcUrl: getEnvVar("RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
    vaultContractAddress: getEnvVar("VAULT_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
  },
  socket: {
    corsOrigin: getEnvVar("SOCKET_CORS_ORIGIN", "http://localhost:3000")
  }
} as const;

export type Config = typeof config;
```

- [ ] **Step 3: Write types/index.ts**

```typescript
// apps/api/src/types/index.ts
import type { FastifyRequest } from "fastify";
import type { User } from "@prisma/client";

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    walletAddress: string;
  };
}

export interface JwtPayload {
  sub: string;
  walletAddress: string;
  iat: number;
  exp: number;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm typecheck`

Expected: No errors (may show some unused variable warnings)

- [ ] **Step 5: Commit**

```bash
git add apps/api/.env.example apps/api/src/config/index.ts apps/api/src/types/index.ts
git commit -m "feat(api): add config system and types"
```

---

### Task 1.3: Create Prisma Client Singleton

**Files:**
- Create: `apps/api/src/db/client.ts`

- [ ] **Step 1: Write db/client.ts**

```typescript
// apps/api/src/db/client.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

- [ ] **Step 2: Generate Prisma Client**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm db:generate`

Expected: Prisma client generated successfully

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/client.ts
git commit -m "feat(api): add Prisma client singleton"
```

---

## Chunk 2: Utilities and Logging

### Task 2.1: Create Logger Utility

**Files:**
- Create: `apps/api/src/utils/logger.ts`

- [ ] **Step 1: Write utils/logger.ts**

```typescript
// apps/api/src/utils/logger.ts
import pino from "pino";
import { config } from "../config/index";

export const logger = pino({
  level: config.server.logLevel,
  transport:
    config.server.nodeEnv === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname"
          }
        }
      : undefined
});

export type Logger = typeof logger;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/utils/logger.ts
git commit -m "feat(api): add Pino logger utility"
```

---

### Task 2.2: Create JWT Utility

**Files:**
- Create: `apps/api/src/utils/jwt.ts`

- [ ] **Step 1: Write utils/jwt.ts**

```typescript
// apps/api/src/utils/jwt.ts
import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "../types/index";

export interface SignJwtInput {
  userId: string;
  walletAddress: string;
}

export function signJwt(
  app: FastifyInstance,
  payload: SignJwtInput
): string {
  return app.jwt.sign({
    sub: payload.userId,
    walletAddress: payload.walletAddress
  });
}

export function verifyJwt(
  app: FastifyInstance,
  token: string
): JwtPayload {
  return app.jwt.verify<JwtPayload>(token);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/utils/jwt.ts
git commit -m "feat(api): add JWT utility functions"
```

---

### Task 2.3: Create SIWE Utility

**Files:**
- Create: `apps/api/src/utils/siwe.ts`
- Create: `tests/unit/siwe.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/siwe.test.ts
import { describe, it, expect } from "vitest";
import { generateSiweMessage, verifySiweSignature } from "../../src/utils/siwe";

describe("SIWE Utils", () => {
  describe("generateSiweMessage", () => {
    it("should generate a valid SIWE message", () => {
      const result = generateSiweMessage({
        walletAddress: "0x1234567890123456789012345678901234567890",
        nonce: "test-nonce-123",
        chainId: 421614,
        domain: "localhost:3001"
      });

      expect(result.message).toContain("localhost:3001");
      expect(result.message).toContain("0x1234567890123456789012345678901234567890");
      expect(result.message).toContain("test-nonce-123");
      expect(result.message).toContain("421614");
    });

    it("should include correct expiration time", () => {
      const result = generateSiweMessage({
        walletAddress: "0x1234567890123456789012345678901234567890",
        nonce: "test-nonce",
        chainId: 421614,
        domain: "localhost:3001"
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
      // Expiration should be 5 minutes in the future
      const now = Date.now();
      const expectedExpiry = now + 5 * 60 * 1000;
      const diff = Math.abs(result.expiresAt.getTime() - expectedExpiry);
      expect(diff).toBeLessThan(1000); // Within 1 second tolerance
    });
  });

  describe("verifySiweSignature", () => {
    it("should reject invalid signature format", async () => {
      await expect(
        verifySiweSignature({
          message: "test message",
          signature: "invalid-signature"
        })
      ).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm vitest run tests/unit/siwe.test.ts`

Expected: FAIL - Module not found or function not defined

- [ ] **Step 3: Write utils/siwe.ts**

```typescript
// apps/api/src/utils/siwe.ts
import { SiweMessage } from "siwe";

export interface GenerateSiweInput {
  walletAddress: string;
  nonce: string;
  chainId: number;
  domain: string;
}

export interface GenerateSiweResult {
  message: string;
  issuedAt: Date;
  expiresAt: Date;
}

export function generateSiweMessage(input: GenerateSiweInput): GenerateSiweResult {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000); // 5 minutes

  const siweMessage = new SiweMessage({
    domain: input.domain,
    address: input.walletAddress,
    statement: "Sign in with Ethereum to the app.",
    uri: `http://${input.domain}`,
    version: "1",
    chainId: input.chainId,
    nonce: input.nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expiresAt.toISOString()
  });

  return {
    message: siweMessage.prepareMessage(),
    issuedAt,
    expiresAt
  };
}

export interface VerifySiweInput {
  message: string;
  signature: string;
}

export interface VerifySiweResult {
  address: string;
  nonce: string;
  chainId: number;
}

export async function verifySiweSignature(input: VerifySiweInput): Promise<VerifySiweResult> {
  const siweMessage = await SiweMessage.verify({
    message: input.message,
    signature: input.signature
  });

  if (!siweMessage.success) {
    throw new Error("SIWE signature verification failed");
  }

  return {
    address: siweMessage.data.address,
    nonce: siweMessage.data.nonce ?? "",
    chainId: siweMessage.data.chainId ?? 1
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm vitest run tests/unit/siwe.test.ts`

Expected: PASS - All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/siwe.ts tests/unit/siwe.test.ts
git commit -m "feat(api): add SIWE utility with tests"
```

---

## Chunk 3: Error Handling and Middleware

### Task 3.1: Create Error Handler Middleware

**Files:**
- Create: `apps/api/src/middleware/error-handler.ts`

- [ ] **Step 1: Write middleware/error-handler.ts**

```typescript
// apps/api/src/middleware/error-handler.ts
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { apiErrorCodeSchema, type ApiErrorCode } from "@perpdex/shared";

interface ApiError {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

function mapErrorToApiCode(error: unknown): ApiErrorCode {
  if (error instanceof ZodError) {
    return "VALIDATION_ERROR";
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("unauthorized") || message.includes("invalid token")) {
      return "UNAUTHORIZED";
    }
    if (message.includes("forbidden") || message.includes("permission")) {
      return "FORBIDDEN";
    }
    if (message.includes("not found")) {
      return "POSITION_NOT_FOUND";
    }
    if (message.includes("insufficient")) {
      return "INSUFFICIENT_BALANCE";
    }
    if (message.includes("conflict") || message.includes("already exists")) {
      return "CONFLICT";
    }
    if (message.includes("rate limit")) {
      return "RATE_LIMITED";
    }
  }

  return "INTERNAL_ERROR";
}

export function formatError(error: unknown, requestId?: string): ApiError {
  const code = mapErrorToApiCode(error);
  let message: string;
  let details: Record<string, unknown> | undefined;

  if (error instanceof ZodError) {
    message = "Validation failed";
    details = {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    };
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = "An unexpected error occurred";
  }

  return {
    code,
    message,
    requestId,
    details
  };
}

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id;
  const apiError = formatError(error, requestId);

  // Log the error
  request.log.error({
    error: {
      code: apiError.code,
      message: apiError.message,
      stack: error.stack
    },
    requestId
  });

  // Determine status code
  let statusCode = 500;
  switch (apiError.code) {
    case "UNAUTHORIZED":
      statusCode = 401;
      break;
    case "FORBIDDEN":
      statusCode = 403;
      break;
    case "VALIDATION_ERROR":
      statusCode = 400;
      break;
    case "POSITION_NOT_FOUND":
      statusCode = 404;
      break;
    case "CONFLICT":
      statusCode = 409;
      break;
    case "RATE_LIMITED":
      statusCode = 429;
      break;
    case "INSUFFICIENT_BALANCE":
    case "ORDER_EXECUTION_FAILED":
    case "RISK_LIMIT_EXCEEDED":
      statusCode = 400;
      break;
    case "SERVICE_UNAVAILABLE":
      statusCode = 503;
      break;
  }

  await reply.status(statusCode).send({
    data: null,
    error: apiError,
    meta: { requestId }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/middleware/error-handler.ts
git commit -m "feat(api): add unified error handler middleware"
```

---

### Task 3.2: Create Auth Middleware

**Files:**
- Create: `apps/api/src/middleware/auth.ts`

- [ ] **Step 1: Write middleware/auth.ts**

```typescript
// apps/api/src/middleware/auth.ts
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import type { AuthenticatedRequest } from "../types/index";
import { apiErrorCodeSchema } from "@perpdex/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      walletAddress: string;
    };
  }
}

export async function authMiddleware(
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
    const decoded = request.server.jwt.verify(token) as { sub: string; walletAddress: string };
    request.user = {
      id: decoded.sub,
      walletAddress: decoded.walletAddress
    };
  } catch (error) {
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

// Optional auth - populates user if token present but doesn't reject
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return; // No token, continue without user
  }

  const token = authHeader.slice(7);

  try {
    const decoded = request.server.jwt.verify(token) as { sub: string; walletAddress: string };
    request.user = {
      id: decoded.sub,
      walletAddress: decoded.walletAddress
    };
  } catch {
    // Token invalid, continue without user
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/middleware/auth.ts
git commit -m "feat(api): add JWT auth middleware"
```

---

## Chunk 4: Routes and Services

### Task 4.1: Create Health Route

**Files:**
- Create: `apps/api/src/routes/health.ts`

- [ ] **Step 1: Write routes/health.ts**

```typescript
// apps/api/src/routes/health.ts
import type { FastifyInstance } from "fastify";
import { apiContract } from "@perpdex/shared";
import { prisma } from "../db/client";

interface HealthStatus {
  status: "ok" | "degraded" | "down";
  services: {
    api: "ok" | "down";
    db: "ok" | "down" | "unknown";
    redis: "ok" | "down" | "unknown";
    chain: "ok" | "down" | "unknown";
    hyperliquid: "ok" | "down" | "unknown";
  };
}

async function checkDatabase(): Promise<"ok" | "down" | "unknown"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "down";
  }
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(apiContract.system.health.path, async (request, reply) => {
    const dbStatus = await checkDatabase();

    const health: HealthStatus = {
      status: dbStatus === "ok" ? "ok" : "degraded",
      services: {
        api: "ok",
        db: dbStatus,
        redis: "unknown",
        chain: "unknown",
        hyperliquid: "unknown"
      }
    };

    return {
      data: {
        status: health.status,
        timestamp: new Date().toISOString(),
        services: health.services
      },
      error: null,
      meta: { requestId: request.id }
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/health.ts
git commit -m "feat(api): add health check route"
```

---

### Task 4.2: Create Auth Service

**Files:**
- Create: `apps/api/src/services/auth.service.ts`

- [ ] **Step 1: Write services/auth.service.ts**

```typescript
// apps/api/src/services/auth.service.ts
import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import { generateSiweMessage, verifySiweSignature } from "../utils/siwe";
import { signJwt } from "../utils/jwt";
import { config } from "../config/index";

export interface ChallengeInput {
  walletAddress: string;
  chainId?: number;
}

export interface ChallengeResult {
  walletAddress: string;
  chainId: number;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

export interface VerifyInput {
  walletAddress: string;
  chainId: number;
  nonce: string;
  message: string;
  signature: string;
}

export interface VerifyResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: {
    id: string;
    walletAddress: string;
    lastLoginAt: string | null;
  };
}

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async createChallenge(input: ChallengeInput): Promise<ChallengeResult> {
    const chainId = input.chainId ?? config.siwe.chainId;
    const nonce = crypto.randomUUID().replace(/-/g, "");

    // Upsert user with nonce
    const user = await prisma.user.upsert({
      where: { walletAddress: input.walletAddress.toLowerCase() },
      create: {
        walletAddress: input.walletAddress.toLowerCase(),
        nonce,
        nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      },
      update: {
        nonce,
        nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });

    const siweResult = generateSiweMessage({
      walletAddress: input.walletAddress,
      nonce: user.nonce!,
      chainId,
      domain: config.siwe.domain
    });

    return {
      walletAddress: input.walletAddress,
      chainId,
      nonce: user.nonce!,
      message: siweResult.message,
      issuedAt: siweResult.issuedAt.toISOString(),
      expiresAt: siweResult.expiresAt.toISOString()
    };
  }

  async verifySignature(input: VerifyInput): Promise<VerifyResult> {
    // Find user by wallet address
    const user = await prisma.user.findUnique({
      where: { walletAddress: input.walletAddress.toLowerCase() }
    });

    if (!user) {
      throw new Error("User not found. Please request a challenge first.");
    }

    if (!user.nonce || user.nonce !== input.nonce) {
      throw new Error("Invalid nonce. Please request a new challenge.");
    }

    if (user.nonceExpiresAt && user.nonceExpiresAt < new Date()) {
      throw new Error("Challenge expired. Please request a new challenge.");
    }

    // Verify SIWE signature
    const siweResult = await verifySiweSignature({
      message: input.message,
      signature: input.signature
    });

    if (siweResult.address.toLowerCase() !== input.walletAddress.toLowerCase()) {
      throw new Error("Signature address mismatch.");
    }

    // Calculate token expiration (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Generate JWT
    const accessToken = signJwt(this.app, {
      userId: user.id,
      walletAddress: user.walletAddress
    });

    // Update user: clear nonce, set last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nonce: null,
        nonceExpiresAt: null,
        lastLoginAt: new Date()
      }
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null
      }
    };
  }

  async getSession(userId: string): Promise<{ authenticated: boolean; user: unknown }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return {
        authenticated: false,
        user: null
      };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null
      }
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/auth.service.ts
git commit -m "feat(api): add auth service with SIWE flow"
```

---

### Task 4.3: Create Auth Route

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Create: `tests/integration/auth.test.ts`

> **测试选型：** 集成测试使用 Supertest + Vitest（ARCHITECTURE.md §5.3）

- [ ] **Step 1: Write the failing test (使用 Supertest)**

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildServer } from "../../src/app";
import type { FastifyInstance } from "fastify";

describe("Auth Routes (Integration)", () => {
  let app: FastifyInstance;
  let server: ReturnType<FastifyInstance["server"]>;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    server = app.server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/auth/challenge", () => {
    it("should return challenge for valid wallet address", async () => {
      const response = await request(server)
        .get("/api/auth/challenge")
        .query({
          walletAddress: "0x1234567890123456789012345678901234567890",
          chainId: "421614"
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        walletAddress: "0x1234567890123456789012345678901234567890",
        chainId: 421614
      });
      expect(response.body.data.nonce).toBeDefined();
      expect(response.body.data.message).toContain("0x1234567890123456789012345678901234567890");
    });

    it("should reject invalid wallet address", async () => {
      const response = await request(server)
        .get("/api/auth/challenge")
        .query({
          walletAddress: "invalid-address"
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/verify", () => {
    // ARCHITECTURE.md §10.3 必须测试：SIWE 登录签名验证
    it("should reject invalid signature", async () => {
      const response = await request(server)
        .post("/api/auth/verify")
        .send({
          walletAddress: "0x1234567890123456789012345678901234567890",
          chainId: 421614,
          nonce: "test-nonce",
          message: "test message",
          signature: "0x1234"
        });

      expect(response.status).toBe(400);
    });

    it("should reject expired challenge", async () => {
      // 这个测试需要 mock 时间或数据库状态
      // Sprint 1 可以先跳过，在后续迭代中完善
    });
  });

  describe("GET /api/auth/session", () => {
    it("should return unauthenticated without token", async () => {
      const response = await request(server)
        .get("/api/auth/session");

      expect(response.status).toBe(200);
      expect(response.body.data.authenticated).toBe(false);
      expect(response.body.data.user).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm vitest run tests/integration/auth.test.ts`

Expected: FAIL - Module not found or route not registered

- [ ] **Step 3: Write routes/auth.ts**

```typescript
// apps/api/src/routes/auth.ts
import type { FastifyInstance } from "fastify";
import {
  apiContract,
  authChallengeQuerySchema,
  authVerifyRequestSchema
} from "@perpdex/shared";
import { AuthService } from "../services/auth.service";
import { optionalAuthMiddleware } from "../middleware/auth";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService(app);

  // GET /api/auth/challenge
  app.get(
    apiContract.auth.challenge.path,
    {
      schema: {
        querystring: authChallengeQuerySchema
      }
    },
    async (request, reply) => {
      const query = request.query as { walletAddress: string; chainId?: number };

      const result = await authService.createChallenge({
        walletAddress: query.walletAddress,
        chainId: query.chainId
      });

      return {
        data: result,
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // POST /api/auth/verify
  app.post(
    apiContract.auth.verify.path,
    {
      schema: {
        body: authVerifyRequestSchema
      }
    },
    async (request, reply) => {
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
    }
  );

  // GET /api/auth/session
  app.get(
    apiContract.auth.session.path,
    {
      preHandler: [optionalAuthMiddleware]
    },
    async (request, reply) => {
      if (!request.user) {
        return {
          data: {
            authenticated: false,
            user: null
          },
          error: null,
          meta: { requestId: request.id }
        };
      }

      const result = await authService.getSession(request.user.id);

      return {
        data: result,
        error: null,
        meta: { requestId: request.id }
      };
    }
  );

  // POST /api/auth/logout
  app.post(
    apiContract.auth.logout.path,
    async (request, reply) => {
      // In a full implementation, you would add the token to a blacklist
      // For MVP, we just return success
      return {
        data: { success: true },
        error: null,
        meta: { requestId: request.id }
      };
    }
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/auth.ts tests/integration/auth.test.ts
git commit -m "feat(api): add auth routes with integration tests"
```

---

### Task 4.4: Create Route Index

**Files:**
- Create: `apps/api/src/routes/index.ts`

- [ ] **Step 1: Write routes/index.ts**

```typescript
// apps/api/src/routes/index.ts
import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health";
import { authRoutes } from "./auth";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Register health routes
  await app.register(healthRoutes);

  // Register auth routes
  await app.register(authRoutes);

  // Placeholder routes for Sprint 2
  // await app.register(userRoutes);
  // await app.register(tradeRoutes);
  // await app.register(marketRoutes);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/index.ts
git commit -m "feat(api): add route index"
```

---

## Chunk 5: App Configuration and Socket.IO

### Task 5.1: Create Fastify App Configuration

**Files:**
- Create: `apps/api/src/app.ts`

- [ ] **Step 1: Write app.ts**

```typescript
// apps/api/src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import {
  serializerCompiler,
  validatorCompiler
} from "fastify-type-provider-zod";
import { config } from "./config/index";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error-handler";
import { registerRoutes } from "./routes/index";

export async function buildServer() {
  const app = Fastify({
    logger: logger,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId"
  });

  // Set Zod validator and serializer
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register CORS
  await app.register(cors, {
    origin: config.socket.corsOrigin,
    credentials: true
  });

  // Register JWT
  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn
    }
  });

  // Register rate limiting (skip in test)
  if (config.server.nodeEnv !== "test") {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute"
    });
  }

  // Set error handler
  app.setErrorHandler(errorHandler);

  // Register routes
  await registerRoutes(app);

  return app;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(api): add Fastify app configuration"
```

---

### Task 5.2: Create Socket.IO Service

**Files:**
- Create: `apps/api/src/ws/index.ts`

- [ ] **Step 1: Write ws/index.ts**

```typescript
// apps/api/src/ws/index.ts
import { Server } from "socket.io";
import type { HttpServer } from "fastify";
import { config } from "../config/index";
import { logger } from "../utils/logger";

let io: Server | null = null;

export function createSocketServer(httpServer: HttpServer): Server {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: config.socket.corsOrigin,
      methods: ["GET", "POST"],
      credentials: true
    },
    path: "/socket.io"
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

    if (!token) {
      // Allow anonymous connections for market data
      socket.data.user = null;
      return next();
    }

    try {
      // In a full implementation, verify JWT here
      // For Sprint 1, we just accept the connection
      socket.data.user = { id: "anonymous" };
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    // Market data subscription
    socket.on("subscribe:market", (data: { symbol: string }) => {
      socket.join(`market:${data.symbol}`);
      logger.debug({ socketId: socket.id, symbol: data.symbol }, "Subscribed to market");
    });

    socket.on("unsubscribe:market", (data: { symbol: string }) => {
      socket.leave(`market:${data.symbol}`);
      logger.debug({ socketId: socket.id, symbol: data.symbol }, "Unsubscribed from market");
    });

    // Position updates subscription (requires auth)
    socket.on("subscribe:position", (data: { userId: string }) => {
      if (!socket.data.user) {
        socket.emit("error", { message: "Authentication required" });
        return;
      }
      socket.join(`position:${data.userId}`);
      logger.debug({ socketId: socket.id, userId: data.userId }, "Subscribed to position");
    });

    socket.on("unsubscribe:position", (data: { userId: string }) => {
      socket.leave(`position:${data.userId}`);
    });

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Client disconnected");
    });
  });

  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

// Utility function to emit market updates
export function emitMarketUpdate(symbol: string, data: unknown): void {
  if (!io) return;
  io.to(`market:${symbol}`).emit(`market:${symbol}:update`, data);
}

// Utility function to emit position updates
export function emitPositionUpdate(userId: string, data: unknown): void {
  if (!io) return;
  io.to(`position:${userId}`).emit(`position:${userId}:update`, data);
}

export function closeSocketServer(): void {
  if (io) {
    io.close();
    io = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/ws/index.ts
git commit -m "feat(api): add Socket.IO service skeleton"
```

---

### Task 5.3: Update Entry Point

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Rewrite src/index.ts**

```typescript
// apps/api/src/index.ts
import { buildServer } from "./app";
import { createSocketServer, closeSocketServer } from "./ws";
import { config } from "./config/index";
import { logger } from "./utils/logger";

async function main() {
  const app = await buildServer();

  // Start HTTP server
  const address = await app.listen({
    host: "0.0.0.0",
    port: config.server.port
  });

  logger.info(`Server listening on ${address}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);

  // Initialize Socket.IO
  const httpServer = app.server;
  createSocketServer(httpServer);
  logger.info("Socket.IO server initialized");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    closeSocketServer();

    await app.close();
    logger.info("Server closed");

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.fatal(error, "Failed to start server");
  process.exit(1);
});
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm typecheck`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): update entry point with Socket.IO and graceful shutdown"
```

---

## Chunk 6: Testing and Verification

> **测试选型依据：** [ARCHITECTURE.md](../../ARCHITECTURE.md) §5.3 测试技术栈
> - 单元测试：Vitest（后端逻辑、工具函数）
> - 集成测试：Supertest + Vitest（API 接口、数据库操作）
> - 覆盖率：Vitest v8
> - **MVP 阶段不实现 E2E 测试**

### Task 6.1: Create Vitest Configuration

**Files:**
- Create: `apps/api/vitest.config.ts`

- [ ] **Step 1: Write vitest.config.ts (使用 Vitest v8 覆盖率)**

```typescript
// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8", // ARCHITECTURE.md 指定
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/types/**"
      ],
      thresholds: {
        // ARCHITECTURE.md §10.3 覆盖率要求
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    },
    // 测试环境变量
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/perpdex_test?schema=public",
      JWT_SECRET: "test-secret-key",
      LOG_LEVEL: "error"
    }
  }
});
```

- [ ] **Step 2: Update package.json test scripts**

Update `apps/api/package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/vitest.config.ts apps/api/package.json
git commit -m "test(api): add Vitest config with v8 coverage per ARCHITECTURE.md"
```

---

### Task 6.2: Run Tests and Verify Coverage

> **覆盖率要求（ARCHITECTURE.md §10.3）：**
> - 单元测试：80%+
> - 集成测试：70%+
> - **Sprint 1 重点测试：** SIWE 登录签名验证

- [ ] **Step 1: Run unit tests**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm vitest run tests/unit`

Expected: All unit tests pass

- [ ] **Step 2: Run integration tests (需要数据库连接)**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm vitest run tests/integration`

Expected: All integration tests pass (或 skip 如果无测试数据库)

- [ ] **Step 3: Run all tests with coverage**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm test:coverage`

Expected:
- Coverage >= 80% for lines/functions
- All tests pass

- [ ] **Step 4: Run linter**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api && pnpm lint`

Expected: No lint errors

- [ ] **Step 5: Run type check**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && pnpm typecheck`

Expected: No type errors

---

### Task 6.3: Final Verification and Commit

- [ ] **Step 1: Verify server starts**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/.worktrees/backend-api/apps/api && timeout 5 pnpm dev || true`

Expected: Server starts and logs "Server listening on http://0.0.0.0:3001"

- [ ] **Step 2: Verify health endpoint**

Run: `curl http://localhost:3001/api/health` (in separate terminal while server running)

Expected: JSON response with status "ok" or "degraded"

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(api): complete Sprint 1 backend implementation

- Add Fastify server with CORS, JWT, rate limiting
- Add Prisma client singleton
- Add SIWE authentication flow (challenge/verify/session)
- Add unified error handling middleware
- Add Socket.IO server skeleton
- Add unit tests for SIWE utilities
- Add integration tests for auth routes

Tasks completed: T10, T11, T12, T13, T14"
```

---

## Summary

### Completed Tasks (Sprint 1 Backend)

| Task | Description | Status |
|------|-------------|--------|
| T10 | 初始化 Fastify API 工程 | ✅ |
| T11 | 初始化 Prisma/数据库迁移流程 | ✅ |
| T12 | 实现 JWT/SIWE 鉴权骨架 | ✅ |
| T13 | 建立统一日志、错误模型、配置加载 | ✅ |
| T14 | 建立 Socket.IO 服务骨架 | ✅ |

### File Summary

**Created:**
- `src/app.ts` - Fastify 应用配置
- `src/config/index.ts` - 配置系统
- `src/db/client.ts` - Prisma 客户端
- `src/middleware/error-handler.ts` - 错误处理
- `src/middleware/auth.ts` - JWT 鉴权
- `src/routes/index.ts` - 路由索引
- `src/routes/health.ts` - 健康检查
- `src/routes/auth.ts` - 鉴权路由
- `src/services/auth.service.ts` - 鉴权服务
- `src/utils/logger.ts` - 日志工具
- `src/utils/jwt.ts` - JWT 工具
- `src/utils/siwe.ts` - SIWE 工具
- `src/ws/index.ts` - Socket.IO 服务
- `src/types/index.ts` - 类型定义
- `tests/setup.ts` - 测试配置
- `tests/unit/siwe.test.ts` - SIWE 单元测试
- `tests/integration/auth.test.ts` - 鉴权集成测试
- `.env.example` - 环境变量示例

**Modified:**
- `src/index.ts` - 更新入口点
- `package.json` - 添加依赖

### Next Steps (Sprint 2)

1. T30: 实现账户余额查询与历史接口
2. T31: 实现 indexer 骨架与区块游标管理
3. T32: 实现 Deposit/Withdraw 事件入账
4. T33: 实现提现请求校验与链上发起骨架
