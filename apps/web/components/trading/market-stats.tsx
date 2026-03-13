'use client'

import { useBinancePrice } from '@/hooks/use-binance-price'

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

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toFixed(2)
}

export function MarketStats() {
  const { data: priceData, isLoading } = useBinancePrice('BTCUSDT')

  if (isLoading || !priceData) {
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
        value={priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="指数价格"
        value={priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 涨跌"
        value=""
        change={priceData.changePercent24h.toString()}
        isPercentage
      />
      <StatItem
        label="24h 最高"
        value={priceData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 成交量"
        value={formatVolume(priceData.volume24h)}
      />
    </div>
  )
}
