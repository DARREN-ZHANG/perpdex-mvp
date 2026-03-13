'use client'

import { formatUnits } from 'viem'
import { useBalance } from '@/hooks/use-balance'
import { useBinancePrice } from '@/hooks/use-binance-price'
import {
  calculatePositionUnrealizedPnl,
  parseUsdcBaseUnits,
  usePositions,
} from '@/hooks/use-positions'

const USDC_DECIMALS = 6

// 将原始值转换为可读的 USDC 金额
function formatBalance(value: string | undefined): number {
  if (!value) return 0
  return parseFloat(formatUnits(BigInt(value), USDC_DECIMALS))
}

function clampNonNegative(value: number): number {
  return value > 0 ? value : 0
}

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
  const { data: priceData } = useBinancePrice('BTCUSDT')

  // 解析余额数据（从原始值转换为 USDC）
  const availableBalance = formatBalance(balance?.availableBalance)
  const lockedBalanceFromPositions = positions.reduce((sum, pos) => {
    return sum + parseUsdcBaseUnits(pos.margin)
  }, 0)
  const lockedBalance = clampNonNegative(
    positions.length > 0 ? lockedBalanceFromPositions : formatBalance(balance?.lockedBalance)
  )
  const totalValue = availableBalance + lockedBalance

  // 计算未实现盈亏
  const unrealizedPnl = positions.reduce((sum, pos) => {
    return sum + calculatePositionUnrealizedPnl(pos, priceData?.price)
  }, 0)

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
