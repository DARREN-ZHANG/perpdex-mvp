# 前端基础设施（泳道 E）实施计划

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PerpDex MVP 前端基础设施，包含布局组件、钱包连接、认证系统、API 客户端和 WebSocket 连接

**架构:** 使用 Next.js 15 App Router，通过 Reown AppKit + Wagmi v2 实现钱包连接，SIWE 认证获取 JWT，封装 API 客户端和 Socket.IO 客户端统一管理后端通信

**Tech Stack:** Next.js 15, React 19, TypeScript, Reown AppKit, Wagmi v2, Socket.IO Client, Tailwind CSS, shadcn/ui

---

## Chunk 1: 项目初始化和依赖安装

**目标:** 安装所有必要的依赖包

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/.env.local.example`

### Task 1.1: 安装核心依赖

- [ ] **Step 1: 安装钱包和区块链相关依赖**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e/apps/web
npm install @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @wagmi/core @tanstack/react-query
```

Expected: 安装成功，无错误

- [ ] **Step 2: 安装 Socket.IO 和其他工具依赖**

```bash
npm install socket.io-client
npm install -D @types/socket.io-client
```

Expected: 安装成功

- [ ] **Step 3: 安装 UI 和工具依赖**

```bash
npm install clsx tailwind-merge lucide-react
npm install siwe  # 用于 SIWE 签名
```

Expected: 安装成功

- [ ] **Step 4: 提交依赖安装**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore: install wallet, socket.io and ui dependencies"
```

---

## Chunk 2: Wagmi 和 AppKit 配置

**目标:** 配置 Wagmi 和 Reown AppKit 支持 Arbitrum Sepolia

**Files:**
- Create: `apps/web/config/wagmi.ts`
- Create: `apps/web/config/constants.ts`
- Modify: `apps/web/app/layout.tsx`

### Task 2.1: 创建常量配置

- [ ] **Step 1: 创建 constants.ts**

```typescript
// apps/web/config/constants.ts

export const APP_NAME = 'PerpDex'
export const APP_DESCRIPTION = 'Perpetual DEX MVP'

// 支持的链
export const SUPPORTED_CHAINS = {
  ARBITRUM_SEPOLIA: {
    id: 421614,
    name: 'Arbitrum Sepolia',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://sepolia-rollup.arbitrum.io/rpc'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Arbiscan',
        url: 'https://sepolia.arbiscan.io',
      },
    },
    testnet: true,
  },
} as const

// API 配置
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
}

// WebSocket 配置
export const WS_CONFIG = {
  URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  RECONNECTION_ATTEMPTS: 10,
  RECONNECTION_DELAY: 1000,
  RECONNECTION_DELAY_MAX: 5000,
}

// 交易配置
export const TRADING_CONFIG = {
  DEFAULT_SYMBOL: 'BTC',
  MIN_MARGIN: 1,
  MAX_LEVERAGE: 20,
  DEFAULT_LEVERAGE: 10,
}
```

- [ ] **Step 2: 验证文件创建**

```bash
cat /Users/xlzj/Desktop/Projects/perp-dex-mvp-e/apps/web/config/constants.ts
```

Expected: 文件内容正确显示

### Task 2.2: 创建 Wagmi 配置

- [ ] **Step 3: 创建 wagmi.ts**

```typescript
// apps/web/config/wagmi.ts
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arbitrumSepolia } from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// 获取项目 ID
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not defined')
}

// 创建 QueryClient
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000,
    },
  },
})

// 创建 Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  networks: [arbitrumSepolia],
  projectId,
  ssr: true,
})

// 创建 AppKit
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [arbitrumSepolia],
  projectId,
  defaultNetwork: arbitrumSepolia,
  metadata: {
    name: 'PerpDex',
    description: 'Perpetual DEX MVP',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://perpdex.com',
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  features: {
    analytics: true,
    socials: ['google', 'apple', 'email', 'x', 'github', 'discord'],
    email: true,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#22c55e',
  },
})

// 导出配置
export const config = wagmiAdapter.wagmiConfig

// Context Provider 组件
export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4: 验证 wagmi.ts 创建**

```bash
cat /Users/xlzj/Desktop/Projects/perp-dex-mvp-e/apps/web/config/wagmi.ts
```

Expected: 文件内容正确显示

### Task 2.3: 更新根布局

- [ ] **Step 5: 修改 layout.tsx 集成 Web3Provider**

```typescript
// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import { Web3Provider } from "@/config/wagmi";

export const metadata = {
  title: "PerpDex - Perpetual DEX",
  description: "Perpetual DEX MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: 提交 Wagmi 配置**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/config/ apps/web/app/layout.tsx
git commit -m "feat: configure wagmi and reown appkit"
```

---

## Chunk 3: API 客户端封装

**目标:** 创建统一的 API 客户端，处理 JWT、错误处理和重试

**Files:**
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/types/api.ts`

### Task 3.1: 创建 API 类型定义

- [ ] **Step 1: 创建 types/api.ts**

```typescript
// apps/web/types/api.ts

// 通用 API 响应格式
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

export interface ApiMeta {
  page?: number
  limit?: number
  total?: number
  hasMore?: boolean
}

// 认证相关类型
export interface AuthChallenge {
  message: string
  nonce: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface User {
  id: string
  address: string
  createdAt: string
  updatedAt: string
}

// 请求配置
export interface RequestConfig extends RequestInit {
  retries?: number
  retryDelay?: number
}

// API 错误类型
export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}
```

### Task 3.2: 创建 API 客户端

- [ ] **Step 2: 创建 lib/api.ts**

```typescript
// apps/web/lib/api.ts
import { API_CONFIG } from '@/config/constants'
import type {
  ApiResponse,
  ApiError,
  AuthChallenge,
  AuthTokens,
  User,
  RequestConfig,
} from '@/types/api'

class ApiClient {
  private baseUrl: string
  private timeout: number
  private defaultRetries: number

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL
    this.timeout = API_CONFIG.TIMEOUT
    this.defaultRetries = API_CONFIG.RETRY_ATTEMPTS
  }

  // 获取存储的 token
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  }

  // 设置 token
  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('accessToken', token)
  }

  // 清除 token
  clearTokens(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  // 带超时的 fetch
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // 核心请求方法
  private async request<T>(
    endpoint: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      retries = this.defaultRetries,
      retryDelay = 1000,
      headers = {},
      ...fetchOptions
    } = options

    const url = `${this.baseUrl}${endpoint}`
    const token = this.getAccessToken()

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          url,
          {
            ...fetchOptions,
            headers: defaultHeaders,
          },
          this.timeout
        )

        // 处理 401 未授权
        if (response.status === 401) {
          this.clearTokens()
          // 可以在这里触发重新登录
          return {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: '登录已过期，请重新登录',
            },
          }
        }

        // 解析响应
        const data: ApiResponse<T> = await response.json()

        if (!response.ok) {
          return {
            success: false,
            data: null,
            error: data.error || {
              code: 'UNKNOWN_ERROR',
              message: '请求失败',
            },
          }
        }

        return data
      } catch (error) {
        lastError = error as Error

        // 如果是最后一次尝试，抛出错误
        if (attempt === retries) {
          break
        }

        // 指数退避
        const delayMs = retryDelay * Math.pow(2, attempt)
        await this.delay(delayMs)
      }
    }

    // 所有重试都失败
    return {
      success: false,
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: lastError?.message || '网络请求失败，请检查网络连接',
      },
    }
  }

  // GET 请求
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' })
  }

  // POST 请求
  async post<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  // PUT 请求
  async put<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  // DELETE 请求
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' })
  }

  // ========== 认证相关 API ==========

  // 获取 SIWE 挑战
  async getAuthChallenge(address: string): Promise<ApiResponse<AuthChallenge>> {
    return this.post<AuthChallenge>('/api/auth/challenge', { address })
  }

  // 验证签名并登录
  async verifySignature(
    message: string,
    signature: string
  ): Promise<ApiResponse<AuthTokens & { user: User }>> {
    return this.post<AuthTokens & { user: User }>('/api/auth/verify', {
      message,
      signature,
    })
  }

  // 获取当前用户信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.get<User>('/api/auth/me')
  }

  // 退出登录
  async logout(): Promise<ApiResponse<void>> {
    const result = await this.post<void>('/api/auth/logout')
    this.clearTokens()
    return result
  }
}

// 导出单例实例
export const api = new ApiClient()

// 导出类型
export type { ApiResponse, ApiError, AuthChallenge, AuthTokens, User }
```

- [ ] **Step 3: 提交 API 客户端**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/lib/api.ts apps/web/types/api.ts
git commit -m "feat: implement api client with jwt and retry logic"
```

---

## Chunk 4: Socket.IO 客户端封装

**目标:** 创建 Socket.IO 客户端，支持自动重连和订阅管理

**Files:**
- Create: `apps/web/lib/socket.ts`
- Create: `apps/web/types/socket.ts`

### Task 4.1: 创建 Socket 类型定义

- [ ] **Step 1: 创建 types/socket.ts**

```typescript
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
  positionId: string
  userId: string
  symbol: string
  side: 'LONG' | 'SHORT'
  size: string
  entryPrice: string
  markPrice: string
  margin: string
  leverage: number
  unrealizedPnl: string
  realizedPnl: string
  liquidationPrice: string
  updatedAt: string
}

// 余额更新数据
export interface BalanceUpdate {
  userId: string
  asset: string
  walletBalance: string
  orderMargin: string
  positionMargin: string
  availableBalance: string
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
```

### Task 4.2: 创建 Socket.IO 客户端

- [ ] **Step 2: 创建 lib/socket.ts**

```typescript
// apps/web/lib/socket.ts
import { io, Socket } from 'socket.io-client'
import { WS_CONFIG } from '@/config/constants'
import type {
  MarketData,
  CandleData,
  PositionUpdate,
  BalanceUpdate,
  TradeNotification,
  SocketEventMap,
  SubscribeOptions,
} from '@/types/socket'

class SocketClient {
  private socket: Socket | null = null
  private static instance: SocketClient
  private subscriptions: Map<string, Set<(data: unknown) => void>> = new Map()
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

    // 处理服务器推送的数据
    this.socket.on('market:update', (data: MarketData) => {
      this.emit('market:update', data)
    })

    this.socket.on('candle:update', (data: { symbol: string; timeframe: string; data: CandleData }) => {
      this.emit('candle:update', data)
    })

    this.socket.on('position:update', (data: PositionUpdate) => {
      this.emit('position:update', data)
    })

    this.socket.on('balance:update', (data: BalanceUpdate) => {
      this.emit('balance:update', data)
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
    // 这里可以根据需要重新订阅市场数据等
    console.log('[Socket] Resubscribing to channels...')
  }

  // 订阅市场行情
  subscribeMarket(symbol: string, callback: (data: MarketData) => void): () => void {
    const eventName = `market:${symbol}`

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      this.socket?.emit('subscribe:market', { symbol })
    }

    const wrappedCallback = (data: unknown) => callback(data as MarketData)
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    // 返回取消订阅函数
    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
      if (this.subscriptions.get(eventName)?.size === 0) {
        this.socket?.emit('unsubscribe:market', { symbol })
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

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      this.socket?.emit('subscribe:positions', { userId })
    }

    const wrappedCallback = (data: unknown) => callback(data as PositionUpdate)
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
      if (this.subscriptions.get(eventName)?.size === 0) {
        this.socket?.emit('unsubscribe:positions', { userId })
        this.subscriptions.delete(eventName)
      }
    }
  }

  // 订阅余额更新
  subscribeBalance(userId: string, callback: (data: BalanceUpdate) => void): () => void {
    const eventName = `balance:${userId}`

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set())
      this.socket?.emit('subscribe:balance', { userId })
    }

    const wrappedCallback = (data: unknown) => callback(data as BalanceUpdate)
    this.subscriptions.get(eventName)?.add(wrappedCallback)

    return () => {
      this.subscriptions.get(eventName)?.delete(wrappedCallback)
      if (this.subscriptions.get(eventName)?.size === 0) {
        this.socket?.emit('unsubscribe:balance', { userId })
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
```

- [ ] **Step 3: 提交 Socket.IO 客户端**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/lib/socket.ts apps/web/types/socket.ts
git commit -m "feat: implement socket.io client with subscription management"
```

---

## Chunk 5: 认证 Hook

**目标:** 创建 useAuth hook 处理 SIWE 认证流程

**Files:**
- Create: `apps/web/hooks/use-auth.ts`
- Create: `apps/web/types/auth.ts`

### Task 5.1: 创建认证类型

- [ ] **Step 1: 创建 types/auth.ts**

```typescript
// apps/web/types/auth.ts

import type { User } from './api'

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  error: string | null
}

export interface AuthContextType extends AuthState {
  // 连接钱包
  connect: () => Promise<void>
  // 断开连接
  disconnect: () => Promise<void>
  // 登录（签名 SIWE）
  login: () => Promise<boolean>
  // 退出登录
  logout: () => Promise<void>
  // 清除错误
  clearError: () => void
}

// SIWE 消息参数
export interface SIWEMessageParams {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: number
  nonce: string
  issuedAt: string
}
```

### Task 5.2: 创建 useAuth Hook

- [ ] **Step 2: 创建 hooks/use-auth.ts**

```typescript
// apps/web/hooks/use-auth.ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useSignMessage, useDisconnect } from 'wagmi'
import { api } from '@/lib/api'
import type { AuthState, User } from '@/types/api'

// 创建 SIWE 消息
function createSIWEMessage(
  domain: string,
  address: string,
  nonce: string,
  chainId: number
): string {
  const issuedAt = new Date().toISOString()

  return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to PerpDex

URI: ${typeof window !== 'undefined' ? window.location.origin : 'https://perpdex.com'}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null,
  })

  const { address, isConnected, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnectAsync } = useDisconnect()

  // 检查本地存储的 token 并恢复登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

      if (token && isConnected && address) {
        setState((prev) => ({ ...prev, isLoading: true }))

        try {
          const response = await api.getCurrentUser()

          if (response.success && response.data) {
            setState({
              isAuthenticated: true,
              isLoading: false,
              user: response.data,
              error: null,
            })
          } else {
            // Token 无效，清除
            api.clearTokens()
            setState({
              isAuthenticated: false,
              isLoading: false,
              user: null,
              error: null,
            })
          }
        } catch {
          api.clearTokens()
          setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: null,
          })
        }
      }
    }

    checkAuth()
  }, [isConnected, address])

  // 登录流程
  const login = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address || !chainId) {
      setState((prev) => ({
        ...prev,
        error: '请先连接钱包',
      }))
      return false
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // 1. 获取 SIWE challenge
      const challengeResponse = await api.getAuthChallenge(address)

      if (!challengeResponse.success || !challengeResponse.data) {
        throw new Error(challengeResponse.error?.message || '获取认证挑战失败')
      }

      const { nonce } = challengeResponse.data

      // 2. 创建 SIWE 消息
      const domain = typeof window !== 'undefined' ? window.location.host : 'perpdex.com'
      const message = createSIWEMessage(domain, address, nonce, chainId)

      // 3. 签名消息
      const signature = await signMessageAsync({ message })

      // 4. 验证签名
      const verifyResponse = await api.verifySignature(message, signature)

      if (!verifyResponse.success || !verifyResponse.data) {
        throw new Error(verifyResponse.error?.message || '签名验证失败')
      }

      const { accessToken, user } = verifyResponse.data

      // 5. 保存 token
      api.setAccessToken(accessToken)

      setState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败'
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      return false
    }
  }, [isConnected, address, chainId, signMessageAsync])

  // 退出登录
  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))

    try {
      await api.logout()
      await disconnectAsync()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      api.clearTokens()
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      })
    }
  }, [disconnectAsync])

  // 清除错误
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    address,
    isConnected,
    login,
    logout,
    clearError,
  }
}

// 导出类型
export type { AuthState }
```

- [ ] **Step 3: 提交认证 Hook**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/hooks/use-auth.ts apps/web/types/auth.ts
git commit -m "feat: implement useAuth hook with SIWE authentication"
```

---

## Chunk 6: 钱包连接按钮组件

**目标:** 创建钱包连接按钮组件

**Files:**
- Create: `apps/web/components/wallet/connect-button.tsx`

### Task 6.1: 创建钱包连接按钮

- [ ] **Step 1: 创建 connect-button.tsx**

```typescript
// apps/web/components/wallet/connect-button.tsx
'use client'

import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useAuth } from '@/hooks/use-auth'
import { useEffect, useState } from 'react'

// 缩短地址显示
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function ConnectButton() {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { isAuthenticated, isLoading, login, logout, error, clearError } = useAuth()
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // 连接钱包后提示登录
  useEffect(() => {
    if (isConnected && !isAuthenticated && !isLoading) {
      setShowLoginPrompt(true)
    } else {
      setShowLoginPrompt(false)
    }
  }, [isConnected, isAuthenticated, isLoading])

  // 处理登录
  const handleLogin = async () => {
    clearError()
    const success = await login()
    if (success) {
      setShowLoginPrompt(false)
    }
  }

  // 未连接钱包 - 显示连接按钮
  if (!isConnected) {
    return (
      <button
        onClick={() => open()}
        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
      >
        连接钱包
      </button>
    )
  }

  // 已连接钱包但未登录 - 显示登录按钮
  if (isConnected && !isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        {showLoginPrompt && (
          <span className="text-sm text-yellow-400">需要登录以继续</span>
        )}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              登录中...
            </>
          ) : (
            '登录'
          )}
        </button>
        <button
          onClick={() => open()}
          className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
        >
          {shortenAddress(address || '')}
        </button>
        {error && (
          <span className="text-sm text-red-400">{error}</span>
        )}
      </div>
    )
  }

  // 已登录 - 显示地址和登出按钮
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">
        {shortenAddress(address || '')}
      </span>
      <button
        onClick={logout}
        disabled={isLoading}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium rounded-lg transition-colors"
      >
        {isLoading ? '退出中...' : '退出'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 提交钱包连接按钮**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/components/wallet/connect-button.tsx
git commit -m "feat: implement wallet connect button component"
```

---

## Chunk 7: 布局组件

**目标:** 创建 Header 和 Sidebar 布局组件

**Files:**
- Create: `apps/web/components/layout/header.tsx`
- Create: `apps/web/components/layout/sidebar.tsx`
- Modify: `apps/web/app/layout.tsx`

### Task 7.1: 创建 Header 组件

- [ ] **Step 1: 创建 header.tsx**

```typescript
// apps/web/components/layout/header.tsx
import { ConnectButton } from '@/components/wallet/connect-button'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/', label: '交易' },
  { href: '/positions', label: '仓位' },
  { href: '/assets', label: '资产' },
  { href: '/history', label: '历史' },
]

export function Header() {
  return (
    <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
      <div className="h-full px-4 flex items-center justify-between max-w-[1920px] mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-white">PerpDex</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Network Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-300">Arbitrum Sepolia</span>
          </div>

          {/* Connect Button */}
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}
```

### Task 7.2: 创建 Sidebar 组件

- [ ] **Step 2: 创建 sidebar.tsx**

```typescript
// apps/web/components/layout/sidebar.tsx
'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 工具函数
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 交易对数据类型
interface TradingPair {
  symbol: string
  name: string
  price: string
  change24h: string
  isPositive: boolean
}

// 模拟数据
const TRADING_PAIRS: TradingPair[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: '67,432.50', change24h: '+2.34%', isPositive: true },
  { symbol: 'ETH', name: 'Ethereum', price: '3,521.80', change24h: '+1.56%', isPositive: true },
  { symbol: 'SOL', name: 'Solana', price: '145.20', change24h: '-0.82%', isPositive: false },
  { symbol: 'ARB', name: 'Arbitrum', price: '1.85', change24h: '+3.21%', isPositive: true },
]

// 菜单项
const MENU_ITEMS = [
  { label: '行情', href: '/' },
  { label: '交易', href: '/trade' },
  { label: '持仓', href: '/positions' },
]

export function Sidebar() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC')
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 bottom-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 z-40',
        isExpanded ? 'w-64' : 'w-16'
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-4 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
      >
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isExpanded ? 'rotate-180' : ''
          )}
        />
      </button>

      <div className="h-full overflow-y-auto py-4">
        {/* Trading Pairs Section */}
        <div className="px-3 mb-6">
          {isExpanded && (
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-3">
              交易对
            </h3>
          )}
          <div className="space-y-1">
            {TRADING_PAIRS.map((pair) => (
              <button
                key={pair.symbol}
                onClick={() => setSelectedSymbol(pair.symbol)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  selectedSymbol === pair.symbol
                    ? 'bg-green-500/10 text-green-400'
                    : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    selectedSymbol === pair.symbol ? 'bg-green-500/20' : 'bg-gray-800'
                  )}
                >
                  <span className="text-xs font-bold">{pair.symbol[0]}</span>
                </div>

                {isExpanded && (
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{pair.symbol}/USD</span>
                      <span className="text-sm">${pair.price}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500">{pair.name}</span>
                      <span
                        className={cn(
                          'text-xs flex items-center gap-0.5',
                          pair.isPositive ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {pair.isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {pair.change24h}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Section */}
        <div className="px-3">
          {isExpanded && (
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-3">
              菜单
            </h3>
          )}
          <nav className="space-y-1">
            {MENU_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <span className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {item.label[0]}
                </span>
                {isExpanded && <span className="text-sm">{item.label}</span>}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  )
}
```

### Task 7.3: 更新根布局

- [ ] **Step 3: 更新 layout.tsx**

```typescript
// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import { Web3Provider } from "@/config/wagmi";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

export const metadata = {
  title: "PerpDex - Perpetual DEX",
  description: "Perpetual DEX MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-white min-h-screen">
        <Web3Provider>
          <Header />
          <Sidebar />
          <main className="pt-16 pl-64 min-h-screen">
            <div className="p-6">
              {children}
            </div>
          </main>
        </Web3Provider>
      </body>
    </html>
  );
}
```

### Task 7.4: 创建全局样式

- [ ] **Step 4: 创建 globals.css**

```css
/* apps/web/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 142 71% 45%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 142 71% 45%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
```

- [ ] **Step 5: 提交布局组件**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/components/layout/ apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "feat: implement header and sidebar layout components"
```

---

## Chunk 8: 环境变量配置和类型检查

**目标:** 配置环境变量和类型路径

**Files:**
- Create: `apps/web/.env.local.example`
- Modify: `apps/web/tsconfig.json`

### Task 8.1: 创建环境变量模板

- [ ] **Step 1: 创建 .env.local.example**

```bash
# apps/web/.env.local.example

# WalletConnect Project ID (从 https://cloud.reown.com/ 获取)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# API 配置
NEXT_PUBLIC_API_URL=http://localhost:3001

# WebSocket 配置
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Task 8.2: 更新 tsconfig.json

- [ ] **Step 2: 更新 tsconfig.json 添加路径别名**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Task 8.3: 创建 next.config.ts

- [ ] **Step 3: 更新 next.config.ts**

```typescript
// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@perpdex/shared"],
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
```

- [ ] **Step 4: 提交配置**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add apps/web/.env.local.example apps/web/tsconfig.json apps/web/next.config.ts
git commit -m "chore: add environment config and tsconfig paths"
```

---

## Chunk 9: 测试和验证

**目标:** 运行类型检查和构建测试

### Task 9.1: 运行类型检查

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e/apps/web
npm run typecheck
```

Expected: 无类型错误

### Task 9.2: 运行构建

- [ ] **Step 2: 尝试构建**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e/apps/web
npm run build 2>&1 | head -100
```

Expected: 构建成功或显示可修复的错误

### Task 9.3: 修复可能的类型问题

如果遇到类型错误，修复它们。

- [ ] **Step 3: 提交最终版本**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-e
git add .
git commit -m "feat: complete frontend infrastructure implementation"
```

---

## 总结

完成此计划后，将拥有以下基础设施：

1. **config/wagmi.ts** - Wagmi + Reown AppKit 配置
2. **config/constants.ts** - 应用常量配置
3. **lib/api.ts** - 带 JWT 和重试的 API 客户端
4. **lib/socket.ts** - Socket.IO 客户端封装
5. **hooks/use-auth.ts** - SIWE 认证 Hook
6. **components/wallet/connect-button.tsx** - 钱包连接按钮
7. **components/layout/header.tsx** - 顶部导航栏
8. **components/layout/sidebar.tsx** - 侧边栏导航

所有组件都支持响应式设计和暗色模式。
