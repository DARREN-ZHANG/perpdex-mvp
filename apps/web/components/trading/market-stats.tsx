'use client'

import type { BinancePriceData } from '@/lib/binance-market'

interface StatItemProps {
  label: string
  value: string
  change?: string
  isPercentage?: boolean
  className?: string
}

function StatItem({ label, value, change, isPercentage, className = '' }: StatItemProps) {
  const changeNum = change ? parseFloat(change) : undefined
  return (
    <div className={`flex flex-col items-center py-2 lg:py-3 ${className}`}>
      <div className="text-xs text-pro-gray-500 uppercase tracking-wider mb-0.5 lg:mb-1">
        {label}
      </div>
      <div className={`text-sm lg:text-base font-semibold font-mono ${changeNum !== undefined ? (changeNum >= 0 ? 'text-pro-accent-green' : 'text-pro-accent-red') : 'text-pro-gray-800'}`}>
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

export interface MarketStatsProps {
  priceData: BinancePriceData | null
  isLoading?: boolean
  error?: string | null
}

export function MarketStats({ priceData, isLoading = false, error = null }: MarketStatsProps) {
  if (isLoading && !priceData) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-px bg-pro-gray-100">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white py-2 lg:py-3">
            <div className="h-3 lg:h-4 w-14 lg:w-16 bg-gray-200 rounded mx-auto animate-pulse mb-0.5 lg:mb-1" />
            <div className="h-4 lg:h-5 w-16 lg:w-20 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
        ))}
        {/* 桌面端额外的骨架屏 */}
        {[...Array(2)].map((_, i) => (
          <div key={`extra-${i}`} className="hidden lg:block bg-white py-3">
            <div className="h-4 w-16 bg-gray-200 rounded mx-auto animate-pulse mb-1" />
            <div className="h-5 w-20 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!priceData) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-px bg-pro-gray-100">
        {['最新价格', '24h 涨跌', '24h 成交量'].map((label) => (
          <StatItem key={label} label={label} value="--" />
        ))}
        {/* 桌面端额外项 */}
        <StatItem className="hidden lg:flex" label="24h 最高" value="--" />
        <StatItem className="hidden lg:flex" label="24h 最低" value="--" />
        {error && (
          <div className="col-span-3 lg:col-span-5 bg-white px-4 py-2 text-center text-xs text-pro-accent-red">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 lg:grid-cols-5 gap-px bg-pro-gray-100">
      <StatItem
        label="最新价格"
        value={priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 涨跌"
        value=""
        change={priceData.changePercent24h.toString()}
        isPercentage
      />
      {/* 移动端显示成交量，桌面端显示最高 */}
      <StatItem
        className="lg:hidden"
        label="24h 成交量"
        value={formatVolume(priceData.volume24h)}
      />
      <StatItem
        className="hidden lg:flex"
        label="24h 最高"
        value={priceData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      {/* 桌面端额外项 */}
      <StatItem
        className="hidden lg:flex"
        label="24h 最低"
        value={priceData.low24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        className="hidden lg:flex"
        label="24h 成交量"
        value={formatVolume(priceData.volume24h)}
      />
    </div>
  )
}
