// apps/api/tests/engines/pnl-calculator.test.ts
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  calculateUnrealizedPnl,
  calculateLiquidationPrice,
  calculateRiskLevel,
  calculatePositionMetrics,
  shouldLiquidate
} from "../../src/engines/pnl-calculator";

describe("PnL Calculator", () => {
  describe("calculateUnrealizedPnl", () => {
    it("should calculate profit for LONG position when price rises", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("55000") };

      const result = calculateUnrealizedPnl(position, market);

      // Profit = (55000 - 50000) * 1 = 5000 USDC
      expect(result.unrealizedPnl.toFixed(0)).toBe("5000");
      // PnL% = 5000 / 5000 = 100%
      expect(result.unrealizedPnlPercent.toFixed(0)).toBe("100");
    });

    it("should calculate loss for LONG position when price falls", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("45000") };

      const result = calculateUnrealizedPnl(position, market);

      // Loss = (45000 - 50000) * 1 = -5000 USDC
      expect(result.unrealizedPnl.toFixed(0)).toBe("-5000");
    });

    it("should calculate profit for SHORT position when price falls", () => {
      const position = {
        side: "SHORT" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("45000") };

      const result = calculateUnrealizedPnl(position, market);

      // Profit = (50000 - 45000) * 1 = 5000 USDC
      expect(result.unrealizedPnl.toFixed(0)).toBe("5000");
    });

    it("should calculate loss for SHORT position when price rises", () => {
      const position = {
        side: "SHORT" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("55000") };

      const result = calculateUnrealizedPnl(position, market);

      // Loss = (50000 - 55000) * 1 = -5000 USDC
      expect(result.unrealizedPnl.toFixed(0)).toBe("-5000");
    });

    it("should handle zero margin without division by zero", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("0"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("55000") };

      const result = calculateUnrealizedPnl(position, market);

      expect(result.unrealizedPnl.toFixed(0)).toBe("5000");
      expect(result.unrealizedPnlPercent.toFixed(0)).toBe("0");
    });
  });

  describe("calculateLiquidationPrice", () => {
    it("should calculate liquidation price for LONG below entry", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };

      const result = calculateLiquidationPrice(position);

      // liqPrice = 50000 * (1 - 0.1 + 0.005) = 50000 * 0.905 = 45250
      expect(result.liquidationPrice.toFixed(0)).toBe("45250");
    });

    it("should calculate liquidation price for SHORT above entry", () => {
      const position = {
        side: "SHORT" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };

      const result = calculateLiquidationPrice(position);

      // liqPrice = 50000 * (1 + 0.1 - 0.005) = 50000 * 1.095 = 54750
      expect(result.liquidationPrice.toFixed(0)).toBe("54750");
    });

    it("should calculate liquidation distance for LONG", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };

      const result = calculateLiquidationPrice(position);

      // distance = |45250 - 50000| / 50000 * 100 = 9.5%
      expect(result.liquidationDistance.toFixed(1)).toBe("9.5");
    });

    it("should return positive liquidation price even with extreme values", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("100"),
        margin: new Decimal("1"),
        leverage: 100
      };

      const result = calculateLiquidationPrice(position);

      expect(result.liquidationPrice.toNumber()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateRiskLevel", () => {
    it("should return SAFE when margin ratio > 10%", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("10000"), // 20% margin
        leverage: 5
      };
      const market = { markPrice: new Decimal("50000") };

      const result = calculateRiskLevel(position, market);

      expect(result.riskLevel).toBe("SAFE");
      expect(result.marginRatio.gt(0.10)).toBe(true);
    });

    it("should return WARNING when margin ratio between 5-10%", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("47500") }; // 5% loss

      const result = calculateRiskLevel(position, market);

      expect(result.riskLevel).toBe("WARNING");
    });

    it("should return DANGER when margin ratio <= 5%", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("2500"),
        leverage: 20
      };
      const market = { markPrice: new Decimal("47500") }; // 5% drop

      const result = calculateRiskLevel(position, market);

      expect(result.riskLevel).toBe("DANGER");
    });

    it("should account for unrealized PnL in margin calculation", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("47000") }; // 6% loss

      const result = calculateRiskLevel(position, market);

      // Effective margin = 5000 - 3000 = 2000
      // Margin ratio = 2000 / 47000 = ~4.26% -> DANGER
      expect(result.riskLevel).toBe("DANGER");
    });
  });

  describe("calculatePositionMetrics", () => {
    it("should calculate all metrics for a LONG position", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("55000") };

      const result = calculatePositionMetrics(position, market);

      expect(result.unrealizedPnl.toFixed(0)).toBe("5000");
      expect(result.notionalValue.toFixed(0)).toBe("55000");
      expect(result.effectiveLeverage.toFixed(2)).toBe("5.50"); // 55000 / (5000 + 5000)
      expect(result.riskLevel).toBe("SAFE");
    });

    it("should calculate all metrics for a SHORT position", () => {
      const position = {
        side: "SHORT" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("5000"),
        leverage: 10
      };
      const market = { markPrice: new Decimal("45000") };

      const result = calculatePositionMetrics(position, market);

      expect(result.unrealizedPnl.toFixed(0)).toBe("5000");
      expect(result.notionalValue.toFixed(0)).toBe("45000");
      expect(result.liquidationPrice.toFixed(0)).toBe("54750");
    });
  });

  describe("shouldLiquidate", () => {
    it("should return true when margin is exhausted", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("2500"),
        leverage: 20
      };
      const market = { markPrice: new Decimal("45000") }; // 10% drop, margin = 0

      const result = shouldLiquidate(position, market);

      expect(result).toBe(true);
    });

    it("should return false when margin is sufficient", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("10000"),
        leverage: 5
      };
      const market = { markPrice: new Decimal("49000") };

      const result = shouldLiquidate(position, market);

      expect(result).toBe(false);
    });

    it("should return false for profitable position", () => {
      const position = {
        side: "LONG" as const,
        positionSize: new Decimal("1"),
        entryPrice: new Decimal("50000"),
        margin: new Decimal("2500"),
        leverage: 20
      };
      const market = { markPrice: new Decimal("55000") }; // 10% profit

      const result = shouldLiquidate(position, market);

      expect(result).toBe(false);
    });
  });
});
