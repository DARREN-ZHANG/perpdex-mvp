// tests/unit/siwe.test.ts
/**
 * SIWE 工具函数单元测试
 */
import { describe, it, expect } from "vitest";
import { generateSiweMessage, verifySiweSignature } from "../../src/utils/siwe";

describe("SIWE Utils", () => {
  describe("generateSiweMessage", () => {
    it("should generate a valid SIWE message", () => {
      // SIWE nonce 要求：至少 8 个字母数字字符
      const nonce = "testNce12345678";
      const result = generateSiweMessage({
        walletAddress: "0x1234567890123456789012345678901234567890",
        nonce,
        chainId: 421614,
        domain: "localhost:3001"
      });

      expect(result.message).toContain("localhost:3001");
      expect(result.message).toContain(
        "0x1234567890123456789012345678901234567890"
      );
      expect(result.message).toContain(nonce);
      expect(result.message).toContain("421614");
    });

    it("should include correct expiration time", () => {
      const nonce = "testNce12345678";
      const result = generateSiweMessage({
        walletAddress: "0x1234567890123456789012345678901234567890",
        nonce,
        chainId: 421614,
        domain: "localhost:3001"
      });

      expect(result.expiresAt).toBeInstanceOf(Date);
      // Expiration should be 5 minutes in the future
      const now = Date.now();
      const expectedExpiry = now + 5 * 60 * 1000;
      const diff = Math.abs(result.expiresAt.getTime() - expectedExpiry);
      expect(diff).toBeLessThan(1000); // Within 1 second tolerance
    });

    it("should use the provided nonce", () => {
      const nonce1 = "nonceOne12345678";
      const result1 = generateSiweMessage({
        walletAddress: "0x1234567890123456789012345678901234567890",
        nonce: nonce1,
        chainId: 421614,
        domain: "localhost:3001"
      });

      const nonce2 = "nonceTwo123456789";
      const result2 = generateSiweMessage({
        walletAddress: "0x1234567890123456789012345678901234567890",
        nonce: nonce2,
        chainId: 421614,
        domain: "localhost:3001"
      });

      expect(result1.nonce).toBe(nonce1);
      expect(result2.nonce).toBe(nonce2);
    });
  });

  describe("verifySiweSignature", () => {
    it("should reject invalid signature format", async () => {
      await expect(
        verifySiweSignature({
          message: "test message",
          signature: "invalid-signature"
        })
      ).rejects.toThrow();
    });

    it("should reject malformed SIWE message", async () => {
      await expect(
        verifySiweSignature({
          message: "not a valid SIWE message",
          signature:
            "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234"
        })
      ).rejects.toThrow();
    });
  });
});
