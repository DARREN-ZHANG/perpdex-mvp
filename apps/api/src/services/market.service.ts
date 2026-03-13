// apps/api/src/services/market.service.ts
/**
 * 市场服务
 * 获取实时价格数据（从 Hyperliquid API）
 */
import Decimal from "decimal.js";
import { logger } from "../utils/logger";
import { hyperliquidClient } from "../clients/hyperliquid";

export class MarketService {
  async getMarkPrice(symbol: string): Promise<Decimal> {
    try {
      const priceStr = await hyperliquidClient.getMarkPrice(symbol);
      const price = new Decimal(priceStr);

      logger.debug({
        msg: "Fetched mark price from Hyperliquid",
        symbol,
        price: price.toString()
      });

      return price;
    } catch (error) {
      logger.error({
        msg: "Failed to fetch mark price from Hyperliquid",
        symbol,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw new Error(`Failed to fetch mark price for ${symbol}`);
    }
  }
}

export const marketService = new MarketService();
