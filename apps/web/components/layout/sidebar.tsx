// apps/web/components/layout/sidebar.tsx
'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 工具函数
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 交易对数据类型
interface TradingPair {
  symbol: string
  name: string
  price: string
  change24h: string
  isPositive: boolean
}

// 模拟数据
const TRADING_PAIRS: TradingPair[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: '67,432.50', change24h: '+2.34%', isPositive: true },
  { symbol: 'ETH', name: 'Ethereum', price: '3,521.80', change24h: '+1.56%', isPositive: true },
  { symbol: 'SOL', name: 'Solana', price: '145.20', change24h: '-0.82%', isPositive: false },
  { symbol: 'ARB', name: 'Arbitrum', price: '1.85', change24h: '+3.21%', isPositive: true },
]

// 菜单项
const MENU_ITEMS = [
  { label: '行情', href: '/' },
  { label: '交易', href: '/trade' },
  { label: '持仓', href: '/positions' },
]

export function Sidebar() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC')
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 bottom-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 z-40',
        isExpanded ? 'w-64' : 'w-16'
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-4 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
      >
        <ChevronLeft
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isExpanded ? '' : 'rotate-180'
          )}
        />
      </button>

      <div className="h-full overflow-y-auto py-4">
        {/* Trading Pairs Section */}
        <div className="px-3 mb-6">
          {isExpanded && (
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-3">
              交易对
            </h3>
          )}
          <div className="space-y-1">
            {TRADING_PAIRS.map((pair) => (
              <button
                key={pair.symbol}
                onClick={() => setSelectedSymbol(pair.symbol)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  selectedSymbol === pair.symbol
                    ? 'bg-green-500/10 text-green-400'
                    : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    selectedSymbol === pair.symbol ? 'bg-green-500/20' : 'bg-gray-800'
                  )}
                >
                  <span className="text-xs font-bold">{pair.symbol[0]}</span>
                </div>

                {isExpanded && (
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{pair.symbol}/USD</span>
                      <span className="text-sm">${pair.price}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500">{pair.name}</span>
                      <span
                        className={cn(
                          'text-xs flex items-center gap-0.5',
                          pair.isPositive ? 'text-green-400' : 'text-red-400'
                        )}
                      >
                        {pair.isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {pair.change24h}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Section */}
        <div className="px-3">
          {isExpanded && (
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-3">
              菜单
            </h3>
          )}
          <nav className="space-y-1">
            {MENU_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <span className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {item.label[0]}
                </span>
                {isExpanded && <span className="text-sm">{item.label}</span>}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  )
}
