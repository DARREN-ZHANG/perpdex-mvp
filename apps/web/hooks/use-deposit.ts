// apps/web/hooks/use-deposit.ts
'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { CONTRACT_ADDRESSES, ERC20_ABI, VAULT_ABI, USDC_DECIMALS } from '@/lib/contracts'
import { BALANCE_QUERY_KEY } from './use-balance'
import { useQueryClient } from '@tanstack/react-query'

export type DepositStep = 'idle' | 'checking-allowance' | 'approving' | 'approved' | 'depositing' | 'confirming' | 'confirmed' | 'error'

export interface DepositState {
  step: DepositStep
  error: string | null
  txHash: string | null
  allowance: bigint
}

export function useDeposit() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const [state, setState] = useState<DepositState>({
    step: 'idle',
    error: null,
    txHash: null,
    allowance: 0n,
  })

  // 读取 USDC 余额
  const { data: usdcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // 读取授权额度
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.VAULT as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    },
  })

  // 授权 USDC
  const { writeContract: approveUSDC, data: approveHash } = useWriteContract()
  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // 存入 Vault
  const { writeContract: depositToVault, data: depositHash } = useWriteContract()
  const { isLoading: isDepositing, isSuccess: depositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  // 执行充值流程
  const deposit = useCallback(async (amount: string) => {
    if (!address) {
      setState((prev) => ({ ...prev, step: 'error', error: '请先连接钱包' }))
      return
    }

    try {
      const amountWei = parseUnits(amount, USDC_DECIMALS)

      // 检查授权额度
      setState((prev) => ({ ...prev, step: 'checking-allowance' }))
      const { data: currentAllowance } = await refetchAllowance()
      const allowanceValue = currentAllowance ?? 0n

      // 如果授权不足，先授权
      if (allowanceValue < amountWei) {
        setState((prev) => ({ ...prev, step: 'approving' }))
        approveUSDC({
          address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.VAULT as `0x${string}`, amountWei],
        })
        return
      }

      // 直接存入
      setState((prev) => ({ ...prev, step: 'depositing' }))
      depositToVault({
        address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amountWei],
      })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : '充值失败',
      }))
    }
  }, [address, allowance, approveUSDC, depositToVault, refetchAllowance])

  // 监听授权成功
  const continueAfterApprove = useCallback(async () => {
    if (approveSuccess && approveHash) {
      setState((prev) => ({
        ...prev,
        step: 'approved',
        txHash: approveHash,
      }))

      // 重新检查授权额度
      await refetchAllowance()

      // 继续存入
      const amountInput = document.querySelector<HTMLInputElement>('[data-deposit-amount]')?.value
      if (amountInput) {
        const amountWei = parseUnits(amountInput, USDC_DECIMALS)
        setState((prev) => ({ ...prev, step: 'depositing' }))
        depositToVault({
          address: CONTRACT_ADDRESSES.VAULT as `0x${string}`,
          abi: VAULT_ABI,
          functionName: 'deposit',
          args: [amountWei],
        })
      }
    }
  }, [approveSuccess, approveHash, depositToVault, refetchAllowance])

  // 监听存入成功
  const handleDepositSuccess = useCallback(async () => {
    if (depositSuccess && depositHash) {
      setState((prev) => ({
        ...prev,
        step: 'confirmed',
        txHash: depositHash,
      }))

      // 刷新余额
      await queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY })
    }
  }, [depositSuccess, depositHash, queryClient])

  // 重置状态
  const reset = useCallback(() => {
    setState({
      step: 'idle',
      error: null,
      txHash: null,
      allowance: 0n,
    })
  }, [])

  return {
    ...state,
    usdcBalance: usdcBalance ? formatUnits(usdcBalance, USDC_DECIMALS) : '0',
    allowance: allowance ?? 0n,
    isApproving,
    isDepositing,
    deposit,
    continueAfterApprove,
    handleDepositSuccess,
    reset,
  }
}
