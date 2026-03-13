// apps/web/hooks/use-positions.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { socketClient } from '@/lib/socket'
import { useAuth } from './use-auth'
import type { Position } from '@perpdex/shared'
import type { PositionUpdate } from '@/types/socket'

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
  const response = await api.post(`/api/trade/positions/${positionId}/close`)
  if (!response.success) {
    throw new Error(response.error?.message || '平仓失败')
  }
}

export function usePositions() {
  const queryClient = useQueryClient()
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null)
  const { user } = useAuth()

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
    const socket = socketClient.connect(token ?? undefined)

    // 订阅仓位更新
    const unsubscribe = socketClient.subscribePositions(
      user.id,
      (data: PositionUpdate) => {
        queryClient.setQueryData(['positions'], (old: Position[] | undefined) => {
          const existingPositions = old ?? []

          // 根据 PositionUpdate 更新现有仓位
          return existingPositions.map((pos) => {
            if (pos.id === data.positionId) {
              return {
                ...pos,
                markPrice: data.markPrice,
                unrealizedPnl: data.unrealizedPnl,
                liquidationPrice: data.liquidationPrice,
                updatedAt: data.updatedAt,
              }
            }
            return pos
          })
        })
      }
    )

    return () => {
      unsubscribe()
    }
  }, [user?.id, queryClient])

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
