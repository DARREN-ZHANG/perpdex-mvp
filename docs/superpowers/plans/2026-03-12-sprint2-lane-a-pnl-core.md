# Sprint 2 泳道 A: 计算核心实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PnL/保证金/清算价计算模块和清算巡检任务

**Architecture:** 纯计算函数（无副作用）+ 定时巡检任务。PnL 计算器是交易引擎的核心依赖，清算巡检在 Phase 2 等待 Trade Engine 完成后开发。

**Tech Stack:** TypeScript, Decimal.js, Prisma, node-cron

**Dependency:** 仅依赖 T02 Schema（已完成 ✅）

**Deliverables:**
- `engines/pnl-calculator.ts` - PnL/保证金/清算价计算
- `jobs/liquidation-check.ts` - 清算巡检任务（Phase 2）

---

## File Structure

```
apps/api/src/
├── engines/
│   └── pnl-calculator.ts     # PnL 计算模块
├── jobs/
│   └── liquidation-check.ts  # 清算巡检任务
└── types/
    └── index.ts              # 添加相关类型
```

---

## Chunk 1: PnL 计算模块

### Task 1: PnL Calculator - 核心计算函数

**Files:**
- Create: `apps/api/src/engines/pnl-calculator.ts`
- Test: `apps/api/src/engines/__tests__/pnl-calculator.test.ts`

#### Step 1: 安装 Decimal.js 依赖

```bash
cd apps/api && pnpm add decimal.js && pnpm add -D @types/decimal.js
```

- [ ] **Run installation command**

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/apps/api && pnpm add decimal.js`

#### Step 2: 定义类型接口

**File:** `apps/api/src/engines/pnl-calculator.ts`

```typescript
// apps/api/src/engines/pnl-calculator.ts
/**
 * PnL 计算模块
 * 提供仓位盈亏、清算价格、风险等级的计算
 */
import Decimal from "decimal.js";

// 配置 Decimal.js
Decimal.set({ precision: 18, rounding: Decimal.ROUND_DOWN });

export interface PositionInput {
  side: "LONG" | "SHORT";
  positionSize: Decimal; // 合约张数 (以 BTC 计)
  entryPrice: Decimal;   // 开仓均价 (USD)
  margin: Decimal;       // 保证金 (USDC, 6 decimals)
  leverage: number;      // 杠杆倍数
}

export interface MarkPriceInput {
  markPrice: Decimal;    // 当前标记价格 (USD)
}

export interface PnLResult {
  unrealizedPnl: Decimal;      // 未实现盈亏 (USDC)
  unrealizedPnlPercent: Decimal; // 未实现盈亏百分比
  roe: Decimal;                // ROE (Return on Equity)
}

export interface LiquidationResult {
  liquidationPrice: Decimal;   // 清算价格 (USD)
  liquidationDistance: Decimal; // 距离清算的价格距离百分比
}

export interface RiskResult {
  riskLevel: "SAFE" | "WARNING" | "DANGER";
  marginRatio: Decimal;        // 保证金率
}

export interface PositionMetrics extends PnLResult, LiquidationResult, RiskResult {
  notionalValue: Decimal;      // 名义价值 (USD)
  effectiveLeverage: Decimal;  // 有效杠杆
}
```

- [ ] **Write type definitions to file**

#### Step 3: 实现 PnL 计算

**File:** `apps/api/src/engines/pnl-calculator.ts` (继续)

```typescript
/**
 * 计算未实现盈亏
 * Long: (markPrice - entryPrice) * positionSize
 * Short: (entryPrice - markPrice) * positionSize
 */
export function calculateUnrealizedPnl(
  position: PositionInput,
  market: MarkPriceInput
): PnLResult {
  const { side, positionSize, entryPrice, margin } = position;
  const { markPrice } = market;

  let pnl: Decimal;
  if (side === "LONG") {
    pnl = markPrice.minus(entryPrice).times(positionSize);
  } else {
    pnl = entryPrice.minus(markPrice).times(positionSize);
  }

  const pnlPercent = margin.isZero() ? new Decimal(0) : pnl.div(margin);
  const roe = pnlPercent; // ROE = PnL / Margin

  return {
    unrealizedPnl: pnl,
    unrealizedPnlPercent: pnlPercent.times(100),
    roe
  };
}
```

- [ ] **Write PnL calculation function**

#### Step 4: 实现清算价格计算

**File:** `apps/api/src/engines/pnl-calculator.ts` (继续)

```typescript
/**
 * 计算清算价格
 * 当保证金 + 未实现盈亏 <= 维持保证金时触发清算
 * 维持保证金率 = 0.5% (MVP 简化，可配置)
 *
 * Long: liqPrice = entryPrice * (1 - (margin / notional) + maintenanceRate)
 * Short: liqPrice = entryPrice * (1 + (margin / notional) - maintenanceRate)
 */
const MAINTENANCE_MARGIN_RATE = 0.005; // 0.5%

export function calculateLiquidationPrice(
  position: PositionInput
): LiquidationResult {
  const { side, positionSize, entryPrice, margin, leverage } = position;

  const notional = positionSize.times(entryPrice);
  const marginRatio = margin.div(notional);
  const maintenanceRatio = new Decimal(MAINTENANCE_MARGIN_RATE);

  let liquidationPrice: Decimal;

  if (side === "LONG") {
    // Long: price drops -> loss
    // liqPrice = entryPrice * (1 - marginRatio + maintenanceRatio)
    liquidationPrice = entryPrice.times(
      new Decimal(1).minus(marginRatio).plus(maintenanceRatio)
    );
  } else {
    // Short: price rises -> loss
    // liqPrice = entryPrice * (1 + marginRatio - maintenanceRatio)
    liquidationPrice = entryPrice.times(
      new Decimal(1).plus(marginRatio).minus(maintenanceRatio)
    );
  }

  // 确保清算价格为正
  liquidationPrice = Decimal.max(liquidationPrice, new Decimal(0));

  const distance = entryPrice.isZero()
    ? new Decimal(0)
    : liquidationPrice.minus(entryPrice).div(entryPrice).abs().times(100);

  return {
    liquidationPrice,
    liquidationDistance: distance
  };
}
```

- [ ] **Write liquidation price calculation**

#### Step 5: 实现风险等级计算

**File:** `apps/api/src/engines/pnl-calculator.ts` (继续)

```typescript
/**
 * 计算风险等级
 * SAFE: marginRatio > 10%
 * WARNING: marginRatio > 5% && <= 10%
 * DANGER: marginRatio <= 5%
 */
const WARNING_THRESHOLD = 0.10; // 10%
const DANGER_THRESHOLD = 0.05;  // 5%

export function calculateRiskLevel(
  position: PositionInput,
  market: MarkPriceInput
): RiskResult {
  const { positionSize, entryPrice, margin } = position;
  const { markPrice } = market;

  const pnl = calculateUnrealizedPnl(position, market);
  const effectiveMargin = margin.plus(pnl.unrealizedPnl);
  const notional = positionSize.times(markPrice);

  const marginRatio = notional.isZero()
    ? new Decimal(1)
    : effectiveMargin.div(notional);

  let riskLevel: "SAFE" | "WARNING" | "DANGER";
  if (marginRatio.lte(DANGER_THRESHOLD)) {
    riskLevel = "DANGER";
  } else if (marginRatio.lte(WARNING_THRESHOLD)) {
    riskLevel = "WARNING";
  } else {
    riskLevel = "SAFE";
  }

  return {
    riskLevel,
    marginRatio
  };
}
```

- ] **Write risk level calculation**

#### Step 6: 实现综合计算函数

**File:** `apps/api/src/engines/pnl-calculator.ts` (继续)

```typescript
/**
 * 计算所有仓位指标
 */
export function calculatePositionMetrics(
  position: PositionInput,
  market: MarkPriceInput
): PositionMetrics {
  const pnl = calculateUnrealizedPnl(position, market);
  const liq = calculateLiquidationPrice(position);
  const risk = calculateRiskLevel(position, market);

  const notionalValue = position.positionSize.times(market.markPrice);
  const effectiveLeverage = position.margin.isZero()
    ? new Decimal(0)
    : notionalValue.div(position.margin.plus(pnl.unrealizedPnl));

  return {
    ...pnl,
    ...liq,
    ...risk,
    notionalValue,
    effectiveLeverage
  };
}

/**
 * 检查是否应该触发清算
 */
export function shouldLiquidate(
  position: PositionInput,
  market: MarkPriceInput
): boolean {
  const risk = calculateRiskLevel(position, market);
  return risk.riskLevel === "DANGER" && risk.marginRatio.lte(0);
}
```

- [ ] **Write combined metrics and liquidation check**

#### Step 7: 导出所有函数

**File:** `apps/api/src/engines/pnl-calculator.ts` (末尾)

```typescript
export default {
  calculateUnrealizedPnl,
  calculateLiquidationPrice,
  calculateRiskLevel,
  calculatePositionMetrics,
  shouldLiquidate
};
```

- [ ] **Add export statement**

#### Step 8: 编写单元测试

**File:** `apps/api/src/engines/__tests__/pnl-calculator.test.ts`

```typescript
// apps/api/src/engines/__tests__/pnl-calculator.test.ts
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  calculateUnrealizedPnl,
  calculateLiquidationPrice,
  calculateRiskLevel,
  calculatePositionMetrics,
  shouldLiquidate
} from "../pnl-calculator";

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
  });
});
```

- [ ] **Write unit tests**

#### Step 9: 运行测试验证

Run: `cd /Users/xlzj/Desktop/Projects/perp-dex-mvp/apps/api && pnpm test engines/__tests__/pnl-calculator.test.ts`

Expected: All tests pass

- [ ] **Run tests and verify they pass**

#### Step 10: 提交

```bash
git add apps/api/src/engines/pnl-calculator.ts apps/api/src/engines/__tests__/pnl-calculator.test.ts
git commit -m "feat(api): add PnL calculator module with tests"
```

- [ ] **Commit PnL calculator**

---

## Chunk 2: 清算巡检任务（Phase 2 - 等待 Trade Engine）

> **注意:** 此任务依赖 Trade Engine (T40) 完成。在 T40 完成前，先完成 Chunk 1。

### Task 2: Liquidation Check Job

**Files:**
- Create: `apps/api/src/jobs/liquidation-check.ts`
- Create: `apps/api/src/jobs/index.ts`

**前置条件:** Trade Engine 已实现 `liquidatePosition` 方法

#### Step 1: 创建清算巡检任务

**File:** `apps/api/src/jobs/liquidation-check.ts`

```typescript
// apps/api/src/jobs/liquidation-check.ts
/**
 * 清算巡检任务
 * 定期扫描所有开放仓位，检查是否需要清算
 */
import cron from "node-cron";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { Decimal } from "@prisma/client/runtime/library";
import {
  calculateRiskLevel,
  shouldLiquidate,
  type PositionInput,
  type MarkPriceInput
} from "../engines/pnl-calculator";
// import { tradeEngine } from "../engines/trade-engine"; // T40 完成后启用

const LIQUIDATION_CHECK_INTERVAL = "*/2 * * * * *"; // 每 2 秒

export interface LiquidationCheckResult {
  checked: number;
  liquidated: number;
  warnings: number;
  errors: number;
}

async function fetchOpenPositions() {
  return prisma.position.findMany({
    where: { status: "OPEN" },
    include: { user: true }
  });
}

async function getMarkPrice(_symbol: string): Promise<Decimal> {
  // TODO: 从价格服务或 Hyperliquid 获取实时价格
  // 临时返回 mock 数据
  return new Decimal("50000");
}

export async function runLiquidationCheck(): Promise<LiquidationCheckResult> {
  const result: LiquidationCheckResult = {
    checked: 0,
    liquidated: 0,
    warnings: 0,
    errors: 0
  };

  try {
    const positions = await fetchOpenPositions();
    result.checked = positions.length;

    for (const position of positions) {
      try {
        const markPrice = await getMarkPrice(position.symbol);

        const positionInput: PositionInput = {
          side: position.side,
          positionSize: new Decimal(position.positionSize),
          entryPrice: new Decimal(position.entryPrice),
          margin: new Decimal(position.margin.toString()),
          leverage: 10 // TODO: 从 position 获取
        };

        const marketInput: MarkPriceInput = {
          markPrice
        };

        // 检查风险等级
        const risk = calculateRiskLevel(positionInput, marketInput);

        // 更新仓位风险等级
        if (risk.riskLevel !== position.riskLevel) {
          await prisma.position.update({
            where: { id: position.id },
            data: { riskLevel: risk.riskLevel }
          });

          if (risk.riskLevel === "WARNING" || risk.riskLevel === "DANGER") {
            result.warnings++;
            logger.warn({
              msg: "Position risk level changed",
              positionId: position.id,
              userId: position.userId,
              riskLevel: risk.riskLevel,
              marginRatio: risk.marginRatio.toString()
            });
          }
        }

        // 检查是否需要清算
        if (shouldLiquidate(positionInput, marketInput)) {
          logger.info({
            msg: "Liquidating position",
            positionId: position.id,
            userId: position.userId
          });

          // TODO: 调用 Trade Engine 执行清算
          // await tradeEngine.liquidatePosition(position.id, markPrice);
          result.liquidated++;
        }
      } catch (error) {
        result.errors++;
        logger.error({
          msg: "Error checking position for liquidation",
          positionId: position.id,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  } catch (error) {
    logger.error({
      msg: "Liquidation check failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }

  return result;
}

export function startLiquidationScheduler(): cron.ScheduledTask {
  logger.info({ msg: "Starting liquidation scheduler", interval: LIQUIDATION_CHECK_INTERVAL });

  return cron.schedule(LIQUIDATION_CHECK_INTERVAL, async () => {
    const result = await runLiquidationCheck();

    if (result.checked > 0 || result.liquidated > 0) {
      logger.info({
        msg: "Liquidation check completed",
        ...result
      });
    }
  });
}
```

- [ ] **Write liquidation check job**

#### Step 2: 创建 jobs 入口文件

**File:** `apps/api/src/jobs/index.ts`

```typescript
// apps/api/src/jobs/index.ts
/**
 * 定时任务入口
 */
export { runLiquidationCheck, startLiquidationScheduler } from "./liquidation-check";
```

- [ ] **Write jobs index file**

#### Step 3: 提交清算任务

```bash
git add apps/api/src/jobs/
git commit -m "feat(api): add liquidation check job"
```

- [ ] **Commit liquidation job**

---

## Acceptance Criteria

- [ ] PnL 计算模块所有测试通过
- [ ] 清算价格计算正确（Long 在下方，Short 在上方）
- [ ] 风险等级判定符合阈值要求
- [ ] 清算巡检任务能定时扫描仓位
- [ ] 代码符合项目编码规范

## Notes

- PnL 计算是纯函数，无副作用，可独立测试
- 清算任务需要等待 Trade Engine 完成后才能完整测试
- 维持保证金率暂时硬编码为 0.5%，后续可配置化
