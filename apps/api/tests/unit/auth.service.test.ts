import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  account: {
    upsert: vi.fn()
  }
};

const verifySiweSignatureMock = vi.fn();
const signJwtMock = vi.fn(() => "signed-jwt");

vi.mock("../../src/db/client", () => ({
  prisma: prismaMock
}));

vi.mock("../../src/utils/siwe", () => ({
  buildSiweUri: (domain: string) => `http://${domain}`,
  generateSiweMessage: vi.fn(),
  verifySiweSignature: verifySiweSignatureMock
}));

vi.mock("../../src/utils/jwt", () => ({
  signJwt: signJwtMock
}));

describe("AuthService.verifySignature", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user_1",
      walletAddress: "0x1234567890123456789012345678901234567890",
      nonce: "nonce12345678",
      nonceExpiresAt: new Date(Date.now() + 60_000),
      lastLoginAt: null
    });
    prismaMock.user.update.mockResolvedValue(undefined);
    prismaMock.account.upsert.mockResolvedValue(undefined);
    verifySiweSignatureMock.mockResolvedValue({
      address: "0x1234567890123456789012345678901234567890",
      nonce: "nonce12345678",
      chainId: 421614,
      domain: "localhost:3001",
      uri: "http://localhost:3001",
      expirationTime: new Date(Date.now() + 60_000).toISOString()
    });
  });

  it("rejects signatures whose SIWE payload nonce does not match the issued challenge", async () => {
    const { AuthService } = await import("../../src/services/auth.service");

    verifySiweSignatureMock.mockResolvedValueOnce({
      address: "0x1234567890123456789012345678901234567890",
      nonce: "differentNonce999",
      chainId: 421614,
      domain: "localhost:3001",
      uri: "http://localhost:3001",
      expirationTime: new Date(Date.now() + 60_000).toISOString()
    });

    const service = new AuthService({} as never);

    await expect(
      service.verifySignature({
        walletAddress: "0x1234567890123456789012345678901234567890",
        chainId: 421614,
        nonce: "nonce12345678",
        message: "signed-message",
        signature: "0xsig"
      })
    ).rejects.toThrow("SIWE nonce mismatch.");

    expect(signJwtMock).not.toHaveBeenCalled();
  });

  it("rejects signatures for a different domain", async () => {
    const { AuthService } = await import("../../src/services/auth.service");

    verifySiweSignatureMock.mockResolvedValueOnce({
      address: "0x1234567890123456789012345678901234567890",
      nonce: "nonce12345678",
      chainId: 421614,
      domain: "evil.example",
      uri: "http://evil.example",
      expirationTime: new Date(Date.now() + 60_000).toISOString()
    });

    const service = new AuthService({} as never);

    await expect(
      service.verifySignature({
        walletAddress: "0x1234567890123456789012345678901234567890",
        chainId: 421614,
        nonce: "nonce12345678",
        message: "signed-message",
        signature: "0xsig"
      })
    ).rejects.toThrow("SIWE domain mismatch.");
  });
});
