import { z } from "zod";

export const supportedMarketSymbols = ["BTC"] as const;

export const idSchema = z.string().min(1);
export const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");
export const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");
export const signatureSchema = z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature");
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const uintStringSchema = z.string().regex(/^\d+$/, "Expected an unsigned integer string");
export const usdcAmountStringSchema = uintStringSchema;
export const decimalStringSchema = z.string().regex(/^\d+(\.\d{1,18})?$/, "Expected a positive decimal string");
export const signedDecimalStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,18})?$/, "Expected a signed decimal string");
export const chainIdSchema = z.number().int().positive();
export const leverageSchema = z.number().int().min(1).max(20);
export const marketSymbolSchema = z.enum(supportedMarketSymbols);
export const orderSideSchema = z.enum(["long", "short"]);
export const orderTypeSchema = z.enum(["market"]);
export const orderStatusSchema = z.enum(["pending", "filled", "failed", "canceled"]);
export const positionStatusSchema = z.enum(["open", "closed", "liquidated"]);
export const riskLevelSchema = z.enum(["safe", "warning", "danger"]);
export const transactionTypeSchema = z.enum([
  "deposit",
  "withdraw",
  "marginLock",
  "marginRelease",
  "realizedPnl",
  "fee",
  "liquidation"
]);
export const transactionStatusSchema = z.enum(["pending", "confirmed", "failed", "reverted"]);
export const chainEventNameSchema = z.enum(["Deposit", "Withdraw"]);
export const hedgeStatusSchema = z.enum(["pending", "submitted", "filled", "failed"]);
export const hedgePrioritySchema = z.enum(["high", "normal", "low"]);
export const hedgeTriggerSchema = z.enum(["open", "close", "marginAdjust", "liquidation", "manual"]);
export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20)
});

export const userSchema = z.object({
  id: idSchema,
  walletAddress: walletAddressSchema,
  nonce: z.string().min(8).optional(),
  nonceExpiresAt: isoDateTimeSchema.nullable().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastLoginAt: isoDateTimeSchema.nullable().optional()
});

export const accountBalanceSchema = z.object({
  userId: idSchema,
  asset: z.literal("USDC"),
  availableBalance: usdcAmountStringSchema,
  lockedBalance: usdcAmountStringSchema,
  equity: usdcAmountStringSchema,
  updatedAt: isoDateTimeSchema
});

export const orderSchema = z.object({
  id: idSchema,
  userId: idSchema,
  positionId: idSchema.optional(),
  clientOrderId: z.string().min(1).optional(),
  symbol: marketSymbolSchema,
  side: orderSideSchema,
  type: orderTypeSchema,
  size: decimalStringSchema,
  requestedPrice: decimalStringSchema.optional(),
  executedPrice: decimalStringSchema.optional(),
  margin: usdcAmountStringSchema,
  leverage: leverageSchema,
  status: orderStatusSchema,
  failureCode: z.string().min(1).optional(),
  failureMessage: z.string().min(1).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  filledAt: isoDateTimeSchema.nullable().optional()
});

export const positionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  symbol: marketSymbolSchema,
  side: orderSideSchema,
  positionSize: decimalStringSchema,
  entryPrice: decimalStringSchema,
  markPrice: decimalStringSchema,
  unrealizedPnl: signedDecimalStringSchema,
  liquidationPrice: decimalStringSchema,
  margin: usdcAmountStringSchema,
  status: positionStatusSchema,
  riskLevel: riskLevelSchema,
  openedAt: isoDateTimeSchema,
  closedAt: isoDateTimeSchema.nullable().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const transactionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  type: transactionTypeSchema,
  eventName: chainEventNameSchema.nullable().optional(),
  txHash: txHashSchema.nullable().optional(),
  logIndex: z.number().int().nonnegative().nullable().optional(),
  amount: usdcAmountStringSchema,
  status: transactionStatusSchema,
  idempotencyKey: z.string().min(1).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  confirmedAt: isoDateTimeSchema.nullable().optional()
});

export type AccountBalance = z.infer<typeof accountBalanceSchema>;
export type HedgePriority = z.infer<typeof hedgePrioritySchema>;
export type HedgeStatus = z.infer<typeof hedgeStatusSchema>;
export type MarketSymbol = z.infer<typeof marketSymbolSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderSide = z.infer<typeof orderSideSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type User = z.infer<typeof userSchema>;
