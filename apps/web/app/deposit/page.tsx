'use client'

import { useState, useEffect } from 'react'
import { useDeposit, type DepositStep } from '@/hooks/use-deposit'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'

const STEP_LABELS: Record<DepositStep, string> = {
  'idle': '准备充值',
  'checking-allowance': '检查授权额度...',
  'approving': '授权 USDC...',
  'approved': '授权成功',
  'depositing': '存入 Vault...',
  'confirming': '确认交易...',
  'confirmed': '充值成功！',
  'error': '充值失败',
}

const STEP_ICONS: Record<DepositStep, string> = {
  'idle': '💰',
  'checking-allowance': '🔍',
  'approving': '✍️',
  'approved': '✅',
  'depositing': '📥',
  'confirming': '⏳',
  'confirmed': '🎉',
  'error': '❌',
}

export default function DepositPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [amount, setAmount] = useState('')

  const {
    step,
    error,
    txHash,
    usdcBalance,
    allowance,
    isApproving,
    isDepositing,
    deposit,
    continueAfterApprove,
    handleDepositSuccess,
    reset,
  } = useDeposit()

  // 监听授权成功后继续
  useEffect(() => {
    if (step === 'approved') {
      continueAfterApprove()
    }
  }, [step, continueAfterApprove])

  // 监听存入成功
  useEffect(() => {
    if (step === 'confirmed') {
      handleDepositSuccess()
    }
  }, [step, handleDepositSuccess])

  // 处理充值
  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) return
    deposit(amount)
  }

  // 快速选择金额
  const quickAmounts = ['100', '500', '1000', '5000']

  // 加载状态
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

  // 未登录状态
  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-panel p-12 text-center">
          <p className="text-pro-gray-500 mb-4">请先连接钱包并登录以进行充值</p>
          <Link
            href="/"
            className="text-pro-accent-cyan hover:underline"
          >
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  const isLoading = isApproving || isDepositing || step === 'checking-allowance'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/assets"
            className="text-pro-gray-400 hover:text-pro-gray-600 transition-colors"
          >
            ← 返回资产
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-pro-gray-800">充值 USDC</h1>
        <p className="text-sm text-pro-gray-500 mt-1">
          将 USDC 充值到 Vault 合约以开始交易
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-lg shadow-panel p-6">
        {/* Balance Info */}
        <div className="mb-6 p-4 bg-pro-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-pro-gray-500">钱包 USDC 余额</span>
            <span className="font-mono font-semibold text-pro-gray-800">
              {parseFloat(usdcBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
            </span>
          </div>
          {allowance > 0n && (
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-pro-gray-500">已授权额度</span>
              <span className="font-mono text-sm text-pro-gray-600">
                {(Number(allowance) / 1e6).toLocaleString('en-US')} USDC
              </span>
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-pro-gray-700 mb-2">
            充值金额
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="输入充值金额"
              data-deposit-amount
              disabled={isLoading}
              className="w-full px-4 py-3 pr-16 border border-pro-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pro-accent-cyan focus:border-transparent font-mono text-lg disabled:bg-pro-gray-50 disabled:cursor-not-allowed"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-pro-gray-400 font-medium">
              USDC
            </span>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mt-3">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt)}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm border border-pro-gray-200 rounded-md hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {amt} USDC
              </button>
            ))}
            <button
              onClick={() => setAmount(usdcBalance)}
              disabled={isLoading}
              className="px-3 py-2 text-sm border border-pro-gray-200 rounded-md hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              全部
            </button>
          </div>
        </div>

        {/* Status Display */}
        {step !== 'idle' && (
          <div className={`mb-6 p-4 rounded-lg ${
            step === 'confirmed' ? 'bg-pro-accent-green/10' :
            step === 'error' ? 'bg-pro-accent-red/10' :
            'bg-pro-accent-cyan/10'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{STEP_ICONS[step]}</span>
              <div>
                <div className="font-medium text-pro-gray-800">{STEP_LABELS[step]}</div>
                {txHash && (
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-pro-accent-cyan hover:underline"
                  >
                    查看交易 →
                  </a>
                )}
                {error && (
                  <div className="text-sm text-pro-accent-red mt-1">{error}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {(step === 'idle' || step === 'error') && (
            <button
              onClick={handleDeposit}
              disabled={!amount || parseFloat(amount) <= 0 || isLoading}
              className="flex-1 px-6 py-3 bg-pro-accent-green text-white font-medium rounded-lg hover:bg-pro-accent-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              充值
            </button>
          )}

          {step === 'confirmed' && (
            <>
              <button
                onClick={reset}
                className="flex-1 px-6 py-3 border border-pro-gray-200 text-pro-gray-700 font-medium rounded-lg hover:border-pro-gray-300 transition-colors"
              >
                继续充值
              </button>
              <Link
                href="/"
                className="flex-1 px-6 py-3 bg-pro-accent-cyan text-white font-medium rounded-lg hover:bg-pro-accent-cyan/90 transition-colors text-center"
              >
                开始交易
              </Link>
            </>
          )}

          {isLoading && (
            <button
              disabled
              className="flex-1 px-6 py-3 bg-pro-gray-400 text-white font-medium rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              处理中...
            </button>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-pro-gray-100">
          <h3 className="text-sm font-medium text-pro-gray-700 mb-2">充值说明</h3>
          <ul className="text-xs text-pro-gray-500 space-y-1">
            <li>• 充值需要先授权 USDC 给 Vault 合约（仅需一次交易）</li>
            <li>• 授权后，充值将在链上确认后生效</li>
            <li>• 后端 Indexer 会自动监听并同步余额到数据库</li>
            <li>• 当前网络：Arbitrum Sepolia 测试网</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
