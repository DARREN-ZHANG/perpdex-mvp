// apps/web/hooks/use-balance.ts
'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AccountBalance } from '@/types/api'

const BALANCE_QUERY_KEY = ['balance']

export function useBalance() {
  const queryClient = useQueryClient()

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
    refetchInterval: 60000, // 每分钟自动刷新
  })

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
