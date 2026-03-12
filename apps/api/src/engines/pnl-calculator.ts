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

export default {
  calculateUnrealizedPnl,
  calculateLiquidationPrice,
  calculateRiskLevel,
  calculatePositionMetrics,
  shouldLiquidate
};
