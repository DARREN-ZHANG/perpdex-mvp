// apps/web/hooks/use-positions.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { socketClient } from '@/lib/socket'
import { useAuth } from './use-auth'
import type { Position } from '@perpdex/shared'
import type { PositionUpdate } from '@/types/socket'
import { BALANCE_QUERY_KEY } from './use-balance'
import { ORDER_HISTORY_QUERY_KEY } from './use-order-history'
import { TRANSACTIONS_QUERY_KEY } from './use-transactions'

// 格式化金额
export function formatAmount(amount: string, decimals: number = 2): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0.00'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// 格式化价格
export function formatPrice(price: string): string {
  const num = parseFloat(price)
  if (isNaN(num)) return '$0.00'
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// 格式化盈亏
export function formatPnL(pnl: string): {
  value: string
  isPositive: boolean
  isNegative: boolean
} {
  const num = parseFloat(pnl)
  const isPositive = num > 0
  const isNegative = num < 0
  const absValue = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return { value: absValue, isPositive, isNegative }
}

// 获取风险等级颜色
export function getRiskLevelColor(riskLevel: Position['riskLevel']): string {
  switch (riskLevel) {
    case 'SAFE':
      return 'bg-green-500'
    case 'WARNING':
      return 'bg-yellow-500'
    case 'DANGER':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

// 获取风险等级文本
export function getRiskLevelText(riskLevel: Position['riskLevel']): string {
  switch (riskLevel) {
    case 'SAFE':
      return '安全'
    case 'WARNING':
      return '警告'
    case 'DANGER':
      return '危险'
    default:
      return '未知'
  }
}

// 获取仓位列表
async function fetchPositions(): Promise<Position[]> {
  const response = await api.get<{ items: Position[] }>('/api/user/positions')
  if (!response.success) {
    throw new Error(response.error?.message || '获取仓位列表失败')
  }
  return response.data?.items || []
}

// 平仓
async function closePosition(positionId: string): Promise<void> {
  const response = await api.delete(`/api/trade/positions/${positionId}`)
  if (!response.success) {
    throw new Error(response.error?.message || '平仓失败')
  }
}

export function usePositions() {
  const queryClient = useQueryClient()
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)
  const [isClosingAll, setIsClosingAll] = useState(false)
  const { user } = useAuth()

  const refreshTradingQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['positions'] }),
      queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: [ORDER_HISTORY_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] }),
    ])
  }

  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['positions'],
    queryFn: fetchPositions,
    staleTime: 30000, // 30秒缓存时间
  })

  // WebSocket 订阅仓位实时更新
  useEffect(() => {
    if (!user?.id) return

    // 确保 Socket 已连接
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : undefined
    socketClient.connect(token ?? undefined)

    // 订阅仓位更新
    const unsubscribe = socketClient.subscribePositions(
      user.id,
      (_data: PositionUpdate) => {
        void refreshTradingQueries()
      }
    )

    return () => {
      unsubscribe()
    }
  }, [user?.id, queryClient])

  const closeMutation = useMutation({
    mutationFn: closePosition,
    onSuccess: async () => {
      await refreshTradingQueries()
    },
  })

  const handleClosePosition = async (
    positionId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setClosingPositionId(positionId)
    try {
      await closeMutation.mutateAsync(positionId)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : '平仓失败'
      console.error('平仓失败:', error)
      return { success: false, error: message }
    } finally {
      setClosingPositionId(null)
    }
  }

  const handleCloseAllPositions = async (): Promise<{
    success: boolean
    closedCount: number
    failedCount: number
    error?: string
  }> => {
    if (positions.length === 0) {
      return { success: true, closedCount: 0, failedCount: 0 }
    }

    setIsClosingAll(true)

    try {
      let closedCount = 0
      let failedCount = 0
      let firstError: unknown

      for (const position of positions) {
        try {
          await closeMutation.mutateAsync(position.id)
          closedCount += 1
        } catch (error) {
          failedCount += 1
          if (!firstError) {
            firstError = error
          }
        }
      }

      await refreshTradingQueries()

      if (failedCount > 0) {
        return {
          success: false,
          closedCount,
          failedCount,
          error: firstError instanceof Error ? firstError.message : '部分仓位平仓失败',
        }
      }

      return {
        success: true,
        closedCount,
        failedCount: 0,
      }
    } finally {
      setIsClosingAll(false)
      setClosingPositionId(null)
    }
  }

  // 计算总未实现盈亏
  const totalUnrealizedPnl = positions.reduce((sum, pos) => {
    return sum + parseFloat(pos.unrealizedPnl)
  }, 0)

  // 计算总保证金
  const totalMargin = positions.reduce((sum, pos) => {
    return sum + parseFloat(pos.margin)
  }, 0)

  return {
    positions,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : '未知错误',
    refetch,
    closePosition: handleClosePosition,
    closeAllPositions: handleCloseAllPositions,
    isClosing: (positionId: string) => closingPositionId === positionId,
    isClosingAny: closingPositionId !== null,
    isClosingAll,
    totalUnrealizedPnl,
    totalMargin,
  }
}
