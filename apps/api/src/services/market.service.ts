// apps/api/src/services/market.service.ts
/**
 * 市场服务
 * 获取实时价格数据
 */
import Decimal from "decimal.js";
import { logger } from "../utils/logger";

// MVP: Mock 价格服务，后续接入 Hyperliquid
export class MarketService {
  private prices: Map<string, Decimal> = new Map();

  constructor() {
    // 初始化 mock 价格
    this.prices.set("BTC", new Decimal("50000"));
  }

  async getMarkPrice(symbol: string): Promise<Decimal> {
    // TODO: 从 Hyperliquid API 获取实时价格
    const price = this.prices.get(symbol);
    if (!price) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }
    return price;
  }

  // 供测试使用
  setMarkPrice(symbol: string, price: Decimal): void {
    this.prices.set(symbol, price);
    logger.info({ msg: "Mark price updated", symbol, price: price.toString() });
  }
}

export const marketService = new MarketService();
