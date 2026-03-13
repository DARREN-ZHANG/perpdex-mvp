// apps/web/hooks/use-orders.ts
'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { tradingApi } from '@/lib/trading-api'
import { TRADING_CONFIG } from '@/config/constants'
import type { OrderFormData, Order } from '@/types/trading'
import type { ApiResponse } from '@/types/api'
import type { CreateOrderResponse } from '@/lib/trading-api'
import { BALANCE_QUERY_KEY } from './use-balance'
import { ORDER_HISTORY_QUERY_KEY } from './use-order-history'
import { TRANSACTIONS_QUERY_KEY } from './use-transactions'

const DEFAULT_SYMBOL = 'BTC'

export interface UseOrdersReturn {
  isSubmitting: boolean
  lastOrder: Order | null
  submitOrder: (data: OrderFormData) => Promise<ApiResponse<CreateOrderResponse>>
  resetLastOrder: () => void
}

export function useOrders(symbol: string = DEFAULT_SYMBOL): UseOrdersReturn {
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

  const submitOrder = useCallback(
    async (formData: OrderFormData): Promise<ApiResponse<CreateOrderResponse>> => {
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
          queryClient.invalidateQueries({ queryKey: ['positions'] })
          queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY })
          queryClient.invalidateQueries({ queryKey: [ORDER_HISTORY_QUERY_KEY] })
          queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] })
        }

        return response
      } finally {
        setIsSubmitting(false)
      }
    },
    [queryClient, symbol]
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
    return { valid: false, error: '金额必须大于0' }
  }

  if (margin < TRADING_CONFIG.MIN_MARGIN) {
    return { valid: false, error: `金额不能低于 ${TRADING_CONFIG.MIN_MARGIN} USDC` }
  }

  if (margin > balance) {
    return { valid: false, error: '金额不足' }
  }

  if (data.leverage < 1 || data.leverage > 20) {
    return { valid: false, error: '杠杆倍数必须在 1-20 之间' }
  }

  return { valid: true }
}
