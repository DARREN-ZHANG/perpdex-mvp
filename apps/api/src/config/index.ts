// apps/api/src/config/index.ts
/**
 * 配置加载模块
 * 从环境变量加载所有配置，提供类型安全的访问
 */

export const processRoleValues = [
  "api",
  "worker",
  "scheduler",
  "indexer"
] as const;

export type ProcessRole = (typeof processRoleValues)[number];

function parseProcessRoles(rawValue: string | undefined): ReadonlySet<ProcessRole> {
  const value = rawValue?.trim();

  if (!value || value === "all") {
    return new Set(processRoleValues);
  }

  const roles = value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (roles.length === 0) {
    return new Set(processRoleValues);
  }

  const invalidRole = roles.find(
    (role): role is string => !processRoleValues.includes(role as ProcessRole)
  );

  if (invalidRole) {
    throw new Error(
      `Invalid APP_ROLES entry: ${invalidRole}. Valid roles: all, ${processRoleValues.join(", ")}`
    );
  }

  return new Set(roles as ProcessRole[]);
}

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
    logLevel: getEnvVar("LOG_LEVEL", "info"),
    roles: parseProcessRoles(process.env.APP_ROLES)
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
    chainId: getEnvNumber("CHAIN_ID", 421614),
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
export { parseProcessRoles };
