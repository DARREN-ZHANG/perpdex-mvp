import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockData, mockPrismaClient, resetMockData } from "../__mocks__/prisma";
import { createMockAccount, mockUser } from "../__mocks__/test-fixtures";

vi.mock("../../src/db/client", () => ({
  prisma: mockPrismaClient
}));

const executeWithdrawMock = vi.fn();
const waitForTransactionMock = vi.fn();

vi.mock("../../src/clients/blockchain", () => ({
  blockchainClient: {
    executeWithdraw: executeWithdrawMock,
    waitForTransaction: waitForTransactionMock
  }
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

let WithdrawService: typeof import("../../src/services/withdraw.service").WithdrawService;

beforeAll(async () => {
  ({ WithdrawService } = await import("../../src/services/withdraw.service"));
});

describe("WithdrawService", () => {
  let accountId: string;

  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();

    const account = createMockAccount({
      userId: mockUser.id,
      availableBalance: "1000000",
      lockedBalance: "0"
    });
    accountId = account.id;

    mockData.accounts.set(account.id, account);
  });

  it("fails the reservation when the balance was consumed before the transactional update", async () => {
    const service = new WithdrawService();
    const originalTransactionImpl = mockPrismaClient.$transaction.getMockImplementation();

    mockPrismaClient.$transaction.mockImplementationOnce(async (input: any) => {
      mockData.accounts.set(accountId, {
        ...mockData.accounts.get(accountId)!,
        availableBalance: 0n
      });
      return originalTransactionImpl!(input) as Promise<unknown>;
    });

    await expect(
      service.requestWithdrawal(
        mockUser.id,
        mockUser.walletAddress,
        500000n
      )
    ).rejects.toThrow("Insufficient available balance");
  });

  it("reserves withdrawals from available balance without touching locked margin", async () => {
    const service = new WithdrawService();

    mockData.accounts.set(accountId, {
      ...mockData.accounts.get(accountId)!,
      availableBalance: 1000000n,
      lockedBalance: 300000n
    });

    executeWithdrawMock.mockResolvedValueOnce("0xhash");
    waitForTransactionMock.mockResolvedValueOnce("confirmed");

    const result = await service.requestWithdrawal(
      mockUser.id,
      mockUser.walletAddress,
      500000n
    );

    expect(result.status).toBe("PENDING");
    expect(mockData.accounts.get(accountId)?.availableBalance).toBe(500000n);
    expect(mockData.accounts.get(accountId)?.lockedBalance).toBe(300000n);
  });

  it("keeps the withdrawal pending when on-chain submission succeeded but receipt lookup is inconclusive", async () => {
    const service = new WithdrawService();

    mockData.transactions.set("tx_1", {
      id: "tx_1",
      userId: mockUser.id,
      accountId,
      type: "WITHDRAW",
      eventName: null,
      txHash: null,
      logIndex: null,
      blockNumber: null,
      amount: 500000n,
      status: "PENDING",
      idempotencyKey: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      confirmedAt: null
    });

    mockData.accounts.set(accountId, {
      ...mockData.accounts.get(accountId)!,
      availableBalance: 500000n,
      lockedBalance: 0n
    });

    executeWithdrawMock.mockResolvedValueOnce("0xhash");
    waitForTransactionMock.mockRejectedValueOnce(new Error("rpc timeout"));

    await (service as any).executeOnchainWithdraw(
      "tx_1",
      mockUser.walletAddress,
      500000n
    );

    expect(mockData.transactions.get("tx_1")?.status).toBe("PENDING");
    expect(mockData.transactions.get("tx_1")?.txHash).toBe("0xhash");
    expect(mockData.transactions.get("tx_1")?.metadata).toEqual({
      confirmationState: "UNKNOWN",
      lastError: "rpc timeout",
      txHash: "0xhash"
    });
    expect(mockData.accounts.get(accountId)?.availableBalance).toBe(500000n);
    expect(mockData.accounts.get(accountId)?.lockedBalance).toBe(0n);
  });
});
