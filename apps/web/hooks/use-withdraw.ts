// apps/web/hooks/use-withdraw.ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import { api } from '@/lib/api'
import { BALANCE_QUERY_KEY } from './use-balance'
import { TRANSACTIONS_QUERY_KEY } from './use-transactions'
import type { WithdrawPayload } from '@/types/api'

export type WithdrawStep = 'idle' | 'submitting' | 'pending' | 'confirmed' | 'failed' | 'error'
const USDC_DECIMALS = 6

export interface WithdrawState {
  step: WithdrawStep
  error: string | null
  transactionId: string | null
  txHash: string | null
}

const POLL_INTERVAL_MS = 2000

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
      const normalizedAmount = parseUnits(amount, USDC_DECIMALS).toString()
      const response = await api.withdraw(normalizedAmount)
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

  useEffect(() => {
    if (state.step !== 'pending' || !state.transactionId) {
      return
    }

    let cancelled = false

    const pollTransactionStatus = async () => {
      try {
        const response = await api.getTransaction(state.transactionId!)

        if (!response.success || !response.data || cancelled) {
          throw new Error(response.error?.message || '获取提现状态失败')
        }

        const transaction = response.data

        if (transaction.status === 'CONFIRMED') {
          setState((prev) => ({
            ...prev,
            step: 'confirmed',
            txHash: transaction.txHash || prev.txHash,
            error: null,
          }))
          queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY })
          queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] })
          return
        }

        if (transaction.status === 'FAILED' || transaction.status === 'REVERTED') {
          setState((prev) => ({
            ...prev,
            step: 'failed',
            txHash: transaction.txHash || prev.txHash,
            error: transaction.status === 'FAILED' ? '提现失败，请稍后重试' : '提现已回滚',
          }))
          queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY })
          queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] })
          return
        }
      } catch {
        if (cancelled) {
          return
        }
      }

      setTimeout(() => {
        void pollTransactionStatus()
      }, POLL_INTERVAL_MS)
    }

    void pollTransactionStatus()

    return () => {
      cancelled = true
    }
  }, [state.step, state.transactionId, queryClient])

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
