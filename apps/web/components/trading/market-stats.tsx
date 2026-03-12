'use client'

import { useMarket } from '@/hooks/use-market'

interface StatItemProps {
  label: string
  value: string
  change?: string
  isPercentage?: boolean
}

function StatItem({ label, value, change, isPercentage }: StatItemProps) {
  const changeNum = change ? parseFloat(change) : undefined
  return (
    <div className="flex flex-col items-center py-3">
      <div className="text-xs text-pro-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold font-mono ${changeNum !== undefined ? (changeNum >= 0 ? 'text-pro-accent-green' : 'text-pro-accent-red') : 'text-pro-gray-800'}`}>
        {isPercentage && changeNum !== undefined ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)}%` : value}
      </div>
    </div>
  )
}

export function MarketStats() {
  const { marketData } = useMarket('BTC')

  if (!marketData) {
    return (
      <div className="grid grid-cols-5 gap-px bg-pro-gray-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white py-3">
            <div className="h-4 w-16 bg-gray-200 rounded mx-auto animate-pulse mb-1" />
            <div className="h-5 w-20 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  const markPrice = parseFloat(marketData.markPrice)
  const indexPrice = parseFloat(marketData.indexPrice)

  return (
    <div className="grid grid-cols-5 gap-px bg-pro-gray-100">
      <StatItem
        label="标记价格"
        value={markPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="指数价格"
        value={indexPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 涨跌"
        value=""
        change={marketData.change24h}
        isPercentage
      />
      <StatItem
        label="24h 最高"
        value="—"
      />
      <StatItem
        label="24h 成交量"
        value="—"
      />
    </div>
  )
}
