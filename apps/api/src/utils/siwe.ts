// apps/api/src/utils/siwe.ts
/**
 * SIWE (Sign-In with Ethereum) 工具函数
 * 用于生成和验证 SIWE 消息
 */
import { SiweMessage } from "siwe";

export interface GenerateSiweInput {
  walletAddress: string;
  nonce: string;
  chainId: number;
  domain: string;
}

export interface GenerateSiweResult {
  message: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface VerifySiweInput {
  message: string;
  signature: string;
}

export interface VerifySiweResult {
  address: string;
  nonce: string;
  chainId: number;
}

/**
 * 生成 SIWE 消息
 */
export function generateSiweMessage(input: GenerateSiweInput): GenerateSiweResult {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000); // 5 minutes

  const siweMessage = new SiweMessage({
    domain: input.domain,
    address: input.walletAddress,
    statement: "Sign in with Ethereum to the app.",
    uri: `http://${input.domain}`,
    version: "1",
    chainId: input.chainId,
    nonce: input.nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expiresAt.toISOString()
  });

  return {
    message: siweMessage.prepareMessage(),
    nonce: input.nonce,
    issuedAt,
    expiresAt
  };
}

/**
 * 验证 SIWE 签名
 */
export async function verifySiweSignature(input: VerifySiweInput): Promise<VerifySiweResult> {
  // Parse the SIWE message from string
  const siweMessage = new SiweMessage(input.message);

  // Verify the signature
  const result = await siweMessage.verify({
    signature: input.signature
  });

  if (!result.success) {
    throw new Error("SIWE signature verification failed");
  }

  return {
    address: result.data.address,
    nonce: result.data.nonce ?? "",
    chainId: result.data.chainId ?? 1
  };
}
