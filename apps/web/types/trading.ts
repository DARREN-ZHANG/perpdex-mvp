// 交易相关类型定义

export type OrderSide = 'LONG' | 'SHORT'

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export interface OrderFormData {
  side: OrderSide
  size: string
  margin: string
  leverage: number
}

export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface MarketData {
  symbol: string
  markPrice: string
  indexPrice: string
  change24h: string
  openInterest: string
  updatedAt: string
}

export interface UseMarketReturn {
  marketData: MarketData | null
  candleData: CandleData[]
  currentPrice: number
  isLoading: boolean
  error: string | null
  selectedTimeframe: Timeframe
  setSelectedTimeframe: (timeframe: Timeframe) => void
  refreshMarketData: () => void
}

// Order types
export interface CreateOrderPayload {
  symbol: string
  side: OrderSide
  size: string
  margin: string
  leverage: number
  clientOrderId?: string
}

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  size: string
  margin: string
  leverage: number
  status: 'PENDING' | 'FILLED' | 'FAILED' | 'CANCELED'
  executedPrice?: string
  requestedPrice?: string
  failureMessage?: string
  createdAt: string
  updatedAt: string
}
