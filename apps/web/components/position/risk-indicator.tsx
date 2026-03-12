// apps/web/components/position/risk-indicator.tsx
'use client'

import type { Position } from '@perpdex/shared'
import { getRiskLevelColor, getRiskLevelText } from '@/hooks/use-positions'

interface RiskIndicatorProps {
  riskLevel: Position['riskLevel']
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

export function RiskIndicator({ riskLevel, showLabel = false, size = 'md' }: RiskIndicatorProps) {
  const colorClass = getRiskLevelColor(riskLevel)
  const text = getRiskLevelText(riskLevel)

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block rounded-full ${sizeMap[size]} ${colorClass}`}
        title={text}
      />
      {showLabel && (
        <span className={`text-sm font-medium ${
          riskLevel === 'SAFE' ? 'text-green-600' :
          riskLevel === 'WARNING' ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {text}
        </span>
      )}
    </div>
  )
}
