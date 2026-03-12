import { z } from "zod";

import {
  decimalStringSchema,
  hedgePrioritySchema,
  hedgeStatusSchema,
  idSchema,
  isoDateTimeSchema,
  marketSymbolSchema,
  orderSideSchema
} from "./domain";

export const hedgeTaskSourceSchema = z.enum(["orderFill", "positionClose", "marginAdjust", "liquidation"]);

export const hedgeQueueNames = {
  execute: "hedge.execute",
  deadLetter: "hedge.dlq"
} as const;

export const hedgePriorityValues = {
  high: 1,
  normal: 5,
  low: 10
} as const;

export const hedgeTaskPayloadSchema = z.object({
  taskId: idSchema,
  source: hedgeTaskSourceSchema,
  userId: idSchema,
  orderId: idSchema.optional(),
  positionId: idSchema.optional(),
  symbol: marketSymbolSchema,
  side: orderSideSchema,
  size: decimalStringSchema,
  referencePrice: decimalStringSchema,
  priority: hedgePrioritySchema.default("normal"),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().positive().default(3),
  idempotencyKey: z.string().min(1),
  requestedAt: isoDateTimeSchema
});

export const hedgeTaskResultSchema = z.object({
  taskId: idSchema,
  status: hedgeStatusSchema,
  externalOrderId: z.string().min(1).optional(),
  averagePrice: decimalStringSchema.optional(),
  filledAt: isoDateTimeSchema.optional(),
  errorMessage: z.string().min(1).optional()
});

export const hedgeTaskSummarySchema = hedgeTaskPayloadSchema.pick({
  taskId: true,
  symbol: true,
  side: true,
  size: true,
  priority: true,
  retryCount: true,
  maxRetries: true
}).extend({
  status: hedgeStatusSchema,
  externalOrderId: z.string().min(1).optional(),
  updatedAt: isoDateTimeSchema,
  lastErrorMessage: z.string().min(1).optional()
});

export const hedgeStatusTransitions = {
  pending: ["submitted", "failed"],
  submitted: ["filled", "failed"],
  filled: [],
  failed: []
} as const;

export function canTransitionHedgeStatus(
  from: z.infer<typeof hedgeStatusSchema>,
  to: z.infer<typeof hedgeStatusSchema>
) {
  return (hedgeStatusTransitions[from] as readonly string[]).includes(to);
}

export type HedgeTaskPayload = z.infer<typeof hedgeTaskPayloadSchema>;
export type HedgeTaskResult = z.infer<typeof hedgeTaskResultSchema>;
export type HedgeTaskSummary = z.infer<typeof hedgeTaskSummarySchema>;
