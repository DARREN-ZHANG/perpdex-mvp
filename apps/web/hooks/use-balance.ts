// apps/web/hooks/use-balance.ts
'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { socketClient } from '@/lib/socket'
import { useAuth } from './use-auth'
import type { AccountBalance } from '@/types/api'
import type { BalanceUpdate } from '@/types/socket'

const BALANCE_QUERY_KEY = ['balance']

// 将 BalanceUpdate 转换为 AccountBalance
function convertBalanceUpdate(update: BalanceUpdate): AccountBalance {
  return {
    userId: update.userId,
    asset: update.asset as 'USDC',
    availableBalance: update.availableBalance,
    lockedBalance: (parseFloat(update.orderMargin) + parseFloat(update.positionMargin)).toString(),
    equity: update.walletBalance,
    updatedAt: update.updatedAt,
  }
}

export function useBalance() {
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useAuth()

  const {
    data: balance,
    isLoading,
    error,
    refetch,
  } = useQuery<AccountBalance | null>({
    queryKey: BALANCE_QUERY_KEY,
    queryFn: async () => {
      const response = await api.getBalance()
      if (response.success && response.data) {
        return response.data
      }
      return null
    },
    staleTime: 30000, // 30秒内不重新获取
    enabled: isAuthenticated, // 只在已登录时启用查询
  })

  // WebSocket 订阅余额更新
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    // 获取 token 并连接 socket
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) return

    // 确保 socket 已连接
    socketClient.connect(token)

    // 订阅余额更新
    const unsubscribe = socketClient.subscribeBalance(user.id, (data: BalanceUpdate) => {
      // 使用 WebSocket 数据更新缓存
      queryClient.setQueryData<AccountBalance>(
        BALANCE_QUERY_KEY,
        convertBalanceUpdate(data)
      )
    })

    return () => {
      // 清理订阅
      unsubscribe()
    }
  }, [user?.id, isAuthenticated, queryClient])

  // 手动刷新余额
  const refreshBalance = async () => {
    await refetch()
  }

  // 乐观更新余额
  const updateBalance = (updater: (prev: AccountBalance | null) => AccountBalance | null) => {
    queryClient.setQueryData(BALANCE_QUERY_KEY, updater)
  }

  return {
    balance,
    isLoading,
    error,
    refreshBalance,
    updateBalance,
  }
}

// 导出查询键，供其他hooks使用
export { BALANCE_QUERY_KEY }
