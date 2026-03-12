import { z } from "zod";

import { idSchema, isoDateTimeSchema, walletAddressSchema } from "../domain";

export const mockAuthChallengeSchema = z.object({
  walletAddress: walletAddressSchema,
  nonce: z.string().min(8),
  message: z.string().min(1),
  issuedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema
});

export const mockAuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  userId: idSchema,
  walletAddress: walletAddressSchema,
  issuedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  revokedAt: isoDateTimeSchema.optional()
});

type MockAuthChallenge = z.infer<typeof mockAuthChallengeSchema>;
type MockAuthSession = z.infer<typeof mockAuthSessionSchema>;

export class MockAuthSessionManager {
  private readonly challenges = new Map<string, MockAuthChallenge>();
  private readonly sessions = new Map<string, MockAuthSession>();

  issueChallenge(walletAddress: string) {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);

    const challenge = mockAuthChallengeSchema.parse({
      walletAddress,
      nonce: crypto.randomUUID().replace(/-/g, ""),
      message: `PerpDex mock sign-in for ${walletAddress}`,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    });

    this.challenges.set(walletAddress.toLowerCase(), challenge);
    return challenge;
  }

  verify(input: { walletAddress: string; nonce: string; signature: string; userId?: string }) {
    const walletAddress = input.walletAddress.toLowerCase();
    const challenge = this.challenges.get(walletAddress);

    if (!challenge) {
      throw new Error("Mock challenge not found");
    }

    if (challenge.nonce !== input.nonce) {
      throw new Error("Mock nonce mismatch");
    }

    if (!input.signature.trim()) {
      throw new Error("Mock signature is required");
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000);

    const session = mockAuthSessionSchema.parse({
      accessToken: `mock_${crypto.randomUUID()}`,
      userId: input.userId ?? crypto.randomUUID(),
      walletAddress: input.walletAddress,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString()
    });

    this.challenges.delete(walletAddress);
    this.sessions.set(session.accessToken, session);
    return session;
  }

  getSession(accessToken: string) {
    return this.sessions.get(accessToken) ?? null;
  }

  revoke(accessToken: string) {
    const session = this.sessions.get(accessToken);

    if (!session) {
      return false;
    }

    this.sessions.set(accessToken, {
      ...session,
      revokedAt: new Date().toISOString()
    });
    return true;
  }
}
