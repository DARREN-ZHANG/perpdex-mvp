'use client'

import { useMarket } from '@/hooks/use-market'

interface StatItemProps {
  label: string
  value: string
  change?: number
  isPercentage?: boolean
}

function StatItem({ label, value, change, isPercentage }: StatItemProps) {
  return (
    <div className="flex flex-col items-center py-3">
      <div className="text-xs text-pro-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold font-mono ${change !== undefined ? (change >= 0 ? 'text-pro-accent-green' : 'text-pro-accent-red') : 'text-pro-gray-800'}`}>
        {isPercentage && change !== undefined ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : value}
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

  return (
    <div className="grid grid-cols-5 gap-px bg-pro-gray-100">
      <StatItem
        label="标记价格"
        value={marketData.markPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="指数价格"
        value={marketData.indexPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 涨跌"
        value=""
        change={marketData.change24h}
        isPercentage
      />
      <StatItem
        label="24h 最高"
        value={marketData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 成交量"
        value={marketData.volume24h > 1e9
          ? `${(marketData.volume24h / 1e9).toFixed(1)}B`
          : `${(marketData.volume24h / 1e6).toFixed(1)}M`}
      />
    </div>
  )
}
