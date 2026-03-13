// apps/web/types/socket.ts

// 市场行情数据
export interface MarketData {
  symbol: string
  price: string
  timestamp: number
  change24h: string
  high24h: string
  low24h: string
  volume24h: string
}

// K线数据
export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// 仓位更新数据
export interface PositionUpdate {
  type: 'POSITION_CREATED' | 'POSITION_CLOSED' | 'POSITION_LIQUIDATED'
  position: {
    id: string
    symbol: string
    side?: 'LONG' | 'SHORT'
    positionSize?: string
    entryPrice?: string
    markPrice?: string
    unrealizedPnl?: string
    realizedPnl?: string
    liquidationPrice?: string
    status: 'OPEN' | 'CLOSED' | 'LIQUIDATED'
    updatedAt?: string
  }
}

// 余额更新数据
export interface BalanceUpdate {
  availableBalance: string
  lockedBalance: string
  totalBalance: string
  updatedAt: string
}

// 交易通知
export interface TradeNotification {
  type: 'ORDER_FILLED' | 'POSITION_CLOSED' | 'LIQUIDATION' | 'MARGIN_CALL'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: number
}

// Socket 事件类型
export type SocketEventMap = {
  'market:update': MarketData
  'candle:update': { symbol: string; timeframe: string; data: CandleData }
  'position:update': PositionUpdate
  'balance:update': BalanceUpdate
  'notification': TradeNotification
  'connect': void
  'disconnect': string
  'error': Error
}

// 订阅选项
export interface SubscribeOptions {
  symbol?: string
  userId?: string
  timeframe?: string
}
