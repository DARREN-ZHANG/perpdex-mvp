import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockData, mockPrismaClient, resetMockData } from "../../__mocks__/prisma";

vi.mock("../../../src/db/client", () => ({
  prisma: mockPrismaClient
}));

vi.mock("../../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

let EventHandler: typeof import("../../../src/indexer/event-handler").EventHandler;

beforeAll(async () => {
  ({ EventHandler } = await import("../../../src/indexer/event-handler"));
});

describe("EventHandler", () => {
  const mockDepositEvent = {
    user: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    amount: 1000000n,
    blockNumber: 12345n,
    transactionHash:
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`,
    logIndex: 0
  };

  const mockWithdrawEvent = {
    user: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    amount: 500000n,
    blockNumber: 12346n,
    transactionHash:
      "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321" as `0x${string}`,
    logIndex: 0
  };

  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();
  });

  describe("handleDeposit", () => {
    it("creates user and account on first deposit", async () => {
      const handler = new EventHandler();

      await handler.handleDeposit(mockDepositEvent);

      const user = Array.from(mockData.users.values()).find(
        (item) => item.walletAddress === mockDepositEvent.user.toLowerCase()
      );
      const account = Array.from(mockData.accounts.values()).find(
        (item) => item.userId === user?.id && item.asset === "USDC"
      );

      expect(user).toBeDefined();
      expect(account?.availableBalance.toString()).toBe("1000000");
    });

    it("is idempotent for the same deposit log", async () => {
      const handler = new EventHandler();

      await handler.handleDeposit(mockDepositEvent);
      await handler.handleDeposit(mockDepositEvent);

      expect(Array.from(mockData.transactions.values())).toHaveLength(1);
    });
  });

  describe("handleWithdraw", () => {
    it("confirms a matching pending withdraw without releasing trade margin", async () => {
      const handler = new EventHandler();

      await handler.handleDeposit(mockDepositEvent);

      const user = Array.from(mockData.users.values())[0];
      const account = Array.from(mockData.accounts.values())[0];

      mockData.accounts.set(account.id, {
        ...account,
        availableBalance: 500000n,
        lockedBalance: 250000n,
        equity: 1000000n
      });
      mockData.transactions.set("withdraw_pending", {
        id: "withdraw_pending",
        userId: user.id,
        accountId: account.id,
        type: "WITHDRAW",
        eventName: null,
        txHash: mockWithdrawEvent.transactionHash,
        logIndex: null,
        blockNumber: null,
        amount: mockWithdrawEvent.amount,
        status: "PENDING",
        idempotencyKey: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmedAt: null
      });

      await handler.handleWithdraw(mockWithdrawEvent);

      expect(mockData.accounts.get(account.id)?.availableBalance).toBe(500000n);
      expect(mockData.accounts.get(account.id)?.lockedBalance).toBe(250000n);
      expect(mockData.accounts.get(account.id)?.equity).toBe(500000n);
      expect(mockData.transactions.get("withdraw_pending")?.status).toBe("CONFIRMED");
    });

    it("skips withdraws for unknown users", async () => {
      const handler = new EventHandler();

      await expect(handler.handleWithdraw(mockWithdrawEvent)).resolves.not.toThrow();
      expect(mockData.users.size).toBe(0);
      expect(mockData.transactions.size).toBe(0);
    });
  });
});
