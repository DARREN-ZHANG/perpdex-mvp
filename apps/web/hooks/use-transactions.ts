// apps/web/hooks/use-transactions.ts
'use client'

import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Transaction, TransactionType } from '@/types/api'

const TRANSACTIONS_QUERY_KEY = 'transactions'

interface UseTransactionsOptions {
  type?: TransactionType
  limit?: number
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { type, limit = 20 } = options

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, { type }],
    queryFn: async ({ pageParam }) => {
      const response = await api.getTransactions({
        cursor: pageParam,
        limit,
        type,
      })
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error?.message || '获取交易历史失败')
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 30000,
  })

  // 扁平化交易列表
  const transactions = data?.pages.flatMap((page) => page.items) ?? []

  return {
    transactions,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  }
}

// 获取单条交易详情
export function useTransactionDetail(transactionId: string) {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, transactionId],
    queryFn: async () => {
      // 暂时通过列表查询获取，后续可添加单独接口
      const response = await api.getTransactions({ limit: 100 })
      if (response.success && response.data) {
        const tx = response.data.items.find((t) => t.id === transactionId)
        if (tx) return tx
      }
      throw new Error('交易未找到')
    },
    enabled: !!transactionId,
  })
}
