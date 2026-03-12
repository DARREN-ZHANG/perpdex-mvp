// apps/api/src/queue/types.ts
/**
 * 队列任务类型定义
 * 与 packages/shared/src/hedge.ts 保持一致
 */
import type { HedgeTaskPayload, HedgeTaskResult } from "@perpdex/shared";

// 重新导出共享类型
export type { HedgeTaskPayload, HedgeTaskResult };

// BullMQ 任务数据结构
export interface HedgeJobData extends HedgeTaskPayload {
  // BullMQ 要求的数据
}

// BullMQ 任务返回结构
export interface HedgeJobResult extends HedgeTaskResult {
  processedAt: string;
  duration: number;
}

// 队列名称
export const QUEUE_NAMES = {
  HEDGE_EXECUTE: "hedge.execute",
  HEDGE_DLQ: "hedge.dlq"
} as const;

// 任务优先级
export const PRIORITY = {
  LIQUIDATION: 1, // 最高优先级
  NORMAL: 5,
  LOW: 10
} as const;

// 重试配置
export const RETRY_CONFIG = {
  maxRetries: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000 // 初始延迟 1 秒
  }
} as const;
