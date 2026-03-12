// apps/web/components/position/pnl-display.tsx
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

interface PnLPercentDisplayProps {
  pnl: string
  margin: string
  showSign?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PnLPercentDisplay({
  pnl,
  margin,
  showSign = true,
  size = 'sm',
}: PnLPercentDisplayProps) {
  const pnlNum = parseFloat(pnl)
  const marginNum = parseFloat(margin)

  if (marginNum === 0) return null

  const percent = (pnlNum / marginNum) * 100
  const isPositive = percent > 0
  const isNegative = percent < 0
  const colorClass = isPositive
    ? 'text-green-600'
    : isNegative
      ? 'text-red-600'
      : 'text-gray-600'
  const sign = showSign ? (isPositive ? '+' : isNegative ? '-' : '') : ''

  return (
    <span className={`font-mono ${colorClass} ${sizeMap[size]}`}>
      {sign}
      {Math.abs(percent).toFixed(2)}%
    </span>
  )
}
