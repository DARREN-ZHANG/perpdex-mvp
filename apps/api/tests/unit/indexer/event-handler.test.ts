// apps/api/tests/unit/indexer/event-handler.test.ts
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { prisma } from "../../../src/db/client";
import { EventHandler, type DepositEvent, type WithdrawEvent } from "../../../src/indexer/event-handler";

describe("EventHandler", () => {
  const handler = new EventHandler();

  const mockDepositEvent: DepositEvent = {
    user: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    amount: BigInt("1000000"), // 1 USDC
    blockNumber: BigInt("12345"),
    transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`,
    logIndex: 0
  };

  const mockWithdrawEvent: WithdrawEvent = {
    user: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    amount: BigInt("500000"), // 0.5 USDC
    blockNumber: BigInt("12346"),
    transactionHash: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321" as `0x${string}`,
    logIndex: 0
  };

  beforeEach(async () => {
    // 清理测试数据
    await prisma.transaction.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("handleDeposit", () => {
    it("should create user and account on first deposit", async () => {
      await handler.handleDeposit(mockDepositEvent);

      const user = await prisma.user.findUnique({
        where: { walletAddress: mockDepositEvent.user.toLowerCase() }
      });

      expect(user).not.toBeNull();

      const account = await prisma.account.findUnique({
        where: {
          userId_asset: { userId: user!.id, asset: "USDC" }
        }
      });

      expect(account).not.toBeNull();
      expect(account!.availableBalance.toString()).toBe("1000000");
    });

    it("should be idempotent - same event processed only once", async () => {
      await handler.handleDeposit(mockDepositEvent);
      await handler.handleDeposit(mockDepositEvent); // 第二次

      const transactions = await prisma.transaction.findMany();
      expect(transactions.length).toBe(1);
    });

    it("should accumulate balance on multiple deposits", async () => {
      await handler.handleDeposit(mockDepositEvent);

      const event2: DepositEvent = {
        ...mockDepositEvent,
        amount: BigInt("2000000"),
        transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`,
        logIndex: 1
      };
      await handler.handleDeposit(event2);

      const user = await prisma.user.findUnique({
        where: { walletAddress: mockDepositEvent.user.toLowerCase() },
        include: { accounts: true }
      });

      expect(user!.accounts[0].availableBalance.toString()).toBe("3000000");
    });
  });

  describe("handleWithdraw", () => {
    it("should handle withdraw event", async () => {
      // 先存入
      await handler.handleDeposit(mockDepositEvent);

      // 再提取
      await handler.handleWithdraw(mockWithdrawEvent);

      const user = await prisma.user.findUnique({
        where: { walletAddress: mockDepositEvent.user.toLowerCase() },
        include: { accounts: true }
      });

      // 锁定余额应该减少（因为提现是释放锁定余额）
      expect(user!.accounts[0].lockedBalance.toString()).toBe("-500000");
      expect(user!.accounts[0].equity.toString()).toBe("500000");
    });

    it("should be idempotent for withdraw", async () => {
      await handler.handleDeposit(mockDepositEvent);
      await handler.handleWithdraw(mockWithdrawEvent);
      await handler.handleWithdraw(mockWithdrawEvent); // 重复

      const transactions = await prisma.transaction.findMany({
        where: { type: "WITHDRAW" }
      });

      // 只应该有一条 WITHDRAW 记录
      const confirmedWithdraws = transactions.filter(t => t.status === "CONFIRMED");
      expect(confirmedWithdraws.length).toBe(1);
    });

    it("should skip withdraw if user not found", async () => {
      // 用户不存在的情况下应该不会抛出错误
      await expect(handler.handleWithdraw(mockWithdrawEvent)).resolves.not.toThrow();

      // 应该没有任何用户被创建
      const users = await prisma.user.findMany();
      expect(users.length).toBe(0);
    });
  });
});
