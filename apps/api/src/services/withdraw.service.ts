// apps/api/src/services/withdraw.service.ts
/**
 * 提现服务
 * 处理提现请求校验和链上执行
 */
import { prisma } from "../db/client";
import { blockchainClient } from "../clients/blockchain";
import { logger } from "../utils/logger";
import type { Address } from "viem";

export interface WithdrawResult {
  transactionId: string;
  txHash?: string;
  status: string;
}

/**
 * 提现服务类
 */
export class WithdrawService {
  /**
   * 创建提现请求
   */
  async requestWithdrawal(
    userId: string,
    walletAddress: string,
    amount: bigint
  ): Promise<WithdrawResult> {
    // 1. 校验金额
    if (amount <= 0n) {
      throw new Error("Withdrawal amount must be positive");
    }

    // 2. 获取账户余额
    const account = await prisma.account.findUnique({
      where: {
        userId_asset: {
          userId,
          asset: "USDC"
        }
      }
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // 3. 检查可用余额
    if (account.availableBalance < amount) {
      throw new Error("Insufficient available balance");
    }

    // 4. 预扣余额（事务）
    const transaction = await prisma.$transaction(async (tx) => {
      // 锁定余额
      await tx.account.update({
        where: { id: account.id },
        data: {
          availableBalance: { decrement: amount },
          lockedBalance: { increment: amount }
        }
      });

      // 创建提现交易记录
      return tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: "WITHDRAW",
          amount,
          status: "PENDING"
        }
      });
    });

    logger.info({
      msg: "Withdrawal request created",
      userId,
      transactionId: transaction.id,
      amount: amount.toString()
    });

    // 5. 异步执行链上提现（不阻塞响应）
    this.executeOnchainWithdraw(
      transaction.id,
      walletAddress,
      amount
    ).catch((error) => {
      logger.error({
        msg: "Onchain withdraw failed",
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    });

    return {
      transactionId: transaction.id,
      status: "PENDING"
    };
  }

  /**
   * 执行链上提现（异步）
   */
  private async executeOnchainWithdraw(
    transactionId: string,
    walletAddress: string,
    amount: bigint
  ): Promise<void> {
    try {
      // 执行链上提现
      const txHash = await blockchainClient.executeWithdraw(
        walletAddress as Address,
        amount
      );

      // 更新交易状态
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          txHash,
          status: "PENDING" // 等待 Indexer 确认
        }
      });

      // 等待交易确认
      const result = await blockchainClient.waitForTransaction(txHash);

      if (result === "reverted") {
        await this.handleWithdrawalFailure(transactionId, "Transaction reverted");
      }
    } catch (error) {
      await this.handleWithdrawalFailure(
        transactionId,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * 处理提现失败，回滚余额
   */
  private async handleWithdrawalFailure(
    transactionId: string,
    errorMessage: string
  ): Promise<void> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { account: true }
    });

    if (!transaction || !transaction.account) {
      return;
    }

    // 回滚余额
    await prisma.$transaction([
      prisma.account.update({
        where: { id: transaction.account.id },
        data: {
          availableBalance: { increment: transaction.amount },
          lockedBalance: { decrement: transaction.amount }
        }
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "FAILED",
          metadata: { error: errorMessage }
        }
      })
    ]);

    logger.error({
      msg: "Withdrawal failed, balance rolled back",
      transactionId,
      error: errorMessage
    });
  }
}
