// apps/web/hooks/use-binance-price.ts
'use client'

import { useState, useEffect, useRef } from 'react'

interface BinancePriceData {
  price: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
}

interface BinanceTickerData {
  s: string  // Symbol
  c: string  // Last price
  P: string  // Price change percent
  p: string  // Price change
  h: string  // High price
  l: string  // Low price
  v: string  // Volume
}

export function useBinancePrice(symbol: string = 'BTCUSDT') {
  const [data, setData] = useState<BinancePriceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        // 使用 Binance WebSocket 获取实时价格
        const wsSymbol = symbol.toLowerCase()
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`)
        wsRef.current = ws

        ws.onmessage = (event) => {
          const ticker: BinanceTickerData = JSON.parse(event.data)
          setData({
            price: parseFloat(ticker.c),
            change24h: parseFloat(ticker.p),
            changePercent24h: parseFloat(ticker.P),
            high24h: parseFloat(ticker.h),
            low24h: parseFloat(ticker.l),
            volume24h: parseFloat(ticker.v),
          })
          setIsLoading(false)
          setError(null)
        }

        ws.onerror = () => {
          setError('WebSocket 连接错误')
          setIsLoading(false)
        }

        ws.onclose = () => {
          // 自动重连
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket()
          }, 5000)
        }
      } catch {
        setError('无法连接到 Binance')
        setIsLoading(false)
      }
    }

    // 首先通过 REST API 获取初始数据
    const fetchInitialData = async () => {
      try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
        if (!response.ok) throw new Error('API 请求失败')
        const ticker = await response.json()
        setData({
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.priceChange),
          changePercent24h: parseFloat(ticker.priceChangePercent),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          volume24h: parseFloat(ticker.volume),
        })
        setIsLoading(false)
      } catch {
        // REST API 失败时使用 WebSocket
        connectWebSocket()
      }
    }

    fetchInitialData()
    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [symbol])

  return { data, isLoading, error }
}
