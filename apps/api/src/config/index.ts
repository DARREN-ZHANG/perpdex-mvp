// apps/api/src/config/index.ts
/**
 * 配置加载模块
 * 从环境变量加载所有配置，提供类型安全的访问
 */

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
    url: getEnvVar(
      "DATABASE_URL",
      "postgresql://localhost:5432/perpdex?schema=public"
    )
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
    hyperliquidApiUrl: getEnvVar(
      "HYPERLIQUID_API_URL",
      "https://api.hyperliquid-testnet.xyz"
    ),
    rpcUrl: getEnvVar("RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
    vaultContractAddress: getEnvVar(
      "VAULT_CONTRACT_ADDRESS",
      "0x0000000000000000000000000000000000000000"
    )
  },
  socket: {
    corsOrigin: getEnvVar("SOCKET_CORS_ORIGIN", "http://localhost:3000")
  },
  queue: {
    redisUrl: getEnvVar("REDIS_URL", "redis://localhost:6379"),
    hedgeQueueName: getEnvVar("HEDGE_QUEUE_NAME", "hedge.execute"),
    dlqQueueName: getEnvVar("DLQ_QUEUE_NAME", "hedge.dlq"),
    maxRetries: getEnvNumber("HEDGE_MAX_RETRIES", 3),
    workerConcurrency: getEnvNumber("HEDGE_WORKER_CONCURRENCY", 5)
  }
} as const;

export type Config = typeof config;
