import { z } from "zod";

import {
  chainEventNameSchema,
  chainIdSchema,
  idSchema,
  isoDateTimeSchema,
  transactionStatusSchema,
  transactionTypeSchema,
  txHashSchema,
  uintStringSchema,
  usdcAmountStringSchema,
  walletAddressSchema
} from "./domain";

export const onchainEventIdempotencyFields = ["txHash", "logIndex", "eventName"] as const;

export const onchainEventRecordSchema = z.object({
  chainId: chainIdSchema,
  blockNumber: uintStringSchema,
  txHash: txHashSchema,
  logIndex: z.number().int().nonnegative(),
  eventName: chainEventNameSchema,
  user: walletAddressSchema,
  amount: usdcAmountStringSchema,
  status: transactionStatusSchema,
  observedAt: isoDateTimeSchema
});

export const onchainLedgerMutationSchema = z.object({
  idempotencyKey: z.string().min(1),
  userId: idSchema,
  accountId: idSchema.optional(),
  transactionType: transactionTypeSchema,
  event: onchainEventRecordSchema
});

export function createOnchainEventIdempotencyKey(
  event: Pick<z.infer<typeof onchainEventRecordSchema>, "txHash" | "logIndex" | "eventName">
) {
  return `${event.txHash.toLowerCase()}:${event.logIndex}:${event.eventName}`;
}

export type OnchainEventRecord = z.infer<typeof onchainEventRecordSchema>;
export type OnchainLedgerMutation = z.infer<typeof onchainLedgerMutationSchema>;
