// apps/web/components/position/pnl-display.tsx
'use client'

import { formatPnL } from '@/hooks/use-positions'

interface PnLDisplayProps {
  pnl: string
  showSign?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export function PnLDisplay({ pnl, showSign = true, size = 'md' }: PnLDisplayProps) {
  const { value, isPositive, isNegative } = formatPnL(pnl)

  const colorClass = isPositive
    ? 'text-green-600'
    : isNegative
    ? 'text-red-600'
    : 'text-gray-600'

  const sign = showSign ? (isPositive ? '+' : isNegative ? '-' : '') : ''

  return (
    <span className={`font-mono font-semibold ${colorClass} ${sizeMap[size]}`}>
      {sign}${value}
    </span>
  )
}

// PnL百分比显示
interface PnLPercentDisplayProps {
  pnl: string
  margin: string
  size?: 'sm' | 'md' | 'lg'
}

export function PnLPercentDisplay({ pnl, margin, size = 'sm' }: PnLPercentDisplayProps) {
  const pnlNum = parseFloat(pnl)
  const marginNum = parseFloat(margin)

  if (marginNum === 0) {
    return <span className="text-gray-400 text-xs">-</span>
  }

  const percent = (pnlNum / marginNum) * 100
  const isPositive = percent > 0
  const isNegative = percent < 0

  const colorClass = isPositive
    ? 'text-green-600'
    : isNegative
    ? 'text-red-600'
    : 'text-gray-600'

  const sign = isPositive ? '+' : isNegative ? '-' : ''

  return (
    <span className={`font-mono ${colorClass} ${sizeMap[size]}`}>
      {sign}{Math.abs(percent).toFixed(2)}%
    </span>
  )
}
