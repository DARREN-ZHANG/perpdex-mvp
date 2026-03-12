// apps/web/hooks/use-market.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { tradingApi } from '@/lib/trading-api'
import { socketClient } from '@/lib/socket'
import type {
  MarketData,
  CandleData,
  Timeframe,
  UseMarketReturn,
} from '@/types/trading'

const DEFAULT_SYMBOL = 'BTC'
const DEFAULT_TIMEFRAME: Timeframe = '1h'

// 生成模拟 K 线数据 (用于开发测试)
function generateMockCandles(timeframe: Timeframe): CandleData[] {
  const candles: CandleData[] = []
  const now = Math.floor(Date.now() / 1000)
  const timeframeSeconds = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
  }
  const interval = timeframeSeconds[timeframe]
  let basePrice = 65000

  for (let i = 100; i >= 0; i--) {
    const time = now - i * interval
    const volatility = 0.002
    const change = (Math.random() - 0.5) * 2 * volatility
    const open = basePrice
    const close = basePrice * (1 + change)
    const high = Math.max(open, close) * (1 + Math.random() * volatility)
    const low = Math.min(open, close) * (1 - Math.random() * volatility)
    const volume = Math.random() * 100 + 50

    candles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number(volume.toFixed(4)),
    })

    basePrice = close
  }

  return candles
}

export function useMarket(symbol: string = DEFAULT_SYMBOL): UseMarketReturn {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME)
  const [currentPrice, setCurrentPrice] = useState(0)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 加载市场数据
  const loadMarketData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await tradingApi.getMarketDetails(symbol)

      if (response.success && response.data) {
        setMarketData(response.data.market)
        setCurrentPrice(parseFloat(response.data.market.markPrice))
      } else {
        // 使用模拟数据
        setMarketData({
          symbol,
          markPrice: '65000.00',
          indexPrice: '65000.00',
          change24h: '+2.5',
          openInterest: '1000000',
          updatedAt: new Date().toISOString(),
        })
        setCurrentPrice(65000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载市场数据失败')
      // 使用模拟数据
      setMarketData({
        symbol,
        markPrice: '65000.00',
        indexPrice: '65000.00',
        change24h: '+2.5',
        openInterest: '1000000',
        updatedAt: new Date().toISOString(),
      })
      setCurrentPrice(65000)
    } finally {
      setIsLoading(false)
    }
  }, [symbol])

  // 加载 K 线数据
  const loadCandleData = useCallback(async () => {
    try {
      // 先生成模拟数据
      const mockCandles = generateMockCandles(selectedTimeframe)
      setCandleData(mockCandles)

      // 尝试从 API 获取
      const response = await tradingApi.getCandleHistory(symbol, selectedTimeframe)
      if (response.success && response.data) {
        setCandleData(response.data.items)
      }
    } catch {
      // 使用模拟数据
      const mockCandles = generateMockCandles(selectedTimeframe)
      setCandleData(mockCandles)
    }
  }, [symbol, selectedTimeframe])

  // 订阅实时行情
  useEffect(() => {
    // 初始加载
    loadMarketData()
    loadCandleData()

    // 连接 Socket
    socketClient.connect()

    // 订阅市场数据
    const unsubscribe = socketClient.subscribeMarket(symbol, (data) => {
      // 转换 Socket MarketData 到 Trading MarketData
      setMarketData({
        symbol: data.symbol,
        markPrice: data.price,
        indexPrice: data.price,
        change24h: data.change24h,
        openInterest: '0',
        updatedAt: new Date(data.timestamp).toISOString(),
      })
      setCurrentPrice(parseFloat(data.price))
    })

    unsubscribeRef.current = unsubscribe

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [symbol, loadMarketData, loadCandleData])

  // 订阅 K 线更新
  useEffect(() => {
    const unsubscribe = socketClient.subscribeCandles(
      symbol,
      selectedTimeframe,
      (update) => {
        setCandleData((prev) => {
          const newData = [...prev]
          const lastIndex = newData.findIndex((c) => c.time === update.data.time)

          if (lastIndex >= 0) {
            newData[lastIndex] = update.data
          } else {
            newData.push(update.data)
            if (newData.length > 500) {
              newData.shift()
            }
          }

          return newData
        })
      }
    )

    return () => {
      unsubscribe()
    }
  }, [symbol, selectedTimeframe])

  return {
    marketData,
    candleData,
    currentPrice,
    isLoading,
    error,
    selectedTimeframe,
    setSelectedTimeframe,
    refreshMarketData: loadMarketData,
  }
}
