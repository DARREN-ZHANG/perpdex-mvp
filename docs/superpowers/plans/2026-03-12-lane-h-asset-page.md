# 泳道 H: 资产页面实现计划

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现资产页面功能，包括余额显示、充值流程、提现流程和交易历史记录

**Architecture:** 基于现有基础设施（Wagmi+AppKit、API客户端、认证Hook），使用 React + TypeScript + Tailwind CSS 构建组件。充值使用链上合约交互（approve + deposit），提现调用后端API，历史记录使用分页查询。

**Tech Stack:** Next.js 15, React 19, TypeScript, Reown AppKit, Wagmi, viem, TanStack Query, Tailwind CSS

---

## 文件结构

### 新建文件
- `apps/web/hooks/use-balance.ts` - 余额查询 Hook
- `apps/web/hooks/use-transactions.ts` - 交易历史 Hook
- `apps/web/hooks/use-deposit.ts` - 充值操作 Hook
- `apps/web/hooks/use-withdraw.ts` - 提现操作 Hook
- `apps/web/components/asset/balance-card.tsx` - 余额卡片组件
- `apps/web/components/asset/deposit-flow.tsx` - 充值流程组件
- `apps/web/components/asset/withdraw-flow.tsx` - 提现流程组件
- `apps/web/components/asset/transaction-history.tsx` - 交易历史组件
- `apps/web/app/assets/page.tsx` - 资产页面
- `apps/web/lib/contracts.ts` - 合约ABI和地址配置

### 修改文件
- `apps/web/lib/api.ts` - 添加资产相关API方法
- `apps/web/types/api.ts` - 添加资产相关类型

---

## Chunk 1: 类型定义和API扩展

### Task 1.1: 添加资产相关类型

**Files:**
- Modify: `apps/web/types/api.ts`

**说明:** 根据 `packages/shared/src/domain.ts` 和 `packages/shared/src/api.ts` 中的定义，添加资产相关的类型。

- [ ] **Step 1: 添加余额类型**

在 `apps/web/types/api.ts` 中添加：

```typescript
// 资产相关类型
export interface AccountBalance {
  userId: string
  asset: 'USDC'
  availableBalance: string
  lockedBalance: string
  equity: string
  updatedAt: string
}

// 交易记录类型
export type TransactionType = 'DEPOSIT' | 'WITHDRAW' | 'MARGIN_LOCK' | 'MARGIN_RELEASE' | 'REALIZED_PNL' | 'FEE' | 'LIQUIDATION'
export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REVERTED'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  eventName?: 'DEPOSIT' | 'WITHDRAW' | null
  txHash?: string | null
  logIndex?: number | null
  amount: string
  status: TransactionStatus
  idempotencyKey?: string
  createdAt: string
  updatedAt: string
  confirmedAt?: string | null
}

// 提现请求
export interface WithdrawRequest {
  amount: string
}

export interface WithdrawPayload {
  transactionId: string
  txHash?: string
  status: TransactionStatus
}

// 分页查询参数
export interface PaginationQuery {
  cursor?: string
  limit?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  nextCursor?: string
  hasMore: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/types/api.ts
git commit -m "feat(types): add asset-related types"
```

---

### Task 1.2: 扩展API客户端

**Files:**
- Modify: `apps/web/lib/api.ts`

**说明:** 添加资产相关的API方法。

- [ ] **Step 1: 导入新增类型**

在 `apps/web/lib/api.ts` 中导入：

```typescript
import type {
  // ... 现有类型
  AccountBalance,
  Transaction,
  WithdrawRequest,
  WithdrawPayload,
  PaginationQuery,
  PaginatedResponse,
} from '@/types/api'
```

- [ ] **Step 2: 添加API方法**

在 `ApiClient` 类中添加：

```typescript
  // ========== 资产相关 API ==========

  // 获取用户余额
  async getBalance(): Promise<ApiResponse<AccountBalance>> {
    return this.get<AccountBalance>('/api/user/balance')
  }

  // 获取交易历史
  async getTransactions(
    query?: PaginationQuery & { type?: Transaction['type'] }
  ): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
    const params = new URLSearchParams()
    if (query?.cursor) params.append('cursor', query.cursor)
    if (query?.limit) params.append('limit', query.limit.toString())
    if (query?.type) params.append('type', query.type)

    const queryString = params.toString()
    return this.get<PaginatedResponse<Transaction>>(
      `/api/user/history${queryString ? `?${queryString}` : ''}`
    )
  }

  // 发起提现
  async withdraw(amount: string): Promise<ApiResponse<WithdrawPayload>> {
    return this.post<WithdrawPayload>('/api/user/withdraw', { amount })
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat(api): add asset-related API methods"
```

---

## Chunk 2: 合约配置

### Task 2.1: 创建合约配置

**Files:**
- Create: `apps/web/lib/contracts.ts`

**说明:** 配置Vault合约和USDC合约的ABI及地址。

- [ ] **Step 1: 创建合约配置文件**

```typescript
// apps/web/lib/contracts.ts

// Arbitrum Sepolia 合约地址
export const CONTRACT_ADDRESSES = {
  // Vault 合约地址（部署后更新）
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000',
  // USDC 合约地址（Arbitrum Sepolia）
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
} as const

// ERC20 标准 ABI（USDC）
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'symbol', type: 'string' }],
  },
] as const

// Vault 合约 ABI
export const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'USDC',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'usdc', type: 'address' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'total', type: 'uint256' }],
  },
  {
    name: 'Deposit',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    name: 'Withdraw',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
    ],
  },
] as const

// USDC 精度
export const USDC_DECIMALS = 6

// 格式化 USDC 金额（从 wei 到可读格式）
export function formatUSDC(amount: bigint | string): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount
  const divisor = BigInt(10 ** USDC_DECIMALS)
  const integerPart = value / divisor
  const fractionalPart = value % divisor
  const fractionalStr = fractionalPart.toString().padStart(USDC_DECIMALS, '0')
  // 移除末尾的0
  const trimmedFractional = fractionalStr.replace(/0+$/, '')
  return trimmedFractional ? `${integerPart}.${trimmedFractional}` : integerPart.toString()
}

// 解析 USDC 金额（从可读格式到 wei）
export function parseUSDC(amount: string): bigint {
  const [integerPart, fractionalPart = ''] = amount.split('.')
  const paddedFractional = fractionalPart.padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS)
  return BigInt(integerPart) * BigInt(10 ** USDC_DECIMALS) + BigInt(paddedFractional)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/contracts.ts
git commit -m "feat(contracts): add vault and USDC contract configuration"
```

---

## Chunk 3: 自定义 Hooks

### Task 3.1: 创建 useBalance Hook

**Files:**
- Create: `apps/web/hooks/use-balance.ts`

- [ ] **Step 1: 创建 Hook**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-balance.ts
git commit -m "feat(hooks): add useBalance hook"
```

---

### Task 3.2: 创建 useTransactions Hook

**Files:**
- Create: `apps/web/hooks/use-transactions.ts`

- [ ] **Step 1: 创建 Hook**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-transactions.ts
git commit -m "feat(hooks): add useTransactions hook"
```

---

### Task 3.3: 创建 useDeposit Hook

**Files:**
- Create: `apps/web/hooks/use-deposit.ts`

- [ ] **Step 1: 创建 Hook**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-deposit.ts
git commit -m "feat(hooks): add useDeposit hook"
```

---

### Task 3.4: 创建 useWithdraw Hook

**Files:**
- Create: `apps/web/hooks/use-withdraw.ts`

- [ ] **Step 1: 创建 Hook**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-withdraw.ts
git commit -m "feat(hooks): add useWithdraw hook"
```

---

## Chunk 4: UI 组件

### Task 4.1: 创建 BalanceCard 组件

**Files:**
- Create: `apps/web/components/asset/balance-card.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/asset/balance-card.tsx
'use client'

import { useBalance } from '@/hooks/use-balance'
import { formatUSDC } from '@/lib/contracts'

interface BalanceCardProps {
  onDeposit: () => void
  onWithdraw: () => void
}

export function BalanceCard({ onDeposit, onWithdraw }: BalanceCardProps) {
  const { balance, isLoading } = useBalance()

  const formatAmount = (amount: string) => {
    try {
      return formatUSDC(BigInt(amount))
    } catch {
      return '0'
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-4">账户余额</h2>

      <div className="space-y-4">
        {/* 可用余额 */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">可用余额</span>
          <span className="text-2xl font-bold text-white">
            {isLoading ? (
              <span className="inline-block w-24 h-8 bg-gray-800 rounded animate-pulse" />
            ) : (
              `${balance ? formatAmount(balance.availableBalance) : '0'} USDC`
            )}
          </span>
        </div>

        {/* 锁定余额 */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">锁定保证金</span>
          <span className="text-lg text-white">
            {isLoading ? (
              <span className="inline-block w-16 h-6 bg-gray-800 rounded animate-pulse" />
            ) : (
              `${balance ? formatAmount(balance.lockedBalance) : '0'} USDC`
            )}
          </span>
        </div>

        {/* 总权益 */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-800">
          <span className="text-gray-400">总权益</span>
          <span className="text-xl font-semibold text-green-400">
            {isLoading ? (
              <span className="inline-block w-20 h-6 bg-gray-800 rounded animate-pulse" />
            ) : (
              `${balance ? formatAmount(balance.equity) : '0'} USDC`
            )}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onDeposit}
          className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
        >
          充值
        </button>
        <button
          onClick={onWithdraw}
          className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
        >
          提现
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/asset/balance-card.tsx
git commit -m "feat(components): add BalanceCard component"
```

---

### Task 4.2: 创建 DepositFlow 组件

**Files:**
- Create: `apps/web/components/asset/deposit-flow.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/asset/deposit-flow.tsx
'use client'

import { useState, useEffect } from 'react'
import { useDeposit } from '@/hooks/use-deposit'
import { parseUSDC, formatUSDC, USDC_DECIMALS } from '@/lib/contracts'
import { useAccount } from 'wagmi'

interface DepositFlowProps {
  isOpen: boolean
  onClose: () => void
}

export function DepositFlow({ isOpen, onClose }: DepositFlowProps) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const {
    step,
    error: depositError,
    txHash,
    usdcBalance,
    isApproving,
    isDepositing,
    deposit,
    handleDepositSuccess,
    reset,
  } = useDeposit()

  // 监听存入成功
  useEffect(() => {
    if (step === 'confirmed') {
      handleDepositSuccess()
    }
  }, [step, handleDepositSuccess])

  // 关闭时重置
  useEffect(() => {
    if (!isOpen) {
      setAmount('')
      setError(null)
      reset()
    }
  }, [isOpen, reset])

  const validateAmount = (value: string): boolean => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue <= 0) {
      setError('请输入有效的金额')
      return false
    }
    if (numValue < 1) {
      setError('最小充值金额为 1 USDC')
      return false
    }
    const balanceNum = parseFloat(usdcBalance)
    if (numValue > balanceNum) {
      setError('USDC 余额不足')
      return false
    }
    setError(null)
    return true
  }

  const handleSubmit = async () => {
    if (!validateAmount(amount)) return
    await deposit(amount)
  }

  const handleMaxClick = () => {
    setAmount(usdcBalance)
    setError(null)
  }

  if (!isOpen) return null

  // 状态显示文本
  const getStatusText = () => {
    switch (step) {
      case 'checking-allowance':
        return '检查授权额度...'
      case 'approving':
        return '等待授权确认...'
      case 'approved':
        return '授权成功，继续存入...'
      case 'depositing':
        return '等待存入确认...'
      case 'confirming':
        return '确认中...'
      case 'confirmed':
        return '充值成功！'
      case 'error':
        return depositError || '操作失败'
      default:
        return ''
    }
  }

  const isProcessing = isApproving || isDepositing || step === 'checking-allowance'
  const isSuccess = step === 'confirmed'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">充值 USDC</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          // 成功状态
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white text-lg mb-2">充值成功！</p>
            <p className="text-gray-400 text-sm mb-4">
              金额: {amount} USDC
            </p>
            {txHash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-sm underline"
              >
                查看交易
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full mt-6 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            >
              完成
            </button>
          </div>
        ) : (
          // 输入表单
          <>
            {/* 余额显示 */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">钱包 USDC 余额</span>
              <span className="text-white font-medium">{usdcBalance} USDC</span>
            </div>

            {/* 金额输入 */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">充值金额</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setError(null)
                  }}
                  placeholder="0.00"
                  disabled={isProcessing}
                  data-deposit-amount
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-gray-400">USDC</span>
                  <button
                    onClick={handleMaxClick}
                    disabled={isProcessing}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-green-400 rounded transition-colors disabled:opacity-50"
                  >
                    MAX
                  </button>
                </div>
              </div>
              {(error || depositError) && (
                <p className="text-red-400 text-sm mt-2">{error || depositError}</p>
              )}
            </div>

            {/* 状态显示 */}
            {step !== 'idle' && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  {isProcessing && (
                    <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className="text-gray-300 text-sm">{getStatusText()}</span>
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 text-xs underline mt-1 block"
                  >
                    查看交易: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </a>
                )}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !amount || parseFloat(amount) <= 0}
              className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isApproving ? '授权中...' : '存入中...'}
                </>
              ) : (
                '确认充值'
              )}
            </button>

            <p className="text-gray-500 text-xs text-center mt-4">
              充值需要两次交易：授权 USDC + 存入 Vault
            </p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/asset/deposit-flow.tsx
git commit -m "feat(components): add DepositFlow component"
```

---

### Task 4.3: 创建 WithdrawFlow 组件

**Files:**
- Create: `apps/web/components/asset/withdraw-flow.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/asset/withdraw-flow.tsx
'use client'

import { useState, useEffect } from 'react'
import { useWithdraw } from '@/hooks/use-withdraw'
import { useBalance } from '@/hooks/use-balance'
import { formatUSDC } from '@/lib/contracts'

interface WithdrawFlowProps {
  isOpen: boolean
  onClose: () => void
}

export function WithdrawFlow({ isOpen, onClose }: WithdrawFlowProps) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { balance } = useBalance()
  const {
    step,
    error: withdrawError,
    transactionId,
    txHash,
    isLoading,
    withdraw,
    reset,
  } = useWithdraw()

  const availableBalance = balance?.availableBalance || '0'

  // 关闭时重置
  useEffect(() => {
    if (!isOpen) {
      setAmount('')
      setError(null)
      reset()
    }
  }, [isOpen, reset])

  const validateAmount = (value: string): boolean => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue <= 0) {
      setError('请输入有效的金额')
      return false
    }
    if (numValue < 1) {
      setError('最小提现金额为 1 USDC')
      return false
    }
    const availableNum = parseFloat(formatUSDC(BigInt(availableBalance)))
    if (numValue > availableNum) {
      setError('可用余额不足')
      return false
    }
    setError(null)
    return true
  }

  const handleSubmit = async () => {
    if (!validateAmount(amount)) return
    await withdraw(amount)
  }

  const handleMaxClick = () => {
    setAmount(formatUSDC(BigInt(availableBalance)))
    setError(null)
  }

  if (!isOpen) return null

  // 状态显示文本
  const getStatusText = () => {
    switch (step) {
      case 'submitting':
        return '提交提现请求...'
      case 'pending':
        return '提现处理中...'
      case 'confirmed':
        return '提现成功！'
      case 'failed':
        return '提现失败'
      case 'error':
        return withdrawError || '操作失败'
      default:
        return ''
    }
  }

  const isSuccess = step === 'confirmed'
  const isProcessing = isLoading || step === 'submitting' || step === 'pending'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-800">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">提现 USDC</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          // 成功状态
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white text-lg mb-2">提现请求已提交！</p>
            <p className="text-gray-400 text-sm mb-4">
              金额: {amount} USDC
            </p>
            {transactionId && (
              <p className="text-gray-500 text-xs mb-2">
                交易 ID: {transactionId.slice(0, 16)}...
              </p>
            )}
            {txHash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-sm underline"
              >
                查看交易
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full mt-6 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
            >
              完成
            </button>
          </div>
        ) : (
          // 输入表单
          <>
            {/* 可用余额显示 */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">可用余额</span>
              <span className="text-white font-medium">
                {formatUSDC(BigInt(availableBalance))} USDC
              </span>
            </div>

            {/* 金额输入 */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">提现金额</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setError(null)
                  }}
                  placeholder="0.00"
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-gray-400">USDC</span>
                  <button
                    onClick={handleMaxClick}
                    disabled={isProcessing}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-green-400 rounded transition-colors disabled:opacity-50"
                  >
                    MAX
                  </button>
                </div>
              </div>
              {(error || withdrawError) && (
                <p className="text-red-400 text-sm mt-2">{error || withdrawError}</p>
              )}
            </div>

            {/* 提示信息 */}
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-sm">
                注意：提现将扣除您的可用余额。有未平仓仓位时，锁定保证金不可提现。
              </p>
            </div>

            {/* 状态显示 */}
            {step !== 'idle' && step !== 'error' && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  {isProcessing && (
                    <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className="text-gray-300 text-sm">{getStatusText()}</span>
                </div>
                {transactionId && (
                  <p className="text-gray-500 text-xs mt-1">
                    交易 ID: {transactionId.slice(0, 20)}...
                  </p>
                )}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !amount || parseFloat(amount) <= 0}
              className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  处理中...
                </>
              ) : (
                '确认提现'
              )}
            </button>

            <p className="text-gray-500 text-xs text-center mt-4">
              提现由平台处理，通常需要几分钟完成
            </p>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/asset/withdraw-flow.tsx
git commit -m "feat(components): add WithdrawFlow component"
```

---

### Task 4.4: 创建 TransactionHistory 组件

**Files:**
- Create: `apps/web/components/asset/transaction-history.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/asset/transaction-history.tsx
'use client'

import { useTransactions } from '@/hooks/use-transactions'
import { formatUSDC } from '@/lib/contracts'
import type { Transaction, TransactionType, TransactionStatus } from '@/types/api'

interface TransactionHistoryProps {
  type?: TransactionType
}

const TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: '充值',
  WITHDRAW: '提现',
  MARGIN_LOCK: '保证金锁定',
  MARGIN_RELEASE: '保证金释放',
  REALIZED_PNL: '已实现盈亏',
  FEE: '手续费',
  LIQUIDATION: '清算',
}

const STATUS_LABELS: Record<TransactionStatus, { text: string; color: string }> = {
  PENDING: { text: '处理中', color: 'text-yellow-400' },
  CONFIRMED: { text: '已完成', color: 'text-green-400' },
  FAILED: { text: '失败', color: 'text-red-400' },
  REVERTED: { text: '已撤销', color: 'text-gray-400' },
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isPositive = ['DEPOSIT', 'MARGIN_RELEASE', 'REALIZED_PNL'].includes(transaction.type)
  const status = STATUS_LABELS[transaction.status]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-4">
        {/* 类型图标 */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            transaction.type === 'DEPOSIT'
              ? 'bg-green-500/20'
              : transaction.type === 'WITHDRAW'
              ? 'bg-red-500/20'
              : 'bg-gray-700'
          }`}
        >
          <span
            className={`text-lg ${
              transaction.type === 'DEPOSIT'
                ? 'text-green-400'
                : transaction.type === 'WITHDRAW'
                ? 'text-red-400'
                : 'text-gray-400'
            }`}
          >
            {transaction.type === 'DEPOSIT' ? '↓' : transaction.type === 'WITHDRAW' ? '↑' : '•'}
          </span>
        </div>

        {/* 类型和时间 */}
        <div>
          <p className="text-white font-medium">{TYPE_LABELS[transaction.type]}</p>
          <p className="text-gray-500 text-sm">{formatDate(transaction.createdAt)}</p>
        </div>
      </div>

      {/* 金额和状态 */}
      <div className="text-right">
        <p className={`font-medium ${isPositive ? 'text-green-400' : 'text-white'}`}>
          {isPositive ? '+' : '-'}
          {formatUSDC(BigInt(transaction.amount))} USDC
        </p>
        <p className={`text-sm ${status.color}`}>{status.text}</p>
      </div>
    </div>
  )
}

export function TransactionHistory({ type }: TransactionHistoryProps) {
  const {
    transactions,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions({ type, limit: 20 })

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">交易记录</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-800 rounded-lg animate-pulse" />
              <div className="flex-1">
                <div className="w-24 h-4 bg-gray-800 rounded animate-pulse mb-2" />
                <div className="w-16 h-3 bg-gray-800 rounded animate-pulse" />
              </div>
              <div className="text-right">
                <div className="w-20 h-4 bg-gray-800 rounded animate-pulse mb-2" />
                <div className="w-12 h-3 bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">交易记录</h2>
        <p className="text-red-400">加载失败: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-4">
        交易记录
        {type && ` - ${TYPE_LABELS[type]}`}
      </h2>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">暂无交易记录</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-800">
            {transactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </div>

          {/* 加载更多 */}
          {hasNextPage && (
            <div className="mt-4 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 text-green-400 hover:text-green-300 disabled:text-gray-500 transition-colors"
              >
                {isFetchingNextPage ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/asset/transaction-history.tsx
git commit -m "feat(components): add TransactionHistory component"
```

---

## Chunk 5: 资产页面

### Task 5.1: 创建资产页面

**Files:**
- Create: `apps/web/app/assets/page.tsx`

- [ ] **Step 1: 创建页面**

```typescript
// apps/web/app/assets/page.tsx
'use client'

import { useState } from 'react'
import { BalanceCard } from '@/components/asset/balance-card'
import { DepositFlow } from '@/components/asset/deposit-flow'
import { WithdrawFlow } from '@/components/asset/withdraw-flow'
import { TransactionHistory } from '@/components/asset/transaction-history'
import { useAuth } from '@/hooks/use-auth'

export default function AssetsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">资产管理</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-8 bg-gray-800 rounded mb-4" />
              <div className="h-32 bg-gray-800 rounded" />
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-8 bg-gray-800 rounded mb-4" />
              <div className="h-64 bg-gray-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">资产管理</h1>
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-400 mb-4">请先连接钱包并登录以查看资产</p>
          <p className="text-gray-500 text-sm">点击右上角「连接钱包」按钮开始</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">资产管理</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：余额卡片 */}
        <div className="lg:col-span-1 space-y-6">
          <BalanceCard
            onDeposit={() => setIsDepositOpen(true)}
            onWithdraw={() => setIsWithdrawOpen(true)}
          />

          {/* 快速链接 */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-white font-medium mb-4">快速链接</h3>
            <div className="space-y-2">
              <a
                href="https://sepolia.arbiscan.io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors"
              >
                <span>Arbiscan 浏览器</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="https://faucet.quicknode.com/arbitrum/sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors"
              >
                <span>Arbitrum Sepolia 水龙头</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* 右侧：交易历史 */}
        <div className="lg:col-span-2">
          <TransactionHistory />
        </div>
      </div>

      {/* 充值弹窗 */}
      <DepositFlow isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />

      {/* 提现弹窗 */}
      <WithdrawFlow isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/assets/page.tsx
git commit -m "feat(pages): add assets page"
```

---

## Chunk 6: 测试和验证

### Task 6.1: 类型检查

- [ ] **Step 1: 运行类型检查**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-h/apps/web
npx tsc --noEmit
```

- [ ] **Step 2: 修复类型错误（如有）**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix(types): resolve type errors"
```

---

### Task 6.2: 构建验证

- [ ] **Step 1: 运行构建**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-h/apps/web
npm run build
```

- [ ] **Step 2: 修复构建错误（如有）**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix(build): resolve build errors"
```

---

### Task 6.3: 代码质量检查

- [ ] **Step 1: 检查代码风格**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-h
npm run lint -- --fix
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "style: fix linting issues"
```

---

## Chunk 7: 最终合并

### Task 7.1: 推送分支

- [ ] **Step 1: 创建分支并推送**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp-h
git checkout -b feat/lane-h-asset-page
git push -u origin feat/lane-h-asset-page
```

---

### Task 7.2: 合并到 feat/sprint-3

- [ ] **Step 1: 切换回主 worktree 并合并**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp
git checkout feat/sprint-3
git merge --no-ff feat/lane-h-asset-page -m "feat(assets): merge lane H - asset page implementation"
git push origin feat/sprint-3
```

---

### Task 7.3: 清理 worktree

- [ ] **Step 1: 移除 worktree**

```bash
cd /Users/xlzj/Desktop/Projects/perp-dex-mvp
git worktree remove ../perp-dex-mvp-h
```

---

## 总结

### 交付物清单

- [x] `apps/web/types/api.ts` - 资产相关类型
- [x] `apps/web/lib/api.ts` - 资产相关API方法
- [x] `apps/web/lib/contracts.ts` - 合约配置
- [x] `apps/web/hooks/use-balance.ts` - 余额查询Hook
- [x] `apps/web/hooks/use-transactions.ts` - 交易历史Hook
- [x] `apps/web/hooks/use-deposit.ts` - 充值操作Hook
- [x] `apps/web/hooks/use-withdraw.ts` - 提现操作Hook
- [x] `apps/web/components/asset/balance-card.tsx` - 余额卡片
- [x] `apps/web/components/asset/deposit-flow.tsx` - 充值流程
- [x] `apps/web/components/asset/withdraw-flow.tsx` - 提现流程
- [x] `apps/web/components/asset/transaction-history.tsx` - 交易历史
- [x] `apps/web/app/assets/page.tsx` - 资产页面

### 功能特性

1. **余额显示**: 实时显示可用余额、锁定保证金和总权益
2. **充值流程**: 支持 USDC approve + deposit 两步流程
3. **提现流程**: 调用后端API发起提现请求
4. **交易历史**: 分页展示充值、提现等交易记录
5. **状态管理**: 使用 TanStack Query 管理数据缓存和刷新
6. **错误处理**: 完善的错误提示和状态反馈
