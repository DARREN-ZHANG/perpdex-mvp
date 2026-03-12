// apps/api/src/services/auth.service.ts
/**
 * 鉴权服务
 * 处理 SIWE 登录流程
 */
import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client";
import {
  generateSiweMessage,
  verifySiweSignature,
  type GenerateSiweInput,
  type VerifySiweInput
} from "../utils/siwe";
import { signJwt } from "../utils/jwt";
import { config } from "../config/index";

export interface ChallengeInput {
  walletAddress: string;
  chainId?: number;
}

export interface ChallengeResult {
  walletAddress: string;
  chainId: number;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

export interface VerifyInput {
  walletAddress: string;
  chainId: number;
  nonce: string;
  message: string;
  signature: string;
}

export interface VerifyResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  user: {
    id: string;
    walletAddress: string;
    lastLoginAt: string | null;
  };
}

export interface SessionResult {
  authenticated: boolean;
  user: {
    id: string;
    walletAddress: string;
    lastLoginAt: string | null;
  } | null;
}

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async createChallenge(input: ChallengeInput): Promise<ChallengeResult> {
    const chainId = input.chainId ?? config.siwe.chainId;
    const nonce = crypto.randomUUID().replace(/-/g, "");

    // Upsert user with nonce
    const user = await prisma.user.upsert({
      where: { walletAddress: input.walletAddress.toLowerCase() },
      create: {
        walletAddress: input.walletAddress.toLowerCase(),
        nonce,
        nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      },
      update: {
        nonce,
        nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });

    const siweResult = generateSiweMessage({
      walletAddress: input.walletAddress,
      nonce: user.nonce!,
      chainId,
      domain: config.siwe.domain
    });

    return {
      walletAddress: input.walletAddress,
      chainId,
      nonce: user.nonce!,
      message: siweResult.message,
      issuedAt: siweResult.issuedAt.toISOString(),
      expiresAt: siweResult.expiresAt.toISOString()
    };
  }

  async verifySignature(input: VerifyInput): Promise<VerifyResult> {
    // Find user by wallet address
    const user = await prisma.user.findUnique({
      where: { walletAddress: input.walletAddress.toLowerCase() }
    });

    if (!user) {
      throw new Error("User not found. Please request a challenge first.");
    }

    if (!user.nonce || user.nonce !== input.nonce) {
      throw new Error("Invalid nonce. Please request a new challenge.");
    }

    if (user.nonceExpiresAt && user.nonceExpiresAt < new Date()) {
      throw new Error("Challenge expired. Please request a new challenge.");
    }

    // Verify SIWE signature
    const siweResult = await verifySiweSignature({
      message: input.message,
      signature: input.signature
    });

    if (siweResult.address.toLowerCase() !== input.walletAddress.toLowerCase()) {
      throw new Error("Signature address mismatch.");
    }

    // Calculate token expiration (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Generate JWT
    const accessToken = signJwt(this.app, {
      userId: user.id,
      walletAddress: user.walletAddress
    });

    // Update user: clear nonce, set last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nonce: null,
        nonceExpiresAt: null,
        lastLoginAt: new Date()
      }
    });

    // Ensure user has an account
    await prisma.account.upsert({
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

    return {
      accessToken,
      tokenType: "Bearer",
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null
      }
    };
  }

  async getSession(userId: string): Promise<SessionResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return {
        authenticated: false,
        user: null
      };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null
      }
    };
  }

  async logout(userId: string): Promise<{ success: boolean }> {
    // In a full implementation, you would add the token to a blacklist in Redis
    // For MVP, we just return success
    return { success: true };
  }
}
