'use client'

import { useBalance } from '@/hooks/use-balance'
import { usePositions } from '@/hooks/use-positions'

interface SummaryCardProps {
  label: string
  value: number
  prefix?: string
  variant?: 'default' | 'green' | 'red'
}

function SummaryCard({ label, value, prefix = '$', variant = 'default' }: SummaryCardProps) {
  const valueClass =
    variant === 'green'
      ? 'text-pro-accent-green'
      : variant === 'red'
      ? 'text-pro-accent-red'
      : 'text-pro-gray-800'

  return (
    <div className="bg-white rounded-lg shadow-panel p-5">
      <div className="text-xs text-pro-gray-500 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={`text-2xl font-bold font-mono ${valueClass}`}>
        {prefix}
        {value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    </div>
  )
}

export function BalanceSummary() {
  const { balance } = useBalance()
  const { positions } = usePositions()

  // 解析余额数据（字符串转为数字）
  const equity = parseFloat(balance?.equity || '0')
  const availableBalance = parseFloat(balance?.availableBalance || '0')
  const lockedBalance = parseFloat(balance?.lockedBalance || '0')
  const totalValue = equity + availableBalance

  // 计算未实现盈亏
  const unrealizedPnl =
    positions?.reduce((sum, pos) => sum + parseFloat(pos.unrealizedPnl || '0'), 0) || 0

  return (
    <div className="grid grid-cols-4 gap-4">
      <SummaryCard label="总资产价值" value={totalValue} />
      <SummaryCard
        label="可用余额"
        value={availableBalance}
        variant="green"
      />
      <SummaryCard label="已锁定保证金" value={lockedBalance} />
      <SummaryCard
        label="未实现盈亏"
        value={Math.abs(unrealizedPnl)}
        variant={unrealizedPnl >= 0 ? 'green' : 'red'}
        prefix={unrealizedPnl >= 0 ? '+$' : '-$'}
      />
    </div>
  )
}
