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

async function main() {
  // 初始化队列
  await initializeQueues();

  // 启动 Hedge Worker
  startHedgeWorker();

  // 启动定时任务
  const liquidationScheduler = startLiquidationScheduler();
  const reconciliationScheduler = startReconciliationScheduler();

  const app = await buildServer();

  // Start HTTP server
  const address = await app.listen({
    host: "0.0.0.0",
    port: config.server.port
  });

  logger.info(`Server listening on ${address}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);

  // Initialize Socket.IO
  createSocketServer(app);
  logger.info("Socket.IO server initialized");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // 停止定时任务
    liquidationScheduler.stop();
    reconciliationScheduler.stop();

    // 停止 Worker
    await stopHedgeWorker();

    // 关闭队列
    await closeQueues();

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
