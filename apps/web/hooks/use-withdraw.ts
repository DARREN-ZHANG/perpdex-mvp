// apps/web/hooks/use-withdraw.ts
'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { BALANCE_QUERY_KEY } from './use-balance'
import type { WithdrawPayload } from '@/types/api'

export type WithdrawStep = 'idle' | 'submitting' | 'pending' | 'confirmed' | 'failed' | 'error'

export interface WithdrawState {
  step: WithdrawStep
  error: string | null
  transactionId: string | null
  txHash: string | null
}

export function useWithdraw() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<WithdrawState>({
    step: 'idle',
    error: null,
    transactionId: null,
    txHash: null,
  })

  const withdrawMutation = useMutation({
    mutationFn: async (amount: string): Promise<WithdrawPayload> => {
      const response = await api.withdraw(amount)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error?.message || '提现请求失败')
    },
    onSuccess: (data) => {
      setState((prev) => ({
        ...prev,
        step: data.status === 'CONFIRMED' ? 'confirmed' : 'pending',
        transactionId: data.transactionId,
        txHash: data.txHash || null,
      }))

      // 刷新余额
      queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY })
    },
    onError: (error: Error) => {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error.message,
      }))
    },
  })

  const withdraw = useCallback(async (amount: string) => {
    setState({
      step: 'submitting',
      error: null,
      transactionId: null,
      txHash: null,
    })

    await withdrawMutation.mutateAsync(amount)
  }, [withdrawMutation])

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      error: null,
      transactionId: null,
      txHash: null,
    })
    withdrawMutation.reset()
  }, [withdrawMutation])

  return {
    ...state,
    isLoading: withdrawMutation.isPending,
    withdraw,
    reset,
  }
}
