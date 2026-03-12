// apps/web/components/trading/price-chart.tsx
'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts'
import type { CandleData, Timeframe } from '@/types/trading'

interface PriceChartProps {
  data: CandleData[]
  currentPrice: number
  symbol: string
  timeframe: Timeframe
  onTimeframeChange: (timeframe: Timeframe) => void
  isLoading?: boolean
}

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
]

export function PriceChart({
  data,
  currentPrice,
  symbol,
  timeframe,
  onTimeframeChange,
  isLoading = false,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#6b7280',
          labelBackgroundColor: '#6b7280',
        },
        horzLine: {
          color: '#6b7280',
          labelBackgroundColor: '#6b7280',
        },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    candlestickSeriesRef.current = candlestickSeries

    // 响应式处理
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // 更新数据
  useEffect(() => {
    if (!candlestickSeriesRef.current || data.length === 0) return

    const chartData: CandlestickData<Time>[] = data.map((candle) => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }))

    candlestickSeriesRef.current.setData(chartData)
  }, [data])

  // 实时更新最新价格
  useEffect(() => {
    if (!candlestickSeriesRef.current || data.length === 0 || currentPrice <= 0)
      return

    const lastCandle = data[data.length - 1]
    if (!lastCandle) return

    const updatedCandle: CandlestickData<Time> = {
      time: lastCandle.time as Time,
      open: lastCandle.open,
      high: Math.max(lastCandle.high, currentPrice),
      low: Math.min(lastCandle.low, currentPrice),
      close: currentPrice,
    }

    candlestickSeriesRef.current.update(updatedCandle)
  }, [currentPrice, data])

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-white">{symbol}/USD</h3>
          <span
            className={`text-sm font-medium ${
              currentPrice >= (data[data.length - 1]?.open || 0)
                ? 'text-green-500'
                : 'text-red-500'
            }`}
          >
            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* 时间周期选择 */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                timeframe === tf.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 图表容器 */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>
    </div>
  )
}
