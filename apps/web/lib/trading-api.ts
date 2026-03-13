// 交易相关 API 封装

import { api } from './api'
import { parseUnits } from 'viem'
import type { CandleData, Timeframe } from '@/types/trading'

export interface MarketDetailsResponse {
  market: {
    symbol: string
    markPrice: string
    indexPrice: string
    change24h: string
    openInterest: string
    updatedAt: string
  }
}

export interface CandleHistoryResponse {
  items: CandleData[]
  nextCursor?: string
}

export interface CreateOrderRequest {
  symbol: string
  side: 'LONG' | 'SHORT'
  size: string
  margin: string
  leverage: number
  clientOrderId?: string
}

export interface CreateOrderResponse {
  order: {
    id: string
    symbol: string
    side: 'LONG' | 'SHORT'
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
}

export const tradingApi = {
  // 获取市场详情
  async getMarketDetails(symbol: string) {
    return api.get<MarketDetailsResponse>(`/api/market/${symbol}`)
  },

  // 获取 K 线历史数据
  async getCandleHistory(symbol: string, timeframe: Timeframe, cursor?: string) {
    const params = new URLSearchParams()
    params.append('timeframe', timeframe)
    if (cursor) params.append('cursor', cursor)

    return api.get<CandleHistoryResponse>(`/api/market/${symbol}/candles?${params.toString()}`)
  },

  // 创建订单
  async createOrder(request: CreateOrderRequest) {
    return api.post<CreateOrderResponse>('/api/trade/order', {
      ...request,
      // Backend expects USDC in 6-decimal base units.
      margin: parseUnits(request.margin, 6).toString(),
    })
  },
}
