// apps/web/lib/socket.ts
import { io, type Socket } from 'socket.io-client'
import { WS_CONFIG } from '@/config/constants'
import type {
  MarketData,
  CandleData,
  PositionUpdate,
  BalanceUpdate,
  TradeNotification,
} from '@/types/socket'

class SocketClient {
  private socket: Socket | null = null
  private static instance: SocketClient
  private subscriptions: Map<string, Set<(data: unknown) => void>> = new Map()
  private channelBindings: Map<string, (data: unknown) => void> = new Map()
  private userRoomRefCounts: Map<string, number> = new Map()
  private marketRefCounts: Map<string, number> = new Map()
  private reconnectAttempts = 0

  // 单例模式
  static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient()
    }
    return SocketClient.instance
  }

  // 连接 Socket
  connect(token?: string): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(WS_CONFIG.URL, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: WS_CONFIG.RECONNECTION_ATTEMPTS,
      reconnectionDelay: WS_CONFIG.RECONNECTION_DELAY,
      reconnectionDelayMax: WS_CONFIG.RECONNECTION_DELAY_MAX,
      randomizationFactor: 0.5,
      timeout: 20000,
    })

    this.setupEventListeners()

    return this.socket
  }

  // 设置事件监听
  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id)
      this.reconnectAttempts = 0

      // 重新订阅之前的频道
      this.resubscribeAll()
    })

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
      this.reconnectAttempts++
    })

    this.socket.on('error', (error) => {
      console.error('[Socket] Error:', error)
    })

    this.socket.on('notification', (data: TradeNotification) => {
      this.emit('notification', data)
    })
  }

  // 内部事件发射
  private emit(event: string, data: unknown): void {
    const callbacks = this.subscriptions.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`[Socket] Error in ${event} callback:`, error)
        }
      })
    }
  }

  // 重新订阅所有频道
  private resubscribeAll(): void {
    console.log('[Socket] Resubscribing to channels...')
    this.marketRefCounts.forEach((count, symbol) => {
      if (count > 0) {
        this.socket?.emit('subscribe:market', { symbol })
      }
    })
    this.userRoomRefCounts.forEach((count, userId) => {
      if (count > 0) {
        this.socket?.emit('subscribe:position', { userId })
      }
    })
  }

  private bindChannel(channel: string, eventName: string): void {
    if (!this.socket || this.channelBindings.has(channel)) return

    const handler = (data: unknown) => {
      this.emit(eventName, data)
    }

    this.socket.on(channel, handler)
    this.channelBindings.set(channel, handler)
  }

  private unbindChannel(channel: string): void {
    if (!this.socket) return

    const handler = this.channelBindings.get(channel)
    if (!handler) return

    this.socket.off(channel, handler)
    this.channelBindings.delete(channel)
  }

  private retainUserRoom(userId: string): void {
    const nextCount = (this.userRoomRefCounts.get(userId) ?? 0) + 1
    this.userRoomRefCounts.set(userId, nextCount)

    if (nextCount === 1) {
      this.socket?.emit('subscribe:position', { userId })
    }
  }

  private releaseUserRoom(userId: string): void {
    const currentCount = this.userRoomRefCounts.get(userId) ?? 0
    if (currentCount <= 1) {
      this.userRoomRefCounts.delete(userId)
      this.socket?.emit('unsubscribe:position', { userId })
      return
    }

    this.userRoomRefCounts.set(userId, currentCount - 1)
  }

  // 订阅市场行情
  subscribeMarket(symbol: string, callback: (data: MarketData) => void): () => void {
    const eventName = `market:${symbol}`
    const channel = `market:${symbol}:update`

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      this.bindChannel(channel, eventName)
      this.marketRefCounts.set(symbol, (this.marketRefCounts.get(symbol) ?? 0) + 1)
      this.socket?.emit('subscribe:market', { symbol })
    }

    const wrappedCallback = (data: unknown) => callback(data as MarketData)
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    // 返回取消订阅函数
    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
      if (this.subscriptions.get(eventName)?.size === 0) {
        const currentCount = this.marketRefCounts.get(symbol) ?? 0
        if (currentCount <= 1) {
          this.marketRefCounts.delete(symbol)
          this.socket?.emit('unsubscribe:market', { symbol })
        } else {
          this.marketRefCounts.set(symbol, currentCount - 1)
        }
        this.unbindChannel(channel)
        this.subscriptions.delete(eventName)
      }
    }
  }

  // 订阅 K 线数据
  subscribeCandles(
    symbol: string,
    timeframe: string,
    callback: (data: { symbol: string; timeframe: string; data: CandleData }) => void
  ): () => void {
    const eventName = `candle:${symbol}:${timeframe}`

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      this.socket?.emit('subscribe:candles', { symbol, timeframe })
    }

    const wrappedCallback = (data: unknown) => callback(data as { symbol: string; timeframe: string; data: CandleData })
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
      if (this.subscriptions.get(eventName)?.size === 0) {
        this.socket?.emit('unsubscribe:candles', { symbol, timeframe })
        this.subscriptions.delete(eventName)
      }
    }
  }

  // 订阅用户仓位更新
  subscribePositions(userId: string, callback: (data: PositionUpdate) => void): () => void {
    const eventName = `position:${userId}`
    const channel = `position:${userId}:update`

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      this.bindChannel(channel, eventName)
      this.retainUserRoom(userId)
    }

    const wrappedCallback = (data: unknown) => callback(data as PositionUpdate)
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
      if (this.subscriptions.get(eventName)?.size === 0) {
        this.unbindChannel(channel)
        this.releaseUserRoom(userId)
        this.subscriptions.delete(eventName)
      }
    }
  }

  // 订阅余额更新
  subscribeBalance(userId: string, callback: (data: BalanceUpdate) => void): () => void {
    const eventName = `balance:${userId}`
    const channel = `balance:${userId}:update`

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      this.bindChannel(channel, eventName)
      this.retainUserRoom(userId)
    }

    const wrappedCallback = (data: unknown) => callback(data as BalanceUpdate)
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
      if (this.subscriptions.get(eventName)?.size === 0) {
        this.unbindChannel(channel)
        this.releaseUserRoom(userId)
        this.subscriptions.delete(eventName)
      }
    }
  }

  // 订阅通知
  subscribeNotifications(callback: (data: TradeNotification) => void): () => void {
    const eventName = 'notification'

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
    }

    const wrappedCallback = (data: unknown) => callback(data as TradeNotification)
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
    }
  }

  // 断开连接
  disconnect(): void {
    this.subscriptions.clear()
    this.channelBindings.clear()
    this.userRoomRefCounts.clear()
    this.marketRefCounts.clear()
    this.socket?.disconnect()
    this.socket = null
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  // 获取 socket 实例（用于高级用法）
  getSocket(): Socket | null {
    return this.socket
  }
}

// 导出单例
export const socketClient = SocketClient.getInstance()

// 导出类型
export type {
  MarketData,
  CandleData,
  PositionUpdate,
  BalanceUpdate,
  TradeNotification,
}
