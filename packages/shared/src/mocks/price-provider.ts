import { z } from "zod";

import { decimalStringSchema, isoDateTimeSchema, marketSymbolSchema } from "../domain";

export const priceSnapshotSchema = z.object({
  symbol: marketSymbolSchema,
  markPrice: decimalStringSchema,
  indexPrice: decimalStringSchema,
  updatedAt: isoDateTimeSchema
});

export class MockPriceProvider {
  private readonly prices = new Map<string, number>([["BTC", 65000]]);

  setPrice(symbol: z.infer<typeof marketSymbolSchema>, price: number) {
    if (price <= 0) {
      throw new Error("Price must be positive");
    }

    this.prices.set(symbol, price);
  }

  moveByBps(symbol: z.infer<typeof marketSymbolSchema>, bpsDelta: number) {
    const currentPrice = this.prices.get(symbol) ?? 65000;
    const nextPrice = currentPrice * (1 + bpsDelta / 10_000);
    this.setPrice(symbol, Number(nextPrice.toFixed(2)));
  }

  async getSnapshot(symbol: z.infer<typeof marketSymbolSchema>) {
    const basePrice = this.prices.get(symbol) ?? 65000;
    const markPrice = basePrice.toFixed(2);

    return priceSnapshotSchema.parse({
      symbol,
      markPrice,
      indexPrice: markPrice,
      updatedAt: new Date().toISOString()
    });
  }

  async listSnapshots() {
    const snapshots = await Promise.all(
      [...this.prices.keys()].map((symbol) => this.getSnapshot(symbol as z.infer<typeof marketSymbolSchema>))
    );

    return snapshots;
  }
}

export type PriceSnapshot = z.infer<typeof priceSnapshotSchema>;
