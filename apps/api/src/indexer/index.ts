// apps/api/src/indexer/index.ts
/**
 * Indexer 入口
 * 可独立运行的事件监听服务
 */
import { VaultIndexer } from "./vault-indexer";
import { logger } from "../utils/logger";

export { VaultIndexer } from "./vault-indexer";
export { EventHandler } from "./event-handler";
export { BlockCursorManager, CHAIN_ID } from "./block-cursor";

export function startIndexer(): VaultIndexer {
  const indexer = new VaultIndexer();

  // 优雅关闭
  process.on("SIGINT", () => {
    logger.info({ msg: "Received SIGINT, shutting down indexer..." });
    indexer.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info({ msg: "Received SIGTERM, shutting down indexer..." });
    indexer.stop();
    process.exit(0);
  });

  // 启动
  indexer.start().catch((error) => {
    logger.error({
      msg: "Indexer failed to start",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    process.exit(1);
  });

  return indexer;
}

// 如果直接运行此文件
if (require.main === module) {
  startIndexer();
}
