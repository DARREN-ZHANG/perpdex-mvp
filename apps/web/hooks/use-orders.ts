// apps/web/hooks/use-orders.ts
'use client'

import { useState, useCallback } from 'react'
import { tradingApi } from '@/lib/trading-api'
import type {
  OrderFormData,
  CreateOrderPayload,
  Order,
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
