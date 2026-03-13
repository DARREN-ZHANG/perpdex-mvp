// apps/web/hooks/use-binance-price.ts
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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

// 全局 WebSocket 连接管理器（单例模式）
class BinanceWebSocketManager {
  private static instance: BinanceWebSocketManager | null = null
  private ws: WebSocket | null = null
  private subscriptions: Map<string, Set<(data: BinancePriceData) => void>> = new Map()
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isConnecting = false
  private pendingSubscriptions: string[] = []

  static getInstance(): BinanceWebSocketManager {
    if (!BinanceWebSocketManager.instance) {
      BinanceWebSocketManager.instance = new BinanceWebSocketManager()
    }
    return BinanceWebSocketManager.instance
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true

    try {
      // 使用 combined streams 格式，支持动态订阅
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws')

      this.ws.onopen = () => {
        this.isConnecting = false
        // 订阅所有 pending 的 streams
        this.pendingSubscriptions.forEach(stream => {
          this.subscribe(stream)
        })
        this.pendingSubscriptions = []
      }

      this.ws.onmessage = (event) => {
        try {
          const ticker: BinanceTickerData = JSON.parse(event.data)
          const streamName = `${ticker.s.toLowerCase()}@ticker`
          const callbacks = this.subscriptions.get(streamName)

          if (callbacks) {
            const data: BinancePriceData = {
              price: parseFloat(ticker.c),
              change24h: parseFloat(ticker.p),
              changePercent24h: parseFloat(ticker.P),
              high24h: parseFloat(ticker.h),
              low24h: parseFloat(ticker.l),
              volume24h: parseFloat(ticker.v),
            }
            callbacks.forEach(cb => cb(data))
          }
        } catch {
          // 忽略解析错误
        }
      }

      this.ws.onerror = () => {
        this.isConnecting = false
      }

      this.ws.onclose = () => {
        this.isConnecting = false
        // 自动重连
        this.reconnectTimeout = setTimeout(() => {
          this.connect()
        }, 5000)
      }
    } catch {
      this.isConnecting = false
    }
  }

  subscribe(stream: string, callback: (data: BinancePriceData) => void) {
    if (!this.subscriptions.has(stream)) {
      this.subscriptions.set(stream, new Set())

      // 如果 WebSocket 已连接，发送订阅消息
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe(stream)
      } else {
        // 否则加入待订阅列表
        if (!this.pendingSubscriptions.includes(stream)) {
          this.pendingSubscriptions.push(stream)
        }
        this.connect()
      }
    }

    this.subscriptions.get(stream)?.add(callback)
  }

  unsubscribe(stream: string, callback: (data: BinancePriceData) => void) {
    const callbacks = this.subscriptions.get(stream)
    if (callbacks) {
      callbacks.delete(callback)

      // 如果没有订阅者了，取消订阅并清理
      if (callbacks.size === 0) {
        this.subscriptions.delete(stream)
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendUnsubscribe(stream)
        }
        // 从 pending 列表中移除
        this.pendingSubscriptions = this.pendingSubscriptions.filter(s => s !== stream)
      }
    }
  }

  private sendSubscribe(stream: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: [stream],
        id: Date.now()
      }))
    }
  }

  private sendUnsubscribe(stream: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'UNSUBSCRIBE',
        params: [stream],
        id: Date.now()
      }))
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export function useBinancePrice(symbol: string = 'BTCUSDT') {
  const [data, setData] = useState<BinancePriceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const managerRef = useRef<BinanceWebSocketManager | null>(null)

  const handleData = useCallback((priceData: BinancePriceData) => {
    setData(priceData)
    setIsLoading(false)
    setError(null)
  }, [])

  useEffect(() => {
    const manager = BinanceWebSocketManager.getInstance()
    managerRef.current = manager
    const stream = `${symbol.toLowerCase()}@ticker`

    manager.connect()
    manager.subscribe(stream, handleData)

    return () => {
      manager.unsubscribe(stream, handleData)
    }
  }, [symbol, handleData])

  return { data, isLoading, error }
}
