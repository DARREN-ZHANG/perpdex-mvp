// apps/api/src/queue/index.ts
/**
 * 队列模块入口
 */
export {
  initializeQueues,
  getHedgeQueue,
  getHedgeQueueEvents,
  getDLQQueue,
  addHedgeTask,
  moveToDLQ,
  closeQueues
} from "./queue";

export { QUEUE_NAMES, PRIORITY, RETRY_CONFIG } from "./types";
export type { HedgeJobData, HedgeJobResult } from "./types";
