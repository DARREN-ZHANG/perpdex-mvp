// apps/api/src/clients/hyperliquid.ts
/**
 * Hyperliquid API 客户端
 * 使用 @nktkas/hyperliquid SDK 进行真实交易
 */
import * as hl from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { logger } from "../utils/logger";
import { config } from "../config/index";

// Hyperliquid 持仓信息
interface HyperliquidPosition {
  coin: string;
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
}

// 订单结果
interface OrderResult {
  orderId: string;
  averagePrice?: string;
}

export class HyperliquidClient {
  private walletClient: hl.WalletClient | null = null;
  private publicClient: hl.PublicClient | null = null;
  private walletAddress: `0x${string}` | null = null;
  private isTestnet: boolean;

  constructor() {
    this.isTestnet = config.external.hyperliquidApiUrl.includes("testnet");
    this.initializeClient();
  }

  /**
   * 初始化 Hyperliquid 客户端
   */
  private initializeClient(): void {
    try {
      // 创建 HTTP 传输层
      const transport = new hl.HttpTransport({
        isTestnet: this.isTestnet
      });

      // 创建公共客户端（用于查询）
      this.publicClient = new hl.PublicClient({
        transport
      });

      const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;

      if (!privateKey) {
        logger.warn({
          msg: "HYPERLIQUID_PRIVATE_KEY not set, wallet trading is disabled but public market data remains available"
        });
        return;
      }

      // 从私钥创建 viem 账户
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      this.walletAddress = account.address;

      // 创建钱包客户端（用于交易）
      this.walletClient = new hl.WalletClient({
        wallet: account,
        transport,
        isTestnet: this.isTestnet
      });

      logger.info({
        msg: "Hyperliquid client initialized",
        address: this.walletAddress,
        network: this.isTestnet ? "testnet" : "mainnet"
      });
    } catch (error) {
      logger.error({
        msg: "Failed to initialize Hyperliquid client",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * 提交市价订单
   * @param coin 币种，如 "BTC"
   * @param side 方向: "buy" 或 "sell"
   * @param size 数量
   */
  async submitMarketOrder(
    coin: string,
    side: "buy" | "sell",
    size: string,
    reduceOnly = false
  ): Promise<OrderResult> {
    // 如果客户端未初始化，返回 mock 响应
    if (!this.walletClient || !this.publicClient) {
      logger.warn({
        msg: "Hyperliquid client not initialized, returning mock response",
        coin,
        side,
        size,
        reduceOnly
      });
      return {
        orderId: `mock-${Date.now()}`,
        averagePrice: "50000"
      };
    }

    try {
      logger.info({
        msg: "Submitting market order to Hyperliquid",
        coin,
        side,
        size,
        reduceOnly,
        address: this.walletAddress
      });

      // 获取资产的元数据，找到资产索引和 tick size
      const meta = await this.publicClient.meta();
      const assetIndex = meta.universe.findIndex(
        (item: { name: string }) => item.name === coin
      );

      if (assetIndex === -1) {
        throw new Error(`Asset ${coin} not found in Hyperliquid`);
      }

      // 根据资产不同，价格精度可能不同，一般使用 0.1 或 1 作为步长
      // ETH 使用 0.1，BTC 使用 1
      const priceStep = coin === "BTC" ? 1 : 0.1;

      // 获取当前市场价格
      const markPrice = await this.getMarkPrice(coin);

      // 计算滑点后的价格（买入稍高，卖出稍低）
      const slippage = 0.01; // 1% 滑点
      const priceFloat = parseFloat(markPrice);
      const rawPrice = side === "buy"
        ? priceFloat * (1 + slippage)
        : priceFloat * (1 - slippage);

      // 将价格四舍五入到 tick size
      const limitPrice = (Math.round(rawPrice / priceStep) * priceStep).toFixed(
        coin === "BTC" ? 0 : 1
      );

      // 使用 SDK 的 order 方法提交订单
      const result = await this.walletClient.order({
        orders: [{
          a: assetIndex,           // 资产索引
          b: side === "buy",       // 是否买入
          p: limitPrice,           // 限价
          s: size,                 // 数量
          r: reduceOnly,           // 平仓对冲时使用 reduce-only
          t: {
            limit: {
              tif: "Ioc"           // Immediate or Cancel (市价单)
            }
          }
        }],
        grouping: "na"             // 不分组
      });

      // 解析响应
      if (result.status === "ok" && result.response.data.statuses.length > 0) {
        const status = result.response.data.statuses[0];

        if ("error" in status) {
          throw new Error(`Order error: ${status.error}`);
        }

        let orderId = "";
        let averagePrice: string | undefined;

        if ("resting" in status) {
          orderId = status.resting.oid.toString();
        } else if ("filled" in status) {
          orderId = status.filled.oid.toString();
          averagePrice = status.filled.avgPx;
        }

        logger.info({
          msg: "Hyperliquid order submitted successfully",
          coin,
          side,
          size,
          reduceOnly,
          orderId,
          averagePrice,
          limitPrice,
          assetIndex,
          status: "resting" in status ? "resting" : "filled"
        });

        return { orderId, averagePrice };
      } else {
        throw new Error(`Unexpected response: ${JSON.stringify(result)}`);
      }
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
    if (!this.walletClient || !this.walletAddress) {
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
      // 使用 publicClient 获取持仓
      const state = await this.publicClient!.clearinghouseState({
        user: this.walletAddress
      });

      if (!state.assetPositions) {
        return [];
      }

      return state.assetPositions
        .filter((p: { position: { szi: string } }) => parseFloat(p.position.szi) !== 0)
        .map((p: { position: Record<string, unknown> }) => ({
          coin: p.position.coin as string,
          szi: p.position.szi as string,
          entryPx: p.position.entryPx as string,
          positionValue: p.position.positionValue as string,
          unrealizedPnl: p.position.unrealizedPnl as string
        }));
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
    if (!this.publicClient) {
      throw new Error("Hyperliquid public client is not initialized");
    }

    try {
      // 使用 SDK 获取市场元数据
      const result = await this.publicClient.metaAndAssetCtxs();

      if (!result || !Array.isArray(result) || result.length < 2) {
        throw new Error("Invalid response from Hyperliquid meta API");
      }

      const [meta, assetCtxs] = result;

      if (!meta?.universe || !Array.isArray(assetCtxs)) {
        throw new Error("Invalid data structure from Hyperliquid");
      }

      // 查找币种索引
      const coinIndex = meta.universe.findIndex(
        (item: { name: string }) => item.name === coin
      );

      if (coinIndex >= 0 && assetCtxs[coinIndex]?.markPx) {
        return assetCtxs[coinIndex].markPx;
      }

      throw new Error(`Coin ${coin} not found in Hyperliquid universe`);
    } catch (error) {
      logger.error({
        msg: "Failed to fetch mark price from Hyperliquid",
        coin,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  /**
   * 获取钱包地址
   */
  getWalletAddress(): string | null {
    return this.walletAddress;
  }

  /**
   * 检查客户端是否已初始化
   */
  isReady(): boolean {
    return this.walletClient !== null;
  }
}

export const hyperliquidClient = new HyperliquidClient();
