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
