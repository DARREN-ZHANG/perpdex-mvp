'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { useAuth } from '@/hooks/use-auth'
import { useBalance } from '@/hooks/use-balance'
import { useWithdraw, type WithdrawStep } from '@/hooks/use-withdraw'

const USDC_DECIMALS = 6

const STEP_LABELS: Record<WithdrawStep, string> = {
  idle: '准备提现',
  submitting: '提交提现请求...',
  pending: '提现请求已提交，等待链上处理',
  confirmed: '提现已确认',
  failed: '提现失败',
  error: '提现失败',
}

function formatUSDC(value: string | undefined): string {
  if (!value) return '0'
  return formatUnits(BigInt(value), USDC_DECIMALS)
}

export default function WithdrawPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { balance } = useBalance()
  const [amount, setAmount] = useState('')
  const { step, error, transactionId, txHash, isLoading, withdraw, reset } = useWithdraw()

  const availableBalance = useMemo(
    () => parseFloat(formatUSDC(balance?.availableBalance)),
    [balance?.availableBalance]
  )

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    await withdraw(amount)
  }

  if (authLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-panel p-8 animate-pulse">
          <div className="h-8 bg-pro-gray-200 rounded w-32 mb-6" />
          <div className="h-12 bg-pro-gray-200 rounded mb-4" />
          <div className="h-10 bg-pro-gray-200 rounded w-24" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-panel p-12 text-center">
          <p className="text-pro-gray-500 mb-4">请先连接钱包并登录以进行提现</p>
          <Link href="/assets" className="text-pro-accent-cyan hover:underline">
            返回资产页
          </Link>
        </div>
      </div>
    )
  }

  const exceedsBalance = amount !== '' && parseFloat(amount) > availableBalance

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/assets"
            className="text-pro-gray-400 hover:text-pro-gray-600 transition-colors"
          >
            ← 返回资产
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-pro-gray-800">提现 USDC</h1>
        <p className="text-sm text-pro-gray-500 mt-1">
          当前平台为 CFD 模式，暂仅支持 USDC 提现
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-panel p-6">
        <div className="mb-6 p-4 bg-pro-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-pro-gray-500">可提现余额</span>
            <span className="font-mono font-semibold text-pro-gray-800">
              {availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
            </span>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-pro-gray-700 mb-2">
            提现金额
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.000001"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="输入提现金额"
              disabled={isLoading}
              className="w-full px-4 py-3 pr-16 border border-pro-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pro-accent-cyan focus:border-transparent font-mono text-lg disabled:bg-pro-gray-50 disabled:cursor-not-allowed"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-pro-gray-400 font-medium">
              USDC
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            {['10', '50', '100'].map((quickAmount) => (
              <button
                key={quickAmount}
                type="button"
                onClick={() => setAmount(quickAmount)}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm border border-pro-gray-200 rounded-md hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quickAmount} USDC
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(availableBalance > 0 ? availableBalance.toFixed(6).replace(/\.?0+$/, '') : '0')}
              disabled={isLoading}
              className="px-3 py-2 text-sm border border-pro-gray-200 rounded-md hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              全部
            </button>
          </div>
          {exceedsBalance && (
            <p className="text-sm text-pro-accent-red mt-2">提现金额不能超过可用余额</p>
          )}
        </div>

        {step !== 'idle' && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              step === 'confirmed'
                ? 'bg-pro-accent-green/10'
                : step === 'error' || step === 'failed'
                ? 'bg-pro-accent-red/10'
                : 'bg-pro-accent-cyan/10'
            }`}
          >
            <div className="font-medium text-pro-gray-800">{STEP_LABELS[step]}</div>
            {transactionId && (
              <div className="text-sm text-pro-gray-500 mt-1">请求 ID: {transactionId}</div>
            )}
            {txHash && (
              <div className="text-sm text-pro-gray-500 mt-1 break-all">Tx Hash: {txHash}</div>
            )}
            {error && <div className="text-sm text-pro-accent-red mt-1">{error}</div>}
          </div>
        )}

        <div className="flex gap-3">
          {(step === 'idle' || step === 'error' || step === 'failed') && (
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={!amount || parseFloat(amount) <= 0 || exceedsBalance || isLoading}
              className="flex-1 px-6 py-3 bg-pro-gray-900 text-white font-medium rounded-lg hover:bg-pro-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              提现
            </button>
          )}

          {(step === 'pending' || step === 'confirmed') && (
            <button
              type="button"
              onClick={reset}
              className="flex-1 px-6 py-3 border border-pro-gray-200 text-pro-gray-700 font-medium rounded-lg hover:border-pro-gray-300 transition-colors"
            >
              发起新的提现
            </button>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-pro-gray-100">
          <h3 className="text-sm font-medium text-pro-gray-700 mb-2">提现说明</h3>
          <ul className="text-xs text-pro-gray-500 space-y-1">
            <li>• 当前仅支持 USDC 作为保证金和提现资产</li>
            <li>• 提现请求提交后，后端会异步执行链上转账</li>
            <li>• 提现期间金额会先从可用余额转入锁定余额</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
