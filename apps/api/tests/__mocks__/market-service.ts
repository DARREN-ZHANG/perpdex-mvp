// apps/api/tests/__mocks__/market-service.ts
/**
 * 市场服务 Mock
 * 返回固定价格用于测试
 */
import { vi } from "vitest";
import Decimal from "decimal.js";

// 默认测试价格
const DEFAULT_BTC_PRICE = new Decimal("50000");

// Mock 价格存储
const mockPrices = new Map<string, Decimal>([
  ["BTC", DEFAULT_BTC_PRICE]
]);

/**
 * 市场服务 Mock
 */
export const mockMarketService = {
  /**
   * 获取标记价格
   */
  getMarkPrice: vi.fn(async (symbol: string): Promise<Decimal> => {
    const price = mockPrices.get(symbol);
    if (!price) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }
    return price;
  }),

  /**
   * 设置测试价格（供测试用例使用）
   */
  setMarkPrice: vi.fn((symbol: string, price: Decimal): void => {
    mockPrices.set(symbol, price);
  }),

  /**
   * 重置所有价格为默认值
   */
  resetPrices: vi.fn((): void => {
    mockPrices.clear();
    mockPrices.set("BTC", DEFAULT_BTC_PRICE);
  })
};

// 重置 mock 的辅助函数
export function resetMarketServiceMock(): void {
  mockMarketService.getMarkPrice.mockClear();
  mockMarketService.setMarkPrice.mockClear();
  mockMarketService.resetPrices.mockClear();
  mockPrices.clear();
  mockPrices.set("BTC", DEFAULT_BTC_PRICE);
}
