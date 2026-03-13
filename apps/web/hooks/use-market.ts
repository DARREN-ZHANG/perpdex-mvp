// apps/web/hooks/use-market.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { tradingApi } from '@/lib/trading-api'
import { socketClient } from '@/lib/socket'
import { useBinancePrice } from '@/hooks/use-binance-price'
import {
  BINANCE_KLINE_LIMIT,
  toBinanceInterval,
  toBinanceSymbol,
} from '@/lib/binance-market'
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
  const marketSymbol = toBinanceSymbol(symbol)
  const { data: binancePrice, isLoading: isBinanceLoading, error: binanceError } = useBinancePrice(marketSymbol)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME)
  const [currentPrice, setCurrentPrice] = useState(0)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const syncBinanceMarketData = useCallback(() => {
    if (!binancePrice) {
      return false
    }

    setMarketData({
      symbol,
      markPrice: binancePrice.price.toFixed(2),
      indexPrice: binancePrice.price.toFixed(2),
      change24h: binancePrice.changePercent24h.toFixed(2),
      openInterest: binancePrice.volume24h.toFixed(2),
      high24h: binancePrice.high24h.toFixed(2),
      low24h: binancePrice.low24h.toFixed(2),
      volume24h: binancePrice.volume24h.toFixed(2),
      updatedAt: new Date(binancePrice.updatedAt).toISOString(),
    })
    setCurrentPrice(binancePrice.price)
    setError(null)
    setIsLoading(false)

    return true
  }, [binancePrice, symbol])

  const loadMarketData = useCallback(async () => {
    if (syncBinanceMarketData()) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await tradingApi.getMarketDetails(symbol)

      if (response.success && response.data) {
        setMarketData(response.data.market)
        setCurrentPrice(parseFloat(response.data.market.markPrice))
      } else {
        throw new Error(response.error?.message || 'Market API is unavailable')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载市场数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [symbol, syncBinanceMarketData])

  const loadCandleData = useCallback(async () => {
    try {
      const mockCandles = generateMockCandles(selectedTimeframe)
      setCandleData(mockCandles)

      const response = await fetch(
        `/api/binance/klines?symbol=${encodeURIComponent(marketSymbol)}&interval=${encodeURIComponent(toBinanceInterval(selectedTimeframe))}&limit=${BINANCE_KLINE_LIMIT}`,
        { cache: 'no-store' }
      )

      const payload = await response.json() as {
        data?: CandleData[]
      }

      if (response.ok && payload.data) {
        setCandleData(payload.data)
      }
    } catch {
      const mockCandles = generateMockCandles(selectedTimeframe)
      setCandleData(mockCandles)
    }
  }, [marketSymbol, selectedTimeframe])

  useEffect(() => {
    syncBinanceMarketData()
  }, [syncBinanceMarketData])

  useEffect(() => {
    if (!binanceError || binancePrice) {
      return
    }

    setError(binanceError)
    setIsLoading(false)
  }, [binanceError, binancePrice])

  useEffect(() => {
    loadMarketData()
    loadCandleData()

    socketClient.connect()

    const unsubscribe = socketClient.subscribeMarket(symbol, (data) => {
      setMarketData((prev) => ({
        symbol: data.symbol,
        markPrice: data.price,
        indexPrice: data.price,
        change24h: data.change24h,
        openInterest: '0',
        high24h: prev?.high24h,
        low24h: prev?.low24h,
        volume24h: prev?.volume24h,
        updatedAt: new Date(data.timestamp).toISOString(),
      }))
      setCurrentPrice(parseFloat(data.price))
    })

    unsubscribeRef.current = unsubscribe

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [symbol, loadMarketData, loadCandleData])

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
    isLoading: (isLoading || isBinanceLoading) && !marketData,
    error,
    selectedTimeframe,
    setSelectedTimeframe,
    refreshMarketData: loadMarketData,
  }
}
