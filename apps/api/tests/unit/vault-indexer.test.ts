import { beforeEach, describe, expect, it, vi } from "vitest";

const createPublicClientMock = vi.fn();

vi.mock("viem", () => ({
  createPublicClient: createPublicClientMock,
  http: vi.fn(() => ({}))
}));

vi.mock("viem/chains", () => ({
  arbitrumSepolia: {
    id: 421614,
    name: "Arbitrum Sepolia"
  },
  foundry: {
    id: 31337,
    name: "Foundry",
    rpcUrls: {
      default: { http: ["http://localhost:8545"] }
    }
  }
}));

vi.mock("../../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe("VaultIndexer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPublicClientMock.mockReturnValue({});
  });

  it("does not advance the cursor when processing a log fails", async () => {
    const { VaultIndexer } = await import("../../src/indexer/vault-indexer");

    const indexer = new VaultIndexer() as any;
    indexer.client = {
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      getLogs: vi
        .fn()
        .mockResolvedValueOnce([{ blockNumber: 5n, transactionHash: "0x1", logIndex: 0, args: {} }])
        .mockResolvedValueOnce([])
    };
    indexer.cursorManager = {
      getCursor: vi.fn().mockResolvedValue(5n),
      advanceCursor: vi.fn()
    };
    indexer.processDepositLog = vi.fn().mockRejectedValue(new Error("db unavailable"));
    indexer.processWithdrawLog = vi.fn();

    await expect(indexer.fetchAndProcessEvents()).rejects.toThrow("db unavailable");
    expect(indexer.cursorManager.advanceCursor).not.toHaveBeenCalled();
  });
});
