// apps/api/src/services/withdraw.service.ts
/**
 * 提现服务
 * 处理提现请求校验和链上执行
 */
import { prisma } from "../db/client";
import { blockchainClient } from "../clients/blockchain";
import { logger } from "../utils/logger";
import type { Address } from "viem";
import { AppError } from "../errors/app-error";

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
      throw new AppError("INSUFFICIENT_BALANCE", "Insufficient available balance");
    }

    // 4. 预扣余额（事务）
    const transaction = await prisma.$transaction(async (tx) => {
      const reservedAccount = await tx.account.updateMany({
        where: {
          id: account.id,
          availableBalance: { gte: amount }
        },
        data: {
          // 提现只占用可用余额，不能污染交易保证金锁仓。
          availableBalance: { decrement: amount }
        }
      });

      if (reservedAccount.count !== 1) {
        throw new AppError("INSUFFICIENT_BALANCE", "Insufficient available balance");
      }

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
    let txHash: string;

    try {
      txHash = await blockchainClient.executeWithdraw(
        walletAddress as Address,
        amount
      );
    } catch (error) {
      await this.handleWithdrawalFailure(
        transactionId,
        error instanceof Error ? error.message : "Unknown error"
      );
      return;
    }

    try {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          txHash
        }
      });
    } catch (error) {
      logger.error({
        msg: "Failed to persist withdrawal tx hash; keeping request pending for manual reconciliation",
        transactionId,
        txHash,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return;
    }

    try {
      const result = await blockchainClient.waitForTransaction(txHash);

      if (result === "reverted") {
        await this.handleWithdrawalFailure(transactionId, "Transaction reverted");
      }
    } catch (error) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          metadata: {
            confirmationState: "UNKNOWN",
            lastError: error instanceof Error ? error.message : "Unknown error",
            txHash
          }
        }
      });

      logger.warn({
        msg: "Withdrawal confirmation status is unknown; request remains pending",
        transactionId,
        txHash,
        error: error instanceof Error ? error.message : "Unknown error"
      });
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

    if (transaction.status !== "PENDING") {
      logger.warn({
        msg: "Skipping withdrawal rollback for non-pending transaction",
        transactionId,
        status: transaction.status
      });
      return;
    }

    // 回滚余额
    await prisma.$transaction([
      prisma.account.update({
        where: { id: transaction.account.id },
        data: {
          availableBalance: { increment: transaction.amount }
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
