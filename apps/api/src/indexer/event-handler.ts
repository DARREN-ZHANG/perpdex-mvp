// apps/api/src/indexer/event-handler.ts
/**
 * 事件处理器
 * 处理 Vault 合约的 Deposit/Withdraw 事件
 */
import { prisma } from "../db/client";
import { logger } from "../utils/logger";

/**
 * 创建链上事件幂等性 key
 * 格式: txHash:logIndex:eventName
 */
function createOnchainEventIdempotencyKey(
  event: { txHash: string; logIndex: number; eventName: string }
): string {
  return `${event.txHash.toLowerCase()}:${event.logIndex}:${event.eventName}`;
}

export interface DepositEvent {
  user: `0x${string}`;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface WithdrawEvent {
  user: `0x${string}`;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export class EventHandler {
  /**
   * 处理 Deposit 事件
   */
  async handleDeposit(event: DepositEvent): Promise<void> {
    const idempotencyKey = createOnchainEventIdempotencyKey({
      txHash: event.transactionHash,
      logIndex: event.logIndex,
      eventName: "DEPOSIT"
    });

    logger.info({
      msg: "Processing Deposit event",
      user: event.user,
      amount: event.amount.toString(),
      txHash: event.transactionHash,
      idempotencyKey
    });

    // 查找或创建用户
    const user = await prisma.user.upsert({
      where: { walletAddress: event.user.toLowerCase() },
      create: {
        walletAddress: event.user.toLowerCase()
      },
      update: {}
    });

    // 幂等检查
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey }
    });

    if (existingTx) {
      logger.debug({
        msg: "Deposit event already processed, skipping",
        idempotencyKey
      });
      return;
    }

    // 获取或创建账户
    const account = await prisma.account.upsert({
      where: {
        userId_asset: {
          userId: user.id,
          asset: "USDC"
        }
      },
      create: {
        userId: user.id,
        asset: "USDC",
        availableBalance: BigInt(0),
        lockedBalance: BigInt(0),
        equity: BigInt(0)
      },
      update: {}
    });

    // 事务：更新余额 + 创建交易记录
    await prisma.$transaction(async (tx) => {
      // 增加可用余额
      await tx.account.update({
        where: { id: account.id },
        data: {
          availableBalance: { increment: event.amount },
          equity: { increment: event.amount }
        }
      });

      // 创建交易记录
      await tx.transaction.create({
        data: {
          userId: user.id,
          accountId: account.id,
          type: "DEPOSIT",
          eventName: "DEPOSIT",
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          amount: event.amount,
          status: "CONFIRMED",
          idempotencyKey,
          confirmedAt: new Date()
        }
      });
    });

    logger.info({
      msg: "Deposit event processed successfully",
      userId: user.id,
      amount: event.amount.toString(),
      txHash: event.transactionHash
    });
  }

  /**
   * 处理 Withdraw 事件
   */
  async handleWithdraw(event: WithdrawEvent): Promise<void> {
    const idempotencyKey = createOnchainEventIdempotencyKey({
      txHash: event.transactionHash,
      logIndex: event.logIndex,
      eventName: "WITHdraw"
    });

    logger.info({
      msg: "Processing Withdraw event",
      user: event.user,
      amount: event.amount.toString(),
      txHash: event.transactionHash,
      idempotencyKey
    });

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { walletAddress: event.user.toLowerCase() }
    });

    if (!user) {
      logger.warn({
        msg: "User not found for Withdraw event, skipping",
        walletAddress: event.user
      });
      return;
    }

    // 幂等检查
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey }
    });

    if (existingTx) {
      logger.debug({
        msg: "Withdraw event already processed, skipping",
        idempotencyKey
      });
      return;
    }

    // 获取账户
    const account = await prisma.account.findUnique({
      where: {
        userId_asset: {
          userId: user.id,
          asset: "USDC"
        }
      }
    });

    if (!account) {
      logger.warn({
        msg: "Account not found for Withdraw event",
        userId: user.id
      });
      return;
    }

    // 事务：更新余额 + 更新交易状态
    await prisma.$transaction(async (tx) => {
      // 释放锁定余额（提现在请求时已锁定）
      await tx.account.update({
        where: { id: account.id },
        data: {
          lockedBalance: { decrement: event.amount },
          equity: { decrement: event.amount }
        }
      });

      // 查找并更新对应的提现请求
      const pendingWithdraw = await tx.transaction.findFirst({
        where: {
          userId: user.id,
          type: "WITHDRAW",
          status: "PENDING",
          amount: event.amount
        },
        orderBy: { createdAt: "desc" }
      });

      if (pendingWithdraw) {
        await tx.transaction.update({
          where: { id: pendingWithdraw.id },
          data: {
            txHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
            status: "CONFIRMED",
            confirmedAt: new Date()
          }
        });
      } else {
        // 创建新的交易记录（如果没有对应的 pending 请求）
        await tx.transaction.create({
          data: {
            userId: user.id,
            accountId: account.id,
            type: "WITHDRAW",
            eventName: "WITHDRAW",
            txHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
            amount: event.amount,
            status: "CONFIRMED",
            idempotencyKey,
            confirmedAt: new Date()
          }
        });
      }
    });

    logger.info({
      msg: "Withdraw event processed successfully",
      userId: user.id,
      amount: event.amount.toString(),
      txHash: event.transactionHash
    });
  }
}
