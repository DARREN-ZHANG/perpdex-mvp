import { z } from "zod";

import {
  accountBalanceSchema,
  chainIdSchema,
  decimalStringSchema,
  hedgePrioritySchema,
  hedgeStatusSchema,
  idSchema,
  isoDateTimeSchema,
  leverageSchema,
  marketSymbolSchema,
  orderSchema,
  orderSideSchema,
  paginationQuerySchema,
  positionSchema,
  transactionSchema,
  transactionStatusSchema,
  transactionTypeSchema,
  txHashSchema,
  usdcAmountStringSchema,
  userSchema,
  walletAddressSchema
} from "./domain";
import { hedgeTaskSummarySchema } from "./hedge";

export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "INSUFFICIENT_BALANCE",
  "POSITION_NOT_FOUND",
  "ORDER_EXECUTION_FAILED",
  "RISK_LIMIT_EXCEEDED",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE"
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  requestId: z.string().min(1).optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export const responseMetaSchema = z.object({
  requestId: z.string().min(1).optional(),
  nextCursor: z.string().min(1).optional()
});

export const createSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    error: z.null(),
    meta: responseMetaSchema.optional()
  });

export const errorResponseSchema = z.object({
  data: z.null(),
  error: apiErrorSchema,
  meta: responseMetaSchema.optional()
});

const sessionUserSchema = userSchema.pick({
  id: true,
  walletAddress: true,
  lastLoginAt: true
});

export const authChallengeQuerySchema = z.object({
  walletAddress: walletAddressSchema,
  chainId: chainIdSchema.default(421614)
});

export const authChallengePayloadSchema = z.object({
  walletAddress: walletAddressSchema,
  chainId: chainIdSchema,
  nonce: z.string().min(8),
  message: z.string().min(1),
  issuedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema
});

export const authVerifyRequestSchema = z.object({
  walletAddress: walletAddressSchema,
  chainId: chainIdSchema.default(421614),
  nonce: z.string().min(8),
  message: z.string().min(1),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/)
});

export const authVerifyPayloadSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  expiresAt: isoDateTimeSchema,
  user: sessionUserSchema
});

export const authSessionPayloadSchema = z.object({
  authenticated: z.boolean(),
  user: sessionUserSchema.nullable()
});

export const authLogoutPayloadSchema = z.object({
  success: z.literal(true)
});

export const historyQuerySchema = paginationQuerySchema.extend({
  type: transactionTypeSchema.optional()
});

export const withdrawRequestSchema = z.object({
  amount: usdcAmountStringSchema
});

export const withdrawPayloadSchema = z.object({
  transactionId: idSchema,
  txHash: txHashSchema.optional(),
  status: transactionStatusSchema
});

export const createOrderRequestSchema = z.object({
  symbol: marketSymbolSchema,
  side: orderSideSchema,
  size: decimalStringSchema,
  margin: usdcAmountStringSchema,
  leverage: leverageSchema,
  requestedPrice: decimalStringSchema.optional(),
  clientOrderId: z.string().min(1).optional()
});

export const createOrderPayloadSchema = z.object({
  order: orderSchema,
  position: positionSchema.optional(),
  hedgeTaskId: idSchema.optional()
});

export const positionIdParamsSchema = z.object({
  id: idSchema
});

export const adjustMarginRequestSchema = z.object({
  amount: usdcAmountStringSchema,
  operation: z.enum(["add", "remove"])
});

export const adjustMarginPayloadSchema = z.object({
  position: positionSchema,
  account: accountBalanceSchema
});

export const closePositionPayloadSchema = z.object({
  order: orderSchema,
  position: positionSchema.nullable(),
  hedgeTaskId: idSchema.optional()
});

export const marketSnapshotSchema = z.object({
  symbol: marketSymbolSchema,
  markPrice: decimalStringSchema,
  indexPrice: decimalStringSchema,
  change24h: z.string(),
  openInterest: decimalStringSchema,
  updatedAt: isoDateTimeSchema
});

export const marketDetailsPayloadSchema = z.object({
  market: marketSnapshotSchema,
  fundingRate: z.string().optional(),
  nextFundingAt: isoDateTimeSchema.optional()
});

export const healthPayloadSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  timestamp: isoDateTimeSchema,
  services: z.object({
    api: z.enum(["ok", "down"]),
    db: z.enum(["ok", "down", "unknown"]),
    redis: z.enum(["ok", "down", "unknown"]),
    chain: z.enum(["ok", "down", "unknown"]),
    hyperliquid: z.enum(["ok", "down", "unknown"])
  })
});

export const hedgeTaskListQuerySchema = paginationQuerySchema.extend({
  status: hedgeStatusSchema.optional(),
  priority: hedgePrioritySchema.optional()
});

export const apiContract = {
  auth: {
    challenge: {
      method: "GET",
      path: "/api/auth/challenge",
      query: authChallengeQuerySchema,
      response: createSuccessResponseSchema(authChallengePayloadSchema),
      error: errorResponseSchema
    },
    verify: {
      method: "POST",
      path: "/api/auth/verify",
      body: authVerifyRequestSchema,
      response: createSuccessResponseSchema(authVerifyPayloadSchema),
      error: errorResponseSchema
    },
    session: {
      method: "GET",
      path: "/api/auth/session",
      response: createSuccessResponseSchema(authSessionPayloadSchema),
      error: errorResponseSchema
    },
    logout: {
      method: "POST",
      path: "/api/auth/logout",
      response: createSuccessResponseSchema(authLogoutPayloadSchema),
      error: errorResponseSchema
    }
  },
  user: {
    balance: {
      method: "GET",
      path: "/api/user/balance",
      response: createSuccessResponseSchema(accountBalanceSchema),
      error: errorResponseSchema
    },
    positions: {
      method: "GET",
      path: "/api/user/positions",
      response: createSuccessResponseSchema(z.object({ items: z.array(positionSchema) })),
      error: errorResponseSchema
    },
    history: {
      method: "GET",
      path: "/api/user/history",
      query: historyQuerySchema,
      response: createSuccessResponseSchema(z.object({ items: z.array(transactionSchema) })),
      error: errorResponseSchema
    },
    withdraw: {
      method: "POST",
      path: "/api/user/withdraw",
      body: withdrawRequestSchema,
      response: createSuccessResponseSchema(withdrawPayloadSchema),
      error: errorResponseSchema
    }
  },
  trade: {
    createOrder: {
      method: "POST",
      path: "/api/trade/order",
      body: createOrderRequestSchema,
      response: createSuccessResponseSchema(createOrderPayloadSchema),
      error: errorResponseSchema
    },
    getPosition: {
      method: "GET",
      path: "/api/trade/positions/:id",
      params: positionIdParamsSchema,
      response: createSuccessResponseSchema(positionSchema),
      error: errorResponseSchema
    },
    adjustMargin: {
      method: "PATCH",
      path: "/api/trade/positions/:id/margin",
      params: positionIdParamsSchema,
      body: adjustMarginRequestSchema,
      response: createSuccessResponseSchema(adjustMarginPayloadSchema),
      error: errorResponseSchema
    },
    closePosition: {
      method: "DELETE",
      path: "/api/trade/positions/:id",
      params: positionIdParamsSchema,
      response: createSuccessResponseSchema(closePositionPayloadSchema),
      error: errorResponseSchema
    }
  },
  market: {
    list: {
      method: "GET",
      path: "/api/markets",
      response: createSuccessResponseSchema(z.object({ items: z.array(marketSnapshotSchema) })),
      error: errorResponseSchema
    },
    detail: {
      method: "GET",
      path: "/api/markets/:symbol",
      params: z.object({ symbol: marketSymbolSchema }),
      response: createSuccessResponseSchema(marketDetailsPayloadSchema),
      error: errorResponseSchema
    }
  },
  system: {
    health: {
      method: "GET",
      path: "/api/health",
      response: createSuccessResponseSchema(healthPayloadSchema),
      error: errorResponseSchema
    },
    hedgeTasks: {
      method: "GET",
      path: "/api/hedge/tasks",
      query: hedgeTaskListQuerySchema,
      response: createSuccessResponseSchema(z.object({ items: z.array(hedgeTaskSummarySchema) })),
      error: errorResponseSchema
    }
  }
} as const;

export type ApiContract = typeof apiContract;
