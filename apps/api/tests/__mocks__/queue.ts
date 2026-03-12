// apps/api/tests/__mocks__/queue.ts
/**
 * 队列 Mock
 * 记录任务创建，不实际连接 Redis
 */
import { vi } from "vitest";
import type { HedgeTaskPayload } from "@perpdex/shared";

// 记录添加的任务
const addedTasks: HedgeTaskPayload[] = [];

/**
 * 对冲任务 Mock
 * 返回 undefined 表示成功，不实际连接队列
 */
export const mockAddHedgeTask = vi.fn().mockResolvedValue(undefined);

/**
 * 获取已添加的任务列表（供测试断言使用）
 */
export function getAddedTasks(): HedgeTaskPayload[] {
  return [...addedTasks];
}

/**
 * 清空任务列表
 */
export function clearAddedTasks(): void {
  addedTasks.length = 0;
}

/**
 * 重置队列 Mock
 */
export function resetQueueMock(): void {
  mockAddHedgeTask.mockClear();
  clearAddedTasks();
}

// 设置 mock 实现以记录任务
mockAddHedgeTask.mockImplementation(async (payload: HedgeTaskPayload): Promise<void> => {
  addedTasks.push(payload);
  return Promise.resolve(undefined);
});

/**
 * 其他队列函数的 Mock（占位）
 */
export const mockInitializeQueues = vi.fn().mockResolvedValue(undefined);
export const mockCloseQueues = vi.fn().mockResolvedValue(undefined);
export const mockGetHedgeQueue = vi.fn();
export const mockMoveToDLQ = vi.fn().mockResolvedValue(undefined);
