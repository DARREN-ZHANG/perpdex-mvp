// apps/api/tests/__mocks__/test-fixtures.ts
/**
 * 测试数据夹具
 * 提供标准的测试用户、账户、仓位和订单数据
 */
import Decimal from "decimal.js";
import type { User, Account, Position, Order } from "@prisma/client";

/**
 * 测试用户
 */
export const mockUser: User = {
  id: "test_user_001",
  walletAddress: "0x1234567890123456789012345678901234567890",
  nonce: "test_nonce_12345678",
  nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 分钟后过期
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  lastLoginAt: new Date("2024-01-01T00:00:00.000Z")
};

/**
 * 测试账户 - 有足够余额（10000 USDC）
 */
export const mockAccount: Account = {
  id: "test_account_001",
  userId: mockUser.id,
  asset: "USDC",
  availableBalance: BigInt("10000000000"), // 10000 USDC (6 decimals)
  lockedBalance: BigInt(0),
  equity: BigInt("10000000000"),
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z")
};

/**
 * 创建带有指定余额的测试账户
 */
export function createMockAccount(overrides: {
  userId?: string;
  availableBalance?: string | bigint;
  lockedBalance?: string | bigint;
}): Account {
  return {
    id: `test_account_${Date.now()}`,
    userId: overrides.userId || mockUser.id,
    asset: "USDC",
    availableBalance: BigInt(overrides.availableBalance || "10000000000"),
    lockedBalance: BigInt(overrides.lockedBalance || "0"),
    equity: BigInt(overrides.availableBalance || "10000000000"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z")
  };
}

/**
 * 测试仓位 - 开多仓，状态 OPEN
 */
export const mockPosition: Position = {
  id: "test_position_001",
  userId: mockUser.id,
  symbol: "BTC",
  side: "LONG",
  positionSize: new Decimal("0.1"), // 0.1 BTC
  entryPrice: new Decimal("50000"), // 50000 USD
  markPrice: new Decimal("50000"),
  unrealizedPnl: new Decimal(0),
  liquidationPrice: new Decimal("45250"), // 50000 * (1 - 0.1 + 0.005)
  margin: BigInt("5000000000"), // 5000 USDC (6 decimals)
  status: "OPEN",
  riskLevel: "SAFE",
  metadata: null,
  openedAt: new Date("2024-01-01T00:00:00.000Z"),
  closedAt: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z")
};

/**
 * 创建测试仓位
 */
export function createMockPosition(overrides: {
  userId?: string;
  symbol?: "BTC";
  side?: "LONG" | "SHORT";
  positionSize?: string | Decimal;
  entryPrice?: string | Decimal;
  markPrice?: string | Decimal;
  margin?: string | bigint;
  leverage?: number;
  status?: "OPEN" | "CLOSED" | "LIQUIDATED";
  riskLevel?: "SAFE" | "WARNING" | "DANGER";
}): Position {
  const leverage = overrides.leverage || 10;
  const positionSize = new Decimal(overrides.positionSize || "0.1");
  const entryPrice = new Decimal(overrides.entryPrice || "50000");
  const margin = BigInt(overrides.margin || "5000000000");

  // 计算清算价格
  const notional = positionSize.times(entryPrice);
  const marginRatio = new Decimal(margin.toString()).div(notional);
  const maintenanceRatio = new Decimal("0.005"); // 0.5%

  let liquidationPrice: Decimal;
  if (overrides.side === "SHORT") {
    liquidationPrice = entryPrice.times(
      new Decimal(1).plus(marginRatio).minus(maintenanceRatio)
    );
  } else {
    liquidationPrice = entryPrice.times(
      new Decimal(1).minus(marginRatio).plus(maintenanceRatio)
    );
  }

  return {
    id: `test_position_${Date.now()}`,
    userId: overrides.userId || mockUser.id,
    symbol: overrides.symbol || "BTC",
    side: overrides.side || "LONG",
    positionSize,
    entryPrice,
    markPrice: new Decimal(overrides.markPrice || "50000"),
    unrealizedPnl: new Decimal(0),
    liquidationPrice,
    margin,
    status: overrides.status || "OPEN",
    riskLevel: overrides.riskLevel || "SAFE",
    metadata: null,
    openedAt: new Date("2024-01-01T00:00:00.000Z"),
    closedAt: overrides.status === "CLOSED" || overrides.status === "LIQUIDATED" ? new Date() : null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z")
  };
}

/**
 * 测试订单 - 已成交的市价单
 */
export const mockOrder: Order = {
  id: "test_order_001",
  userId: mockUser.id,
  positionId: mockPosition.id,
  clientOrderId: null,
  symbol: "BTC",
  side: "LONG",
  type: "MARKET",
  size: new Decimal("0.1"),
  requestedPrice: null,
  executedPrice: new Decimal("50000"),
  margin: BigInt("5000000000"), // 5000 USDC
  leverage: 10,
  status: "FILLED",
  failureCode: null,
  failureMessage: null,
  metadata: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  filledAt: new Date("2024-01-01T00:00:01.000Z")
};

/**
 * 创建测试订单
 */
export function createMockOrder(overrides: {
  userId?: string;
  positionId?: string;
  symbol?: "BTC";
  side?: "LONG" | "SHORT";
  size?: string | Decimal;
  executedPrice?: string | Decimal;
  margin?: string | bigint;
  leverage?: number;
  status?: "PENDING" | "FILLED" | "FAILED" | "CANCELED";
  clientOrderId?: string | null;
}): Order {
  return {
    id: `test_order_${Date.now()}`,
    userId: overrides.userId || mockUser.id,
    positionId: overrides.positionId || null,
    clientOrderId: overrides.clientOrderId || null,
    symbol: overrides.symbol || "BTC",
    side: overrides.side || "LONG",
    type: "MARKET",
    size: new Decimal(overrides.size || "0.1"),
    requestedPrice: null,
    executedPrice: new Decimal(overrides.executedPrice || "50000"),
    margin: BigInt(overrides.margin || "5000000000"),
    leverage: overrides.leverage || 10,
    status: overrides.status || "FILLED",
    failureCode: null,
    failureMessage: null,
    metadata: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    filledAt: overrides.status === "FILLED" ? new Date("2024-01-01T00:00:01.000Z") : null
  };
}

/**
 * 创建下市价单的输入参数
 */
export function createMarketOrderInput(overrides?: {
  userId?: string;
  symbol?: string;
  side?: "LONG" | "SHORT";
  size?: string | Decimal;
  margin?: string | bigint;
  leverage?: number;
  clientOrderId?: string;
}) {
  return {
    userId: overrides?.userId || mockUser.id,
    symbol: overrides?.symbol || "BTC",
    side: overrides?.side || "LONG",
    size: new Decimal(overrides?.size || "0.1"),
    margin: BigInt(overrides?.margin || "5000000000"),
    leverage: overrides?.leverage || 10,
    clientOrderId: overrides?.clientOrderId
  };
}

/**
 * 常用测试常量
 */
export const TEST_CONSTANTS = {
  // 价格常量
  BTC_MARK_PRICE: new Decimal("50000"),
  BTC_ENTRY_PRICE: new Decimal("50000"),

  // 仓位常量
  POSITION_SIZE: new Decimal("0.1"),
  MARGIN: BigInt("5000000000"), // 5000 USDC
  LEVERAGE: 10,

  // 清算价格
  LONG_LIQUIDATION_PRICE: new Decimal("45250"), // 50000 * (1 - 0.1 + 0.005)
  SHORT_LIQUIDATION_PRICE: new Decimal("54750"), // 50000 * (1 + 0.1 - 0.005)

  // 风险阈值
  WARNING_MARGIN_RATIO: 0.10, // 10%
  DANGER_MARGIN_RATIO: 0.05,  // 5%
  MAINTENANCE_MARGIN_RATE: 0.005 // 0.5%
} as const;
