// apps/web/hooks/use-positions.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { Position } from '@perpdex/shared'

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
  const response = await api.get<Position[]>('/api/user/positions')
  if (!response.success) {
    throw new Error(response.error?.message || '获取仓位列表失败')
  }
  return response.data || []
}

// 平仓
async function closePosition(positionId: string): Promise<void> {
  const response = await api.post(`/api/trade/positions/${positionId}/close`)
  if (!response.success) {
    throw new Error(response.error?.message || '平仓失败')
  }
}

export function usePositions() {
  const queryClient = useQueryClient()
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)

  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['positions'],
    queryFn: fetchPositions,
    refetchInterval: 2000, // 2秒自动刷新
    staleTime: 1000,
  })

  const closeMutation = useMutation({
    mutationFn: closePosition,
    onSuccess: () => {
      // 刷新仓位列表
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      // 刷新余额
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })

  const handleClosePosition = async (positionId: string): Promise<boolean> => {
    setClosingPositionId(positionId)
    try {
      await closeMutation.mutateAsync(positionId)
      return true
    } catch (error) {
      console.error('平仓失败:', error)
      return false
    } finally {
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
    isClosing: (positionId: string) => closingPositionId === positionId,
    isClosingAny: closingPositionId !== null,
    totalUnrealizedPnl,
    totalMargin,
  }
}
