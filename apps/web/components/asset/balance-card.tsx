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
