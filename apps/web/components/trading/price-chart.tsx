'use client'

import { useEffect, useRef, useState } from 'react'
import { useMarket } from '@/hooks/use-market'

const TIMEFRAMES = [
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
]

export function PriceChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [timeframe, setTimeframe] = useState('15')
  const { marketData } = useMarket('BTC')

  useEffect(() => {
    if (!chartRef.current) return

    chartRef.current.innerHTML = ''

    const container = document.createElement('div')
    container.id = 'tradingview-chart'
    container.style.height = '100%'
    container.style.width = '100%'
    chartRef.current.appendChild(container)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: 'BINANCE:BTCUSDT',
          interval: timeframe,
          timezone: 'Etc/UTC',
          theme: 'light',
          style: '1',
          locale: 'zh_CN',
          toolbar_bg: '#f8f9fa',
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: 'tradingview-chart',
          hide_top_toolbar: true,
          hide_legend: true,
          save_image: false,
          backgroundColor: '#F8F9FA',
          gridColor: '#E2E8F0',
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      if (chartRef.current) {
        chartRef.current.innerHTML = ''
      }
    }
  }, [timeframe])

  const change24h = marketData?.change24h || 0
  const isPositive = change24h >= 0

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-pro-gray-100">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`text-sm transition-colors ${
              timeframe === tf.value
                ? 'text-pro-accent-cyan font-medium'
                : 'text-pro-gray-500 hover:text-pro-gray-700'
            }`}
          >
            {tf.label}
          </button>
        ))}
        <span className="ml-auto text-pro-accent-cyan font-medium text-sm">
          BTC/USD
        </span>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative">
        {marketData && (
          <div className="absolute top-4 left-4 z-10 bg-white/95 rounded-lg shadow-float p-3">
            <div className="text-sm text-pro-gray-500 mb-1">BTC / USD</div>
            <div className="text-2xl font-bold font-mono text-pro-gray-800">
              {marketData.markPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div
              className={`text-sm font-medium mt-1 ${
                isPositive ? 'text-pro-accent-green' : 'text-pro-accent-red'
              }`}
            >
              {isPositive ? '+' : ''}
              {marketData.change24h.toFixed(2)}%
            </div>
          </div>
        )}

        <div ref={chartRef} className="w-full h-full" />
      </div>
    </div>
  )
}
