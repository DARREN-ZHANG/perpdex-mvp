import { fileURLToPath } from "node:url";

import Fastify from "fastify";

import { apiContract } from "@perpdex/shared";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: "info"
    }
  });

  app.get(apiContract.system.health.path, async () => ({
    data: {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      services: {
        api: "ok" as const,
        db: "unknown" as const,
        redis: "unknown" as const,
        chain: "unknown" as const,
        hyperliquid: "unknown" as const
      }
    },
    error: null
  }));

  return app;
}

async function main() {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3001);

  await app.listen({
    host: "0.0.0.0",
    port
  });
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFilePath) {
  main().catch((error) => {
    // Fastify has not been bootstrapped enough yet for centralized logging.
    console.error(error);
    process.exitCode = 1;
  });
}
