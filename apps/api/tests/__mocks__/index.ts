// apps/api/tests/__mocks__/index.ts
/**
 * Mock 统一导出
 * 方便测试文件导入
 */
export {
  mockPrismaClient,
  mockData,
  resetMockData
} from "./prisma";

export {
  mockMarketService,
  resetMarketServiceMock
} from "./market-service";

export {
  mockAddHedgeTask,
  getAddedTasks,
  clearAddedTasks,
  resetQueueMock,
  mockInitializeQueues,
  mockCloseQueues,
  mockMoveToDLQ
} from "./queue";

export {
  mockUser,
  mockAccount,
  mockPosition,
  mockOrder,
  createMockAccount,
  createMockPosition,
  createMockOrder,
  createMarketOrderInput,
  TEST_CONSTANTS
} from "./test-fixtures";
