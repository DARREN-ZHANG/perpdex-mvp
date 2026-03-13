// apps/api/src/engines/trade-engine.ts
/**
 * 交易引擎
 * 核心交易逻辑：下单、平仓、保证金管理
 */
import { prisma } from "../db/client";
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { logger } from "../utils/logger";
import { marketService } from "../services/market.service";
import { addHedgeTask } from "../queue/queue";
import type { HedgeJobData } from "../queue/types";
import {
  calculatePositionMetrics,
  type PositionInput,
  type MarkPriceInput
} from "./pnl-calculator";
import { emitPositionUpdate, emitBalanceUpdate } from "../ws/index";
import { AppError } from "../errors/app-error";

export interface CreateOrderInput {
  userId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  size: Decimal;
  margin: bigint;
  leverage: number;
  clientOrderId?: string;
}

export interface CreateOrderResult {
  order: {
    id: string;
    status: string;
    executedPrice: string;
  };
  position?: {
    id: string;
    status: string;
  };
  hedgeTaskId?: string;
}

export interface ClosePositionResult {
  order: {
    id: string;
    realizedPnl: string;
  };
  position: {
    id: string;
    status: string;
  };
  hedgeTaskId?: string;
}

/**
 * 交易引擎类
 */
export class TradeEngine {
  private getPositionLeverage(position: { metadata: Prisma.JsonValue | null }): number {
    const metadata = position.metadata as { leverage?: number } | null;
    if (
      metadata &&
      typeof metadata === "object" &&
      typeof metadata.leverage === "number"
    ) {
      return metadata.leverage;
    }

    return 10;
  }

  private async enqueueHedgeTask(payload: HedgeJobData): Promise<void> {
    try {
      await addHedgeTask(payload);
      await prisma.hedgeOrder.update({
        where: { taskId: payload.taskId },
        data: {
          errorMessage: null
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({
        msg: "Failed to add hedge task to queue",
        taskId: payload.taskId,
        error: errorMessage
      });

      await prisma.hedgeOrder.update({
        where: { taskId: payload.taskId },
        data: {
          errorMessage: `QUEUE_ENQUEUE_FAILED: ${errorMessage}`
        }
      });
    }
  }

  /**
   * 创建市价订单
   */
  async createMarketOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { userId, symbol, side, size, margin, leverage, clientOrderId } = input;

    // 1. 获取当前价格
    const markPrice = await marketService.getMarkPrice(symbol);

    if (size.lte(0)) {
      throw new AppError("VALIDATION_ERROR", "Order size must be greater than zero");
    }

    if (margin <= BigInt(0)) {
      throw new AppError("VALIDATION_ERROR", "Margin must be greater than zero");
    }

    // 2. 计算清算价格
    // margin 使用 USDC (6 decimals)，需要转换为 USD 单位
    const marginInUsd = new Decimal(margin.toString()).div(new Decimal(1_000_000));
    const positionInput: PositionInput = {
      side,
      positionSize: size,
      entryPrice: markPrice,
      margin: marginInUsd,
      leverage
    };

    const metrics = calculatePositionMetrics(positionInput, { markPrice });
    const hedgeSide = side === "LONG" ? "SHORT" : "LONG";
    const hedgeTaskId = crypto.randomUUID();
    const hedgePayload: HedgeJobData = {
      taskId: hedgeTaskId,
      source: "ORDER_FILL",
      userId,
      symbol: "BTC",
      side: hedgeSide,
      size: size.toString(),
      referencePrice: markPrice.toString(),
      priority: "NORMAL",
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: clientOrderId ? `hedge-${clientOrderId}` : `hedge-open-${hedgeTaskId}`,
      requestedAt: new Date().toISOString()
    };

    // 3. 事务：锁定保证金、创建订单、创建仓位、记录对冲意图
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: {
          userId_asset: { userId, asset: "USDC" }
        }
      });

      if (!account || account.availableBalance < margin) {
        throw new AppError("INSUFFICIENT_BALANCE", "Insufficient balance");
      }

      // 锁定保证金
      const updatedAccount = await tx.account.update({
        where: { id: account!.id },
        data: {
          availableBalance: { decrement: margin },
          lockedBalance: { increment: margin }
        }
      });

      // 创建保证金锁定交易记录
      await tx.transaction.create({
        data: {
          userId,
          accountId: account!.id,
          type: "MARGIN_LOCK",
          amount: margin,
          status: "CONFIRMED"
        }
      });

      // 创建订单
      const order = await tx.order.create({
        data: {
          userId,
          symbol: symbol as "BTC",
          side,
          type: "MARKET",
          size,
          margin,
          leverage,
          executedPrice: markPrice,
          status: "FILLED",
          filledAt: new Date(),
          clientOrderId,
          metadata: {
            action: "OPEN"
          }
        }
      });

      // 创建仓位
      const position = await tx.position.create({
        data: {
          userId,
          symbol: symbol as "BTC",
          side,
          positionSize: size,
          entryPrice: markPrice,
          markPrice,
          unrealizedPnl: new Decimal(0),
          liquidationPrice: metrics.liquidationPrice,
          margin,
          status: "OPEN",
          riskLevel: metrics.riskLevel,
          metadata: {
            leverage
          }
        }
      });

      // 关联订单和仓位
      await tx.order.update({
        where: { id: order.id },
        data: { positionId: position.id }
      });

      const payload = {
        ...hedgePayload,
        orderId: order.id,
        positionId: position.id
      };

      await tx.hedgeOrder.create({
        data: {
          taskId: hedgeTaskId,
          userId,
          orderId: order.id,
          positionId: position.id,
          symbol: "BTC",
          side: hedgeSide,
          size,
          referencePrice: new Decimal(markPrice.toString()),
          trigger: "OPEN",
          priority: 5,
          status: "PENDING",
          retryCount: 0,
          maxRetryCount: 3,
          payload
        }
      });

      return { order, position, updatedAccount, hedgePayload: payload };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    logger.info({
      msg: "Market order created",
      userId,
      orderId: result.order.id,
      positionId: result.position.id,
      symbol,
      side,
      size: size.toString(),
      executedPrice: markPrice.toString()
    });

    // 6. 推送仓位更新
    emitPositionUpdate(userId, {
      type: "POSITION_CREATED",
      position: {
        id: result.position.id,
        symbol,
        side,
        positionSize: size.toString(),
        entryPrice: markPrice.toString(),
        status: "OPEN"
      }
    });

    // 推送余额更新
    emitBalanceUpdate(userId, {
      availableBalance: result.updatedAccount.availableBalance.toString(),
      lockedBalance: result.updatedAccount.lockedBalance.toString(),
      totalBalance: (
        result.updatedAccount.availableBalance + result.updatedAccount.lockedBalance
      ).toString()
    });

    void this.enqueueHedgeTask(result.hedgePayload);

    return {
      order: {
        id: result.order.id,
        status: "FILLED",
        executedPrice: markPrice.toString()
      },
      position: {
        id: result.position.id,
        status: "OPEN"
      },
      hedgeTaskId
    };
  }

  /**
   * 平仓
   */
  async closePosition(
    userId: string,
    positionId: string
  ): Promise<ClosePositionResult> {
    // 1. 获取仓位
    const position = await prisma.position.findFirst({
      where: {
        id: positionId,
        userId,
        status: "OPEN"
      }
    });

    if (!position) {
      throw new AppError("POSITION_NOT_FOUND", "Position not found or already closed", {
        statusCode: 404
      });
    }

    // 2. 获取当前价格
    const markPrice = await marketService.getMarkPrice(position.symbol);
    const leverage = this.getPositionLeverage(position);

    // 3. 计算 PnL
    // margin 使用 USDC (6 decimals)，需要转换为 USD 单位
    const marginInUsd = new Decimal(position.margin.toString()).div(new Decimal(1_000_000));
    const positionInput: PositionInput = {
      side: position.side,
      positionSize: new Decimal(position.positionSize.toString()),
      entryPrice: new Decimal(position.entryPrice.toString()),
      margin: marginInUsd,
      leverage
    };

    const marketInput: MarkPriceInput = { markPrice };
    const metrics = calculatePositionMetrics(positionInput, marketInput);

    const realizedPnl = metrics.unrealizedPnl;
    // PnL 以 USD 为单位，需要转换为 USDC (6 decimals) 才能与 margin 相加
    const realizedPnlInUsdc = realizedPnl.times(new Decimal(1_000_000));
    const cappedPnlInUsdc = Decimal.max(
      realizedPnlInUsdc,
      new Decimal(position.margin.toString()).negated()
    );
    const marginReturn = new Decimal(position.margin.toString()).plus(cappedPnlInUsdc);
    const balanceChange = BigInt(marginReturn.floor().toString());
    const hedgeTaskId = crypto.randomUUID();

    // 4. 事务：更新仓位、创建平仓订单、释放保证金
    const result = await prisma.$transaction(async (tx) => {
      // 创建平仓订单
      const order = await tx.order.create({
        data: {
          userId,
          positionId,
          symbol: position.symbol,
          side: position.side === "LONG" ? "SHORT" : "LONG", // 反向
          type: "MARKET",
          size: position.positionSize,
          margin: BigInt(0), // 平仓不需要额外保证金
          leverage,
          executedPrice: markPrice,
          status: "FILLED",
          filledAt: new Date(),
          metadata: {
            action: "CLOSE",
            closingPositionSide: position.side
          }
        }
      });

      // 更新仓位状态
      await tx.position.update({
        where: { id: positionId },
        data: {
          status: "CLOSED",
          unrealizedPnl: realizedPnl,
          markPrice,
          closedAt: new Date()
        }
      });

      // 获取账户
      const account = await tx.account.findUnique({
        where: {
          userId_asset: { userId, asset: "USDC" }
        }
      });

      if (!account) {
        throw new AppError("ACCOUNT_NOT_FOUND", "Account not found", {
          statusCode: 404
        });
      }

      // 释放保证金 + 结算盈亏
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          lockedBalance: { decrement: position.margin },
          availableBalance: { increment: balanceChange }
        }
      });

      // 创建保证金释放交易记录
      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: "MARGIN_RELEASE",
          amount: position.margin,
          status: "CONFIRMED"
        }
      });

      // 如果有盈亏，创建盈亏交易记录
      if (!cappedPnlInUsdc.isZero()) {
        await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: "REALIZED_PNL",
            amount: BigInt(cappedPnlInUsdc.abs().floor().toString()),
            status: "CONFIRMED"
          }
        });
      }

      const payload: HedgeJobData = {
        taskId: hedgeTaskId,
        source: "POSITION_CLOSE",
        userId,
        orderId: order.id,
        positionId,
        symbol: "BTC",
        side: position.side,
        size: position.positionSize.toString(),
        referencePrice: markPrice.toString(),
        priority: "NORMAL",
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: `hedge-close-${positionId}`,
        requestedAt: new Date().toISOString()
      };

      await tx.hedgeOrder.create({
        data: {
          taskId: hedgeTaskId,
          userId,
          orderId: order.id,
          positionId,
          symbol: position.symbol,
          side: position.side,
          size: position.positionSize,
          referencePrice: new Decimal(markPrice.toString()),
          trigger: "CLOSE",
          priority: 5,
          status: "PENDING",
          retryCount: 0,
          maxRetryCount: 3,
          payload
        }
      });

      return { order, updatedAccount, hedgePayload: payload };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    logger.info({
      msg: "Position closed",
      userId,
      positionId,
      orderId: result.order.id,
      realizedPnl: realizedPnl.toString(),
      markPrice: markPrice.toString()
    });

    // 推送仓位更新
    emitPositionUpdate(userId, {
      type: "POSITION_CLOSED",
      position: {
        id: positionId,
        symbol: position.symbol,
        realizedPnl: realizedPnl.toString(),
        status: "CLOSED"
      }
    });

    // 推送余额更新
    emitBalanceUpdate(userId, {
      availableBalance: result.updatedAccount.availableBalance.toString(),
      lockedBalance: result.updatedAccount.lockedBalance.toString(),
      totalBalance: (
        result.updatedAccount.availableBalance + result.updatedAccount.lockedBalance
      ).toString()
    });

    void this.enqueueHedgeTask(result.hedgePayload);

    return {
      order: {
        id: result.order.id,
        realizedPnl: realizedPnl.toString()
      },
      position: {
        id: positionId,
        status: "CLOSED"
      },
      hedgeTaskId
    };
  }

  /**
   * 清算仓位
   */
  async liquidatePosition(
    positionId: string,
    markPrice: Decimal
  ): Promise<void> {
    const position = await prisma.position.findUnique({
      where: { id: positionId }
    });

    if (!position || position.status !== "OPEN") {
      return;
    }

    logger.warn({
      msg: "Liquidating position",
      positionId,
      userId: position.userId,
      markPrice: markPrice.toString()
    });

    const hedgeTaskId = crypto.randomUUID();

    // 类似 closePosition，但标记为 LIQUIDATED
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: {
          userId_asset: { userId: position.userId, asset: "USDC" }
        }
      });

      await tx.position.update({
        where: { id: positionId },
        data: {
          status: "LIQUIDATED",
          markPrice,
          closedAt: new Date()
        }
      });

      await tx.account.update({
        where: {
          userId_asset: { userId: position.userId, asset: "USDC" }
        },
        data: {
          lockedBalance: { decrement: position.margin }
          // 清算时保证金损失
        }
      });

      await tx.transaction.create({
        data: {
          userId: position.userId,
          accountId: account?.id,
          type: "LIQUIDATION",
          amount: position.margin,
          status: "CONFIRMED"
        }
      });
      await tx.hedgeOrder.create({
        data: {
          taskId: hedgeTaskId,
          userId: position.userId,
          positionId,
          symbol: position.symbol,
          side: position.side,
          size: position.positionSize,
          referencePrice: new Decimal(markPrice.toString()),
          trigger: "LIQUIDATION",
          priority: 1,
          status: "PENDING",
          retryCount: 0,
          maxRetryCount: 3,
          payload: {
            taskId: hedgeTaskId,
            source: "LIQUIDATION",
            userId: position.userId,
            positionId,
            symbol: "BTC",
            side: position.side,
            size: position.positionSize.toString(),
            referencePrice: markPrice.toString(),
            priority: "HIGH",
            retryCount: 0,
            maxRetries: 3,
            idempotencyKey: `hedge-liquidation-${positionId}`,
            requestedAt: new Date().toISOString()
          }
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    // 推送清算更新
    emitPositionUpdate(position.userId, {
      type: "POSITION_LIQUIDATED",
      position: {
        id: positionId,
        symbol: position.symbol,
        status: "LIQUIDATED"
      }
    });

    await this.enqueueHedgeTask({
      taskId: hedgeTaskId,
      source: "LIQUIDATION",
      userId: position.userId,
      positionId,
      symbol: "BTC",
      side: position.side,
      size: position.positionSize.toString(),
      referencePrice: markPrice.toString(),
      priority: "HIGH",
      retryCount: 0,
      maxRetries: 3,
      idempotencyKey: `hedge-liquidation-${positionId}`,
      requestedAt: new Date().toISOString()
    });
  }

  /**
   * 获取仓位详情
   */
  async getPosition(userId: string, positionId: string) {
    const position = await prisma.position.findFirst({
      where: {
        id: positionId,
        userId
      }
    });

    if (!position) {
      return null;
    }

    return {
      id: position.id,
      userId: position.userId,
      symbol: position.symbol,
      side: position.side,
      positionSize: position.positionSize.toString(),
      entryPrice: position.entryPrice.toString(),
      markPrice: position.markPrice.toString(),
      unrealizedPnl: position.unrealizedPnl.toString(),
      liquidationPrice: position.liquidationPrice.toString(),
      margin: position.margin.toString(),
      status: position.status,
      riskLevel: position.riskLevel,
      openedAt: position.openedAt.toISOString(),
      closedAt: position.closedAt?.toISOString() ?? null,
      createdAt: position.createdAt.toISOString(),
      updatedAt: position.updatedAt.toISOString()
    };
  }
}

export const tradeEngine = new TradeEngine();
