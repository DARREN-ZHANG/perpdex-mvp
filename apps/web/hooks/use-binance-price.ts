// apps/web/hooks/use-binance-price.ts
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DEFAULT_BINANCE_SYMBOL, type BinancePriceData } from '@/lib/binance-market'

interface BinanceStreamTickerData {
  s: string
  c: string
  P: string
  p: string
  h: string
  l: string
  v: string
}

const SNAPSHOT_TIMEOUT_MS = 5000
const SNAPSHOT_POLL_INTERVAL_MS = 5000

class BinanceWebSocketManager {
  private static instance: BinanceWebSocketManager | null = null
  private ws: WebSocket | null = null
  private subscriptions: Map<string, Set<(data: BinancePriceData) => void>> = new Map()
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isConnecting = false
  private pendingSubscriptions: string[] = []
  private endpointIndex = 0
  private readonly endpoints = [
    'wss://stream.binance.com:9443/ws',
    'wss://stream.binance.us:9443/ws',
  ]

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
    const endpoint = this.endpoints[this.endpointIndex] ?? this.endpoints[0]

    try {
      this.ws = new WebSocket(endpoint)

      this.ws.onopen = () => {
        this.isConnecting = false
        this.pendingSubscriptions.forEach(stream => {
          this.sendSubscribe(stream)
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const ticker: BinanceStreamTickerData = JSON.parse(event.data)

          if (!ticker.s) {
            return
          }

          const streamName = `${ticker.s.toLowerCase()}@ticker`
          const callbacks = this.subscriptions.get(streamName)

          if (callbacks) {
            const data: BinancePriceData = {
              symbol: ticker.s,
              price: parseFloat(ticker.c),
              change24h: parseFloat(ticker.p),
              changePercent24h: parseFloat(ticker.P),
              high24h: parseFloat(ticker.h),
              low24h: parseFloat(ticker.l),
              volume24h: parseFloat(ticker.v),
              updatedAt: Date.now(),
              source: this.endpointIndex === 0 ? 'binance' : 'binance-us',
            }
            callbacks.forEach(cb => cb(data))
          }
        } catch {
          return
        }
      }

      this.ws.onerror = () => {
        this.isConnecting = false
      }

      this.ws.onclose = () => {
        this.isConnecting = false

        if (this.subscriptions.size === 0) {
          return
        }

        this.endpointIndex = (this.endpointIndex + 1) % this.endpoints.length
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

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe(stream)
      } else {
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

      if (callbacks.size === 0) {
        this.subscriptions.delete(stream)
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendUnsubscribe(stream)
        }
        this.pendingSubscriptions = this.pendingSubscriptions.filter(s => s !== stream)

        if (this.subscriptions.size === 0) {
          this.disconnect()
        }
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
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.isConnecting = false
  }
}

async function fetchTickerSnapshot(symbol: string): Promise<BinancePriceData> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS)
  try {
    const response = await fetch(`/api/binance/ticker?symbol=${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })

    const payload = await response.json() as {
      data?: BinancePriceData
      error?: string
    }

    if (!response.ok || !payload.data) {
      throw new Error(payload.error || 'Failed to load Binance ticker snapshot')
    }

    return payload.data
  } finally {
    clearTimeout(timeoutId)
  }
}

export function useBinancePrice(symbol: string = DEFAULT_BINANCE_SYMBOL) {
  const [data, setData] = useState<BinancePriceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeRequestRef = useRef(0)
  const latestDataRef = useRef<BinancePriceData | null>(null)

  const handleData = useCallback((priceData: BinancePriceData) => {
    setData(priceData)
    latestDataRef.current = priceData
    setIsLoading(false)
    setError(null)
  }, [])

  useEffect(() => {
    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId
    const manager = BinanceWebSocketManager.getInstance()
    const stream = `${symbol.toLowerCase()}@ticker`
    let isCancelled = false

    const loadSnapshot = async (mode: 'initial' | 'poll') => {
      try {
        const snapshot = await fetchTickerSnapshot(symbol)

        if (isCancelled || activeRequestRef.current !== requestId) {
          return
        }

        setData(snapshot)
        latestDataRef.current = snapshot
        setIsLoading(false)
        setError(null)
      } catch (snapshotError) {
        if (isCancelled || activeRequestRef.current !== requestId) {
          return
        }

        if (mode === 'initial' && !latestDataRef.current) {
          setIsLoading(false)
        }

        setError(snapshotError instanceof Error ? snapshotError.message : 'Failed to load Binance data')
      }
    }

    setIsLoading(true)
    setError(null)
    manager.connect()
    manager.subscribe(stream, handleData)

    void loadSnapshot('initial')

    const pollTimer = window.setInterval(() => {
      void loadSnapshot('poll')
    }, SNAPSHOT_POLL_INTERVAL_MS)

    return () => {
      isCancelled = true
      window.clearInterval(pollTimer)
      manager.unsubscribe(stream, handleData)
    }
  }, [symbol, handleData])

  return { data, isLoading, error }
}
