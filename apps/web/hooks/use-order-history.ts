'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const ORDER_HISTORY_QUERY_KEY = 'order-history'

interface UseOrderHistoryOptions {
  limit?: number
}

export function useOrderHistory(options: UseOrderHistoryOptions = {}) {
  const { limit = 20 } = options

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [ORDER_HISTORY_QUERY_KEY, { limit }],
    queryFn: async ({ pageParam }) => {
      const response = await api.getOrders({
        cursor: pageParam,
        limit,
      })

      if (response.success && response.data) {
        return response.data
      }

      throw new Error(response.error?.message || '获取订单历史失败')
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    staleTime: 30000,
  })

  const orders = data?.pages.flatMap((page) => page.items) ?? []

  return {
    orders,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  }
}

export { ORDER_HISTORY_QUERY_KEY }
