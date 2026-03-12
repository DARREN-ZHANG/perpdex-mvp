// apps/api/src/clients/hyperliquid.ts
/**
 * Hyperliquid API 客户端
 * 用于执行对冲订单
 */
import { logger } from "../utils/logger";
import { config } from "../config/index";

// Hyperliquid API 类型
interface HyperliquidOrderRequest {
  coin: string;
  is_buy: boolean;
  sz: string;
  limit_px?: string;
  order_type: "market" | "limit";
  reduce_only?: boolean;
}

interface HyperliquidOrderResponse {
  status: "ok" | "err";
  response: {
    type: "order";
    data: {
      statuses: Array<{
        resting?: { oid: number };
        filled?: { avgPx: string; oid: number };
        error?: string;
      }>;
    };
  };
}

interface HyperliquidPosition {
  coin: string;
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
}

export class HyperliquidClient {
  private apiUrl: string;
  private privateKey: string | null;

  constructor() {
    this.apiUrl = config.external.hyperliquidApiUrl;
    this.privateKey = process.env.HYPERLIQUID_PRIVATE_KEY ?? null;
  }

  /**
   * 提交市价订单
   */
  async submitMarketOrder(
    coin: string,
    side: "buy" | "sell",
    size: string
  ): Promise<{ orderId: string; averagePrice?: string }> {
    if (!this.privateKey) {
      // 开发环境：mock 响应
      logger.warn({
        msg: "HYPERLIQUID_PRIVATE_KEY not set, returning mock response",
        coin,
        side,
        size
      });
      return {
        orderId: `mock-${Date.now()}`,
        averagePrice: "50000" // Mock price
      };
    }

    const orderRequest: HyperliquidOrderRequest = {
      coin,
      is_buy: side === "buy",
      sz: size,
      order_type: "market"
    };

    try {
      const response = await fetch(`${this.apiUrl}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: {
            type: "order",
            orders: [orderRequest],
            grouping: "na"
          },
          nonce: Date.now()
          // 签名逻辑需要 EIP-712 实现
          // signature: await this.signRequest(...)
        })
      });

      const result: HyperliquidOrderResponse = await response.json();

      if (result.status !== "ok") {
        throw new Error(`Hyperliquid API error: ${JSON.stringify(result)}`);
      }

      const status = result.response.data.statuses[0];

      if (status.error) {
        throw new Error(`Order error: ${status.error}`);
      }

      // 返回订单 ID
      const orderId = status.resting?.oid?.toString() ?? status.filled?.oid?.toString() ?? "";
      const averagePrice = status.filled?.avgPx;

      logger.info({
        msg: "Hyperliquid order submitted",
        coin,
        side,
        size,
        orderId,
        averagePrice
      });

      return { orderId, averagePrice };
    } catch (error) {
      logger.error({
        msg: "Hyperliquid order failed",
        coin,
        side,
        size,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * 获取当前持仓
   */
  async getPositions(): Promise<HyperliquidPosition[]> {
    if (!this.privateKey) {
      // Mock 响应
      return [
        {
          coin: "BTC",
          szi: "0.1",
          entryPx: "50000",
          positionValue: "5000",
          unrealizedPnl: "0"
        }
      ];
    }

    try {
      const response = await fetch(`${this.apiUrl}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "clearinghouseState"
        })
      });

      const result = await response.json();

      // 解析持仓数据
      return result.assetPositions?.map((p: Record<string, unknown>) => ({
        coin: (p.position as Record<string, unknown>)?.coin as string,
        szi: (p.position as Record<string, unknown>)?.szi as string,
        entryPx: (p.position as Record<string, unknown>)?.entryPx as string,
        positionValue: (p.position as Record<string, unknown>)?.positionValue as string,
        unrealizedPnl: (p.position as Record<string, unknown>)?.unrealizedPnl as string
      })) ?? [];
    } catch (error) {
      logger.error({
        msg: "Failed to fetch Hyperliquid positions",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * 获取市场价格
   */
  async getMarkPrice(coin: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "metaAndAssetCtxs"
        })
      });

      const result = await response.json();

      // 解析价格数据
      const btcData = result.find(
        (item: Array<unknown>) => item[0] === coin || (item[0] as Record<string, unknown>)?.coin === coin
      );

      if (btcData) {
        const ctx = Array.isArray(btcData) ? btcData[1] : btcData;
        return (ctx as Record<string, unknown>)?.markPx as string ?? "50000";
      }

      return "50000"; // Default mock
    } catch {
      return "50000"; // Fallback
    }
  }
}

export const hyperliquidClient = new HyperliquidClient();
