import { z } from "zod";

import {
  decimalStringSchema,
  hedgeStatusSchema,
  idSchema,
  isoDateTimeSchema,
  marketSymbolSchema,
  orderSideSchema
} from "../domain";

export const mockHyperliquidOrderInputSchema = z.object({
  symbol: marketSymbolSchema,
  side: orderSideSchema,
  size: decimalStringSchema,
  referencePrice: decimalStringSchema.optional(),
  reduceOnly: z.boolean().default(false)
});

export const mockHyperliquidOrderSchema = z.object({
  orderId: idSchema,
  symbol: marketSymbolSchema,
  side: orderSideSchema,
  size: decimalStringSchema,
  status: hedgeStatusSchema,
  averagePrice: decimalStringSchema.optional(),
  errorMessage: z.string().min(1).optional(),
  submittedAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

type MockHyperliquidOrder = z.infer<typeof mockHyperliquidOrderSchema>;

export class MockHyperliquidClient {
  private readonly orders = new Map<string, MockHyperliquidOrder>();
  private nextFailureMessage: string | null = null;

  constructor(private readonly autoFill = true) {}

  queueFailure(message = "Mock Hyperliquid rejection") {
    this.nextFailureMessage = message;
  }

  async submitMarketOrder(input: z.input<typeof mockHyperliquidOrderInputSchema>) {
    const parsedInput = mockHyperliquidOrderInputSchema.parse(input);
    const orderId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();

    if (this.nextFailureMessage) {
      const failedOrder = mockHyperliquidOrderSchema.parse({
        orderId,
        symbol: parsedInput.symbol,
        side: parsedInput.side,
        size: parsedInput.size,
        status: "FAILED",
        errorMessage: this.nextFailureMessage,
        submittedAt,
        updatedAt: submittedAt
      });

      this.nextFailureMessage = null;
      this.orders.set(orderId, failedOrder);
      return failedOrder;
    }

    const order = mockHyperliquidOrderSchema.parse({
      orderId,
      symbol: parsedInput.symbol,
      side: parsedInput.side,
      size: parsedInput.size,
      status: this.autoFill ? "FILLED" : "SUBMITTED",
      averagePrice: parsedInput.referencePrice ?? "65000.00",
      submittedAt,
      updatedAt: submittedAt
    });

    this.orders.set(orderId, order);
    return order;
  }

  async getOrder(orderId: string) {
    const order = this.orders.get(orderId);

    if (!order) {
      return null;
    }

    return mockHyperliquidOrderSchema.parse(order);
  }

  async listOrders() {
    return [...this.orders.values()].map((order) => mockHyperliquidOrderSchema.parse(order));
  }
}
