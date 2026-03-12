# 泳道 F: 交易核心 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现交易核心功能，包括行情图表、下单表单、订单确认和成交反馈

**Architecture:** 使用 TradingView Lightweight Charts 实现价格图表，React Hook Form + Zod 处理表单验证，自定义 Hooks 管理市场和订单状态，WebSocket 接收实时行情更新。

**Tech Stack:** Next.js 15, React 19, TypeScript, lightweight-charts, react-hook-form, zod, @hookform/resolvers

---

## 文件结构

```
apps/web/
├── components/trading/
│   ├── price-chart.tsx          # 价格图表组件 (TradingView)
│   ├── order-form.tsx           # 下单表单组件
│   ├── order-confirm.tsx        # 订单确认弹窗
│   └── trade-result.tsx         # 成交反馈组件
├── hooks/
│   ├── use-market.ts            # 行情数据 Hook
│   └── use-orders.ts            # 订单操作 Hook
├── types/
│   └── trading.ts               # 交易相关类型定义
└── lib/
    └── trading-api.ts           # 交易 API 封装
```

---

## Chunk 1: 安装依赖和类型定义

### Task 1.1: 安装交易相关依赖

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装依赖包**

```bash
cd apps/web
pnpm add lightweight-charts react-hook-form @hookform/resolvers zod
```

- [ ] **Step 2: 验证安装**

```bash
pnpm list lightweight-charts react-hook-form @hookform/resolvers zod
```
Expected: 所有包已安装

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add trading dependencies (lightweight-charts, react-hook-form, zod)"
```

---

### Task 1.2: 创建交易类型定义

**Files:**
- Create: `apps/web/types/trading.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// apps/web/types/trading.ts
import type { ApiResponse } from './api'

// 市场数据
export interface MarketData {
  symbol: string
  markPrice: string
  indexPrice: string
  change24h: string
  openInterest: string
  updatedAt: string
}

export interface MarketDetails {
  market: MarketData
  fundingRate?: string
  nextFundingAt?: string
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

// 订单相关
export type OrderSide = 'LONG' | 'SHORT'
export type OrderType = 'MARKET'
export type OrderStatus = 'PENDING' | 'FILLED' | 'FAILED' | 'CANCELED'

export interface Order {
  id: string
  userId: string
  positionId?: string
  clientOrderId?: string
  symbol: string
  side: OrderSide
  type: OrderType
  size: string
  requestedPrice?: string
  executedPrice?: string
  margin: string
  leverage: number
  status: OrderStatus
  failureCode?: string
  failureMessage?: string
  createdAt: string
  updatedAt: string
  filledAt?: string | null
}

// 仓位相关
export type PositionStatus = 'OPEN' | 'CLOSED' | 'LIQUIDATED'
export type RiskLevel = 'SAFE' | 'WARNING' | 'DANGER'

export interface Position {
  id: string
  userId: string
  symbol: string
  side: OrderSide
  positionSize: string
  entryPrice: string
  markPrice: string
  unrealizedPnl: string
  liquidationPrice: string
  margin: string
  status: PositionStatus
  riskLevel: RiskLevel
  openedAt: string
  closedAt?: string | null
  createdAt: string
  updatedAt: string
}

// 创建订单请求
export interface CreateOrderRequest {
  symbol: string
  side: OrderSide
  size: string
  margin: string
  leverage: number
  requestedPrice?: string
  clientOrderId?: string
}

// 创建订单响应
export interface CreateOrderPayload {
  order: Order
  position?: Position
  hedgeTaskId?: string
}

// 订单表单数据
export interface OrderFormData {
  side: OrderSide
  size: string
  margin: string
  leverage: number
}

// 交易结果
export interface TradeResult {
  success: boolean
  order: Order
  position?: Position
  message?: string
}

// 行情 Hook 返回类型
export interface UseMarketReturn {
  marketData: MarketData | null
  candleData: CandleData[]
  currentPrice: number
  isLoading: boolean
  error: string | null
  selectedTimeframe: Timeframe
  setSelectedTimeframe: (timeframe: Timeframe) => void
  refreshMarketData: () => Promise<void>
}

// 订单 Hook 返回类型
export interface UseOrdersReturn {
  isSubmitting: boolean
  lastOrder: Order | null
  submitOrder: (data: OrderFormData) => Promise<ApiResponse<CreateOrderPayload>>
  resetLastOrder: () => void
}

// 时间周期
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

// 图表配置
export interface ChartConfig {
  symbol: string
  timeframe: Timeframe
  containerId: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/trading.ts
git commit -m "feat: add trading types definitions"
```

---

## Chunk 2: 交易 API 封装

### Task 2.1: 创建交易 API 模块

**Files:**
- Create: `apps/web/lib/trading-api.ts`

- [ ] **Step 1: 创建交易 API 封装**

```typescript
// apps/web/lib/trading-api.ts
import { api } from './api'
import type {
  MarketDetails,
  MarketData,
  CreateOrderRequest,
  CreateOrderPayload,
  Order,
  Position,
  CandleData,
} from '@/types/trading'
import type { ApiResponse } from '@/types/api'

class TradingApi {
  // 获取市场详情
  async getMarketDetails(symbol: string): Promise<ApiResponse<MarketDetails>> {
    return api.get<MarketDetails>(`/api/markets/${symbol}`)
  }

  // 获取市场列表
  async getMarkets(): Promise<ApiResponse<{ items: MarketData[] }>> {
    return api.get<{ items: MarketData[] }>('/api/markets')
  }

  // 创建订单
  async createOrder(
    request: CreateOrderRequest
  ): Promise<ApiResponse<CreateOrderPayload>> {
    return api.post<CreateOrderPayload>('/api/trade/order', request)
  }

  // 获取仓位详情
  async getPosition(positionId: string): Promise<ApiResponse<Position>> {
    return api.get<Position>(`/api/trade/positions/${positionId}`)
  }

  // 平仓
  async closePosition(
    positionId: string
  ): Promise<ApiResponse<{ order: Order; position: Position | null }>> {
    return api.delete(`/api/trade/positions/${positionId}`)
  }

  // 调整保证金
  async adjustMargin(
    positionId: string,
    amount: string,
    operation: 'add' | 'remove'
  ): Promise<ApiResponse<{ position: Position }>> {
    return api.patch(`/api/trade/positions/${positionId}/margin`, {
      amount,
      operation,
    })
  }

  // 获取历史 K 线数据 (用于图表初始化)
  async getCandleHistory(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<ApiResponse<{ items: CandleData[] }>> {
    return api.get<{ items: CandleData[] }>(
      `/api/markets/${symbol}/candles?timeframe=${timeframe}&limit=${limit}`
    )
  }
}

// 导出单例
export const tradingApi = new TradingApi()
```

- [ ] **Step 2: Commit**

```bash
git add lib/trading-api.ts
git commit -m "feat: add trading API client"
```

---

## Chunk 3: 行情数据 Hook

### Task 3.1: 创建 use-market Hook

**Files:**
- Create: `apps/web/hooks/use-market.ts`

- [ ] **Step 1: 创建 Hook 文件**

```typescript
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
      setMarketData(data)
      setCurrentPrice(parseFloat(data.markPrice))
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
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-market.ts
git commit -m "feat: add use-market hook for market data"
```

---

## Chunk 4: 订单 Hook

### Task 4.1: 创建 use-orders Hook

**Files:**
- Create: `apps/web/hooks/use-orders.ts`

- [ ] **Step 1: 创建 Hook 文件**

```typescript
// apps/web/hooks/use-orders.ts
'use client'

import { useState, useCallback } from 'react'
import { tradingApi } from '@/lib/trading-api'
import type {
  OrderFormData,
  CreateOrderPayload,
  Order,
  OrderSide,
} from '@/types/trading'
import type { ApiResponse } from '@/types/api'

const DEFAULT_SYMBOL = 'BTC'

export interface UseOrdersReturn {
  isSubmitting: boolean
  lastOrder: Order | null
  submitOrder: (data: OrderFormData) => Promise<ApiResponse<CreateOrderPayload>>
  resetLastOrder: () => void
}

export function useOrders(symbol: string = DEFAULT_SYMBOL): UseOrdersReturn {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

  const submitOrder = useCallback(
    async (formData: OrderFormData): Promise<ApiResponse<CreateOrderPayload>> => {
      setIsSubmitting(true)

      try {
        const request = {
          symbol,
          side: formData.side,
          size: formData.size,
          margin: formData.margin,
          leverage: formData.leverage,
          clientOrderId: `order_${Date.now()}`,
        }

        const response = await tradingApi.createOrder(request)

        if (response.success && response.data) {
          setLastOrder(response.data.order)
        }

        return response
      } finally {
        setIsSubmitting(false)
      }
    },
    [symbol]
  )

  const resetLastOrder = useCallback(() => {
    setLastOrder(null)
  }, [])

  return {
    isSubmitting,
    lastOrder,
    submitOrder,
    resetLastOrder,
  }
}

// 辅助函数：计算最大可开仓位
export function calculateMaxSize(
  availableBalance: string,
  leverage: number,
  price: number
): string {
  const balance = parseFloat(availableBalance)
  const maxNotional = balance * leverage
  const maxSize = maxNotional / price
  return maxSize.toFixed(4)
}

// 辅助函数：计算所需保证金
export function calculateMargin(
  size: string,
  price: number,
  leverage: number
): string {
  const notional = parseFloat(size) * price
  const margin = notional / leverage
  return margin.toFixed(2)
}

// 辅助函数：验证订单表单
export function validateOrderForm(
  data: OrderFormData,
  availableBalance: string
): { valid: boolean; error?: string } {
  const size = parseFloat(data.size)
  const margin = parseFloat(data.margin)
  const balance = parseFloat(availableBalance)

  if (size <= 0) {
    return { valid: false, error: '数量必须大于0' }
  }

  if (margin <= 0) {
    return { valid: false, error: '保证金必须大于0' }
  }

  if (margin > balance) {
    return { valid: false, error: '保证金不足' }
  }

  if (data.leverage < 1 || data.leverage > 20) {
    return { valid: false, error: '杠杆倍数必须在 1-20 之间' }
  }

  return { valid: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-orders.ts
git commit -m "feat: add use-orders hook for order management"
```

---

## Chunk 5: 价格图表组件

### Task 5.1: 创建 PriceChart 组件

**Files:**
- Create: `apps/web/components/trading/price-chart.tsx`

- [ ] **Step 1: 创建图表组件**

```typescript
// apps/web/components/trading/price-chart.tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts'
import type { CandleData, Timeframe } from '@/types/trading'

interface PriceChartProps {
  data: CandleData[]
  currentPrice: number
  symbol: string
  timeframe: Timeframe
  onTimeframeChange: (timeframe: Timeframe) => void
  isLoading?: boolean
}

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
]

export function PriceChart({
  data,
  currentPrice,
  symbol,
  timeframe,
  onTimeframeChange,
  isLoading = false,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#6b7280',
          labelBackgroundColor: '#6b7280',
        },
        horzLine: {
          color: '#6b7280',
          labelBackgroundColor: '#6b7280',
        },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries

    // 响应式处理
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // 更新数据
  useEffect(() => {
    if (!candlestickSeriesRef.current || data.length === 0) return

    const chartData: CandlestickData<Time>[] = data.map((candle) => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }))

    candlestickSeriesRef.current.setData(chartData)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // 实时更新最新价格
  useEffect(() => {
    if (!candlestickSeriesRef.current || data.length === 0 || currentPrice <= 0)
      return

    const lastCandle = data[data.length - 1]
    if (!lastCandle) return

    const updatedCandle: CandlestickData<Time> = {
      time: lastCandle.time as Time,
      open: lastCandle.open,
      high: Math.max(lastCandle.high, currentPrice),
      low: Math.min(lastCandle.low, currentPrice),
      close: currentPrice,
    }

    candlestickSeriesRef.current.update(updatedCandle)
  }, [currentPrice, data])

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">{symbol}/USD</h3>
          <span
            className={`text-sm font-medium ${
              currentPrice >= (data[data.length - 1]?.open || 0)
                ? 'text-green-500'
                : 'text-red-500'
            }`}
          >
            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* 时间周期选择 */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                timeframe === tf.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 图表容器 */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/trading/price-chart.tsx
git commit -m "feat: add price chart component with TradingView"
```

---

## Chunk 6: 下单表单组件

### Task 6.1: 创建 OrderForm 组件

**Files:**
- Create: `apps/web/components/trading/order-form.tsx`

- [ ] **Step 1: 创建表单组件**

```typescript
// apps/web/components/trading/order-form.tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { OrderSide, OrderFormData } from '@/types/trading'
import { TRADING_CONFIG } from '@/config/constants'

interface OrderFormProps {
  currentPrice: number
  availableBalance: string
  onSubmit: (data: OrderFormData) => Promise<void>
  isSubmitting: boolean
}

// Zod 验证 schema
const orderFormSchema = z.object({
  side: z.enum(['LONG', 'SHORT']),
  size: z.string().min(1, '请输入数量'),
  margin: z.string().min(1, '请输入保证金'),
  leverage: z.number().min(1).max(20),
})

type OrderFormValues = z.infer<typeof orderFormSchema>

export function OrderForm({
  currentPrice,
  availableBalance,
  onSubmit,
  isSubmitting,
}: OrderFormProps) {
  const [selectedSide, setSelectedSide] = useState<OrderSide>('LONG')
  const balanceNum = parseFloat(availableBalance) || 0

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      side: 'LONG',
      size: '',
      margin: '',
      leverage: TRADING_CONFIG.DEFAULT_LEVERAGE,
    },
  })

  const watchSize = watch('size')
  const watchMargin = watch('margin')
  const watchLeverage = watch('leverage')

  // 计算预估信息
  const estimate = useMemo(() => {
    const size = parseFloat(watchSize) || 0
    const margin = parseFloat(watchMargin) || 0
    const leverage = watchLeverage || 1

    if (size > 0 && currentPrice > 0) {
      const notional = size * currentPrice
      const requiredMargin = notional / leverage
      return {
        notional: notional.toFixed(2),
        requiredMargin: requiredMargin.toFixed(2),
        liquidationPrice:
          selectedSide === 'LONG'
            ? (currentPrice * (1 - 0.9 / leverage)).toFixed(2)
            : (currentPrice * (1 + 0.9 / leverage)).toFixed(2),
      }
    }

    return null
  }, [watchSize, watchMargin, watchLeverage, currentPrice, selectedSide])

  // 处理方向切换
  const handleSideChange = useCallback(
    (side: OrderSide) => {
      setSelectedSide(side)
      setValue('side', side)
    },
    [setValue]
  )

  // 处理百分比输入
  const handlePercentageClick = useCallback(
    (percentage: number) => {
      const margin = (balanceNum * percentage).toFixed(2)
      setValue('margin', margin)

      // 根据保证金计算数量
      if (currentPrice > 0 && watchLeverage > 0) {
        const notional = parseFloat(margin) * watchLeverage
        const size = (notional / currentPrice).toFixed(4)
        setValue('size', size)
      }
    },
    [balanceNum, currentPrice, watchLeverage, setValue]
  )

  // 处理杠杆变化
  const handleLeverageChange = useCallback(
    (value: number) => {
      setValue('leverage', value)

      // 重新计算数量
      if (watchMargin && currentPrice > 0) {
        const notional = parseFloat(watchMargin) * value
        const size = (notional / currentPrice).toFixed(4)
        setValue('size', size)
      }
    },
    [watchMargin, currentPrice, setValue]
  )

  // 表单提交
  const handleFormSubmit = useCallback(
    async (values: OrderFormValues) => {
      await onSubmit({
        side: values.side,
        size: values.size,
        margin: values.margin,
        leverage: values.leverage,
      })
    },
    [onSubmit]
  )

  return (
    <div className="w-full bg-gray-900 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">下单</h3>

      {/* 多空选择 */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleSideChange('LONG')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            selectedSide === 'LONG'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          做多
        </button>
        <button
          type="button"
          onClick={() => handleSideChange('SHORT')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            selectedSide === 'SHORT'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          做空
        </button>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* 杠杆滑块 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-gray-400">杠杆</label>
            <span className="text-sm font-medium text-white">
              {watchLeverage}x
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={TRADING_CONFIG.MAX_LEVERAGE}
            {...register('leverage', { valueAsNumber: true })}
            onChange={(e) => handleLeverageChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1x</span>
            <span>{TRADING_CONFIG.MAX_LEVERAGE}x</span>
          </div>
        </div>

        {/* 保证金输入 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            保证金 (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              {...register('margin')}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
              placeholder="0.00"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              USDC
            </span>
          </div>
          {errors.margin && (
            <p className="text-red-500 text-xs mt-1">{errors.margin.message}</p>
          )}

          {/* 快捷百分比 */}
          <div className="flex gap-2 mt-2">
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentageClick(pct)}
                className="flex-1 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
              >
                {pct * 100}%
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            可用余额: {balanceNum.toFixed(2)} USDC
          </p>
        </div>

        {/* 数量输入 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            数量 (BTC)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.0001"
              {...register('size')}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
              placeholder="0.0000"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              BTC
            </span>
          </div>
          {errors.size && (
            <p className="text-red-500 text-xs mt-1">{errors.size.message}</p>
          )}
        </div>

        {/* 预估信息 */}
        {estimate && (
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">名义价值</span>
              <span className="text-white">${estimate.notional}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">所需保证金</span>
              <span className="text-white">${estimate.requiredMargin}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">预估强平价</span>
              <span className="text-red-400">${estimate.liquidationPrice}</span>
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedSide === 'LONG'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              提交中...
            </span>
          ) : (
            `${selectedSide === 'LONG' ? '买入/做多' : '卖出/做空'}`
          )}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/trading/order-form.tsx
git commit -m "feat: add order form component with react-hook-form"
```

---

## Chunk 7: 订单确认弹窗

### Task 7.1: 创建 OrderConfirm 组件

**Files:**
- Create: `apps/web/components/trading/order-confirm.tsx`

- [ ] **Step 1: 创建确认弹窗组件**

```typescript
// apps/web/components/trading/order-confirm.tsx
'use client'

import { useCallback } from 'react'
import type { OrderFormData } from '@/types/trading'

interface OrderConfirmProps {
  isOpen: boolean
  formData: OrderFormData | null
  currentPrice: number
  onConfirm: () => void
  onCancel: () => void
}

export function OrderConfirm({
  isOpen,
  formData,
  currentPrice,
  onConfirm,
  onCancel,
}: OrderConfirmProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel()
      }
    },
    [onCancel]
  )

  if (!isOpen || !formData) return null

  const notional = parseFloat(formData.size) * currentPrice
  const isLong = formData.side === 'LONG'

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-white mb-4">确认订单</h3>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">方向</span>
            <span
              className={`font-medium ${
                isLong ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {isLong ? '做多' : '做空'}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">杠杆</span>
            <span className="text-white font-medium">{formData.leverage}x</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">数量</span>
            <span className="text-white font-medium">
              {formData.size} BTC
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">保证金</span>
            <span className="text-white font-medium">
              {formData.margin} USDC
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">名义价值</span>
            <span className="text-white font-medium">
              ${notional.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">当前价格</span>
            <span className="text-white font-medium">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">订单类型</span>
            <span className="text-white font-medium">市价单</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              isLong
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            确认下单
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/trading/order-confirm.tsx
git commit -m "feat: add order confirmation modal"
```

---

## Chunk 8: 成交反馈组件

### Task 8.1: 创建 TradeResult 组件

**Files:**
- Create: `apps/web/components/trading/trade-result.tsx`

- [ ] **Step 1: 创建成交反馈组件**

```typescript
// apps/web/components/trading/trade-result.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Order, Position } from '@/types/trading'

interface TradeResultProps {
  order: Order | null
  position?: Position
  onClose: () => void
}

export function TradeResult({ order, position, onClose }: TradeResultProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (order) {
      setIsVisible(true)
      // 5秒后自动关闭
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [order, onClose])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }, [onClose])

  if (!order) return null

  const isSuccess = order.status === 'FILLED'
  const isLong = order.side === 'LONG'

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-sm w-full bg-gray-900 rounded-xl shadow-2xl border-l-4 transition-all duration-300 z-50 ${
        isSuccess
          ? 'border-green-500'
          : order.status === 'FAILED'
          ? 'border-red-500'
          : 'border-yellow-500'
      } ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* 状态图标 */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isSuccess
                  ? 'bg-green-500/20'
                  : order.status === 'FAILED'
                  ? 'bg-red-500/20'
                  : 'bg-yellow-500/20'
              }`}
            >
              {isSuccess ? (
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : order.status === 'FAILED' ? (
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-yellow-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-white">
                {isSuccess
                  ? '订单成交'
                  : order.status === 'FAILED'
                  ? '订单失败'
                  : '订单处理中'}
              </h4>
              <p className="text-sm text-gray-400">
                {order.symbol} {isLong ? '做多' : '做空'} {order.size} @ {' '}
                {order.executedPrice || order.requestedPrice || '市价'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 详细信息 */}
        {isSuccess && position && (
          <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">仓位 ID</span>
              <span className="text-white font-mono text-xs">
                {position.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">入场价格</span>
              <span className="text-white">${position.entryPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">杠杆</span>
              <span className="text-white">{order.leverage}x</span>
            </div>
          </div>
        )}

        {/* 失败原因 */}
        {order.status === 'FAILED' && order.failureMessage && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-sm text-red-400">{order.failureMessage}</p>
          </div>
        )}
      </div>

      {/* 进度条（自动关闭） */}
      <div className="h-1 bg-gray-800 rounded-b-xl overflow-hidden">
        <div
          className={`h-full ${
            isSuccess ? 'bg-green-500' : order.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'
          }`}
          style={{
            animation: 'progress 5s linear forwards',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/trading/trade-result.tsx
git commit -m "feat: add trade result notification component"
```

---

## Chunk 9: 导出索引文件

### Task 9.1: 创建组件导出索引

**Files:**
- Create: `apps/web/components/trading/index.ts`

- [ ] **Step 1: 创建索引文件**

```typescript
// apps/web/components/trading/index.ts
export { PriceChart } from './price-chart'
export { OrderForm } from './order-form'
export { OrderConfirm } from './order-confirm'
export { TradeResult } from './trade-result'
```

- [ ] **Step 2: Commit**

```bash
git add components/trading/index.ts
git commit -m "feat: add trading components index export"
```

---

## Chunk 10: 类型检查和测试

### Task 10.1: 运行类型检查

**Files:**
- All modified files

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
cd apps/web
pnpm typecheck
```
Expected: 无类型错误

- [ ] **Step 2: 运行 ESLint**

```bash
pnpm lint
```
Expected: 无 lint 错误

- [ ] **Step 3: 构建测试**

```bash
pnpm build
```
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: verify types and build"
```

---

## 总结

完成所有任务后，将交付以下文件：

1. `components/trading/price-chart.tsx` - TradingView 价格图表
2. `components/trading/order-form.tsx` - 下单表单（React Hook Form + Zod）
3. `components/trading/order-confirm.tsx` - 订单确认弹窗
4. `components/trading/trade-result.tsx` - 成交反馈通知
5. `components/trading/index.ts` - 组件导出索引
6. `hooks/use-market.ts` - 行情数据 Hook
7. `hooks/use-orders.ts` - 订单操作 Hook
8. `types/trading.ts` - 交易类型定义
9. `lib/trading-api.ts` - 交易 API 封装

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-12-lane-f-trading-core.md`. Ready to execute?**
