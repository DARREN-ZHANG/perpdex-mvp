// apps/api/src/services/market.service.ts
/**
 * 市场服务
 * 获取实时价格数据（从 Hyperliquid API）
 */
import Decimal from "decimal.js";
import { logger } from "../utils/logger";
import { hyperliquidClient } from "../clients/hyperliquid";

export class MarketService {
  private async getBinanceFallbackPrice(symbol: string): Promise<Decimal> {
    const binanceSymbol = `${symbol.toUpperCase()}USDT`;
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`
    );

    if (!response.ok) {
      throw new Error(`Binance price request failed with status ${response.status}`);
    }

    const payload = await response.json() as { price?: string };

    if (!payload.price) {
      throw new Error("Binance price response is missing price");
    }

    return new Decimal(payload.price);
  }

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
      logger.warn({
        msg: "Failed to fetch mark price from Hyperliquid, falling back to Binance",
        symbol,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    try {
      const price = await this.getBinanceFallbackPrice(symbol);

      logger.warn({
        msg: "Fetched mark price from Binance fallback",
        symbol,
        price: price.toString()
      });

      return price;
    } catch (fallbackError) {
      logger.error({
        msg: "Failed to fetch mark price from all providers",
        symbol,
        error: fallbackError instanceof Error ? fallbackError.message : "Unknown error"
      });
      throw new Error(`Failed to fetch mark price for ${symbol}`);
    }
  }
}

export const marketService = new MarketService();
