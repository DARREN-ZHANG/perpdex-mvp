// apps/api/src/services/balance.service.ts
/**
 * 余额服务
 * 处理账户余额查询和历史记录
 */
import { prisma } from "../db/client";
import { logger } from "../utils/logger";

export interface BalanceResult {
  userId: string;
  asset: "USDC";
  availableBalance: string;
  lockedBalance: string;
  equity: string;
  updatedAt: string;
}

export interface TransactionHistoryItem {
  id: string;
  type: string;
  amount: string;
  status: string;
  txHash: string | null;
  createdAt: string;
}

export interface OrderHistoryItem {
  id: string;
  symbol: string;
  side: string;
  size: string;
  margin: string;
  leverage: number;
  status: string;
  executedPrice?: string;
  failureMessage?: string;
  createdAt: string;
}

export interface HistoryQuery {
  cursor?: string;
  limit?: number;
  type?: string;
}

export interface PositionResult {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  positionSize: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  liquidationPrice: string;
  margin: string;
  status: string;
  riskLevel: string;
  openedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 余额服务类
 */
export class BalanceService {
  /**
   * 获取用户余额
   */
  async getBalance(userId: string): Promise<BalanceResult | null> {
    const account = await prisma.account.findUnique({
      where: {
        userId_asset: {
          userId,
          asset: "USDC"
        }
      }
    });

    if (!account) {
      return null;
    }

    // 计算权益 = 可用 + 锁定
    const equity = account.availableBalance + account.lockedBalance;

    return {
      userId: account.userId,
      asset: "USDC",
      availableBalance: account.availableBalance.toString(),
      lockedBalance: account.lockedBalance.toString(),
      equity: equity.toString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }

  /**
   * 获取交易历史
   */
  async getTransactionHistory(
    userId: string,
    query: HistoryQuery
  ): Promise<{ items: TransactionHistoryItem[]; nextCursor?: string }> {
    const limit = Math.min(query.limit ?? 20, 100);

    const where: {
      userId: string;
      type?: { in: Array<"DEPOSIT" | "WITHDRAW" | "MARGIN_LOCK" | "MARGIN_RELEASE" | "REALIZED_PNL" | "FEE" | "LIQUIDATION"> };
      id?: { lt: string };
    } = { userId };

    if (query.type) {
      where.type = { in: [query.type as any] };
    }

    if (query.cursor) {
      where.id = { lt: query.cursor };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1
    });

    const items = transactions.slice(0, limit).map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      status: tx.status,
      txHash: tx.txHash,
      createdAt: tx.createdAt.toISOString()
    }));

    const nextCursor =
      transactions.length > limit ? transactions[limit - 1].id : undefined;

    return { items, nextCursor };
  }

  /**
   * 获取订单历史
   */
  async getOrderHistory(
    userId: string,
    query: Omit<HistoryQuery, "type">
  ): Promise<{ items: OrderHistoryItem[]; nextCursor?: string }> {
    const limit = Math.min(query.limit ?? 20, 100);

    const where: {
      userId: string;
      id?: { lt: string };
    } = { userId };

    if (query.cursor) {
      where.id = { lt: query.cursor };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1
    });

    const items = orders.slice(0, limit).map((order) => ({
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      size: order.size.toString(),
      margin: order.margin.toString(),
      leverage: order.leverage,
      status: order.status,
      executedPrice: order.executedPrice?.toString(),
      failureMessage: order.failureMessage ?? undefined,
      createdAt: order.createdAt.toISOString()
    }));

    const nextCursor =
      orders.length > limit ? orders[limit - 1].id : undefined;

    return { items, nextCursor };
  }

  /**
   * 获取用户持仓列表
   */
  async getPositions(userId: string): Promise<PositionResult[]> {
    const positions = await prisma.position.findMany({
      where: {
        userId,
        status: "OPEN"
      },
      orderBy: { createdAt: "desc" }
    });

    return positions.map((p) => ({
      id: p.id,
      userId: p.userId,
      symbol: p.symbol,
      side: p.side,
      positionSize: p.positionSize.toString(),
      entryPrice: p.entryPrice.toString(),
      markPrice: p.markPrice.toString(),
      unrealizedPnl: p.unrealizedPnl.toString(),
      liquidationPrice: p.liquidationPrice.toString(),
      margin: p.margin.toString(),
      status: p.status,
      riskLevel: p.riskLevel,
      openedAt: p.openedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString()
    }));
  }
}
