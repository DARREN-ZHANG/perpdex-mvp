// apps/web/hooks/use-positions.ts
'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Position } from '@perpdex/shared'

interface PositionsResponse {
  items: Position[]
}

interface ClosePositionResponse {
  order: unknown
  position: Position | null
  hedgeTaskId?: string
}

// 获取仓位列表
async function fetchPositions(): Promise<Position[]> {
  const response = await api.get<PositionsResponse>('/api/user/positions')

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || '获取仓位列表失败')
  }

  return response.data.items
}

// 平仓
async function closePosition(positionId: string): Promise<ClosePositionResponse> {
  const response = await api.delete<ClosePositionResponse>(`/api/trade/positions/${positionId}`)

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || '平仓失败')
  }

  return response.data
}

// 格式化金额
export function formatAmount(amount: string, decimals = 4): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
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

// 格式化PnL
export function formatPnL(pnl: string): { value: string; isPositive: boolean; isNegative: boolean } {
  const num = parseFloat(pnl)
  const isPositive = num > 0
  const isNegative = num < 0

  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return {
    value: formatted,
    isPositive,
    isNegative,
  }
}

// 计算风险等级颜色
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

// 计算风险等级文本
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

export function usePositions() {
  const queryClient = useQueryClient()
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)

  // 查询仓位列表
  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['positions'],
    queryFn: fetchPositions,
    refetchInterval: 2000, // 每2秒刷新一次
    staleTime: 1000,
  })

  // 平仓mutation
  const closeMutation = useMutation({
    mutationFn: closePosition,
    onSuccess: () => {
      // 成功后刷新仓位列表和余额
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })

  // 执行平仓
  const closePositionHandler = useCallback(
    async (positionId: string): Promise<boolean> => {
      setClosingPositionId(positionId)
      try {
        await closeMutation.mutateAsync(positionId)
        return true
      } catch {
        return false
      } finally {
        setClosingPositionId(null)
      }
    },
    [closeMutation]
  )

  // 过滤出开仓状态的仓位
  const openPositions = positions.filter((p) => p.status === 'OPEN')

  // 计算总未实现盈亏
  const totalUnrealizedPnl = openPositions.reduce((sum: number, p: Position) => {
    return sum + parseFloat(p.unrealizedPnl)
  }, 0)

  // 计算总保证金
  const totalMargin = openPositions.reduce((sum: number, p: Position) => {
    return sum + parseFloat(p.margin)
  }, 0)

  return {
    positions: openPositions,
    allPositions: positions,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : null,
    refetch,
    closePosition: closePositionHandler,
    isClosing: closeMutation.isPending,
    closingPositionId,
    closeError: closeMutation.error instanceof Error ? closeMutation.error.message : null,
    totalUnrealizedPnl,
    totalMargin,
  }
}
