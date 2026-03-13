// apps/api/src/index.ts
/**
 * 后端 API 入口文件
 */
import { buildServer } from "./app";
import { createSocketServer, closeSocketServer } from "./ws";
import { config } from "./config/index";
import { logger } from "./utils/logger";
import { initializeQueues, closeQueues } from "./queue";
import { startHedgeWorker, stopHedgeWorker } from "./workers/hedge.worker";
import {
  startLiquidationScheduler,
  startReconciliationScheduler
} from "./jobs";
import { startIndexer } from "./indexer";

async function main() {
  const roles = config.server.roles;
  const startApiServer = roles.has("api");
  const startWorker = roles.has("worker");
  const startSchedulers = roles.has("scheduler");
  const startIndexerService = roles.has("indexer") && config.server.nodeEnv !== "test";
  const shouldInitializeQueues = startApiServer || startWorker;

  if (shouldInitializeQueues) {
    await initializeQueues();
  }

  if (startWorker) {
    startHedgeWorker();
  }

  const liquidationScheduler = startSchedulers
    ? startLiquidationScheduler()
    : undefined;
  const reconciliationScheduler = startSchedulers
    ? startReconciliationScheduler()
    : undefined;

  let vaultIndexer: ReturnType<typeof startIndexer> | undefined;
  if (startIndexerService) {
    vaultIndexer = startIndexer();
  }

  const app = startApiServer ? await buildServer() : undefined;

  if (app) {
    const address = await app.listen({
      host: "0.0.0.0",
      port: config.server.port
    });

    logger.info(`Server listening on ${address}`);
    logger.info(`Environment: ${config.server.nodeEnv}`);

    createSocketServer(app);
    logger.info("Socket.IO server initialized");
  }

  logger.info({
    msg: "Process roles initialized",
    roles: Array.from(roles)
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    liquidationScheduler?.stop();
    reconciliationScheduler?.stop();

    if (vaultIndexer) {
      vaultIndexer.stop();
    }

    if (startWorker) {
      await stopHedgeWorker();
    }

    if (shouldInitializeQueues) {
      await closeQueues();
    }

    closeSocketServer();

    if (app) {
      await app.close();
      logger.info("Server closed");
    }

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.fatal(error, "Failed to start server");
  process.exit(1);
});
