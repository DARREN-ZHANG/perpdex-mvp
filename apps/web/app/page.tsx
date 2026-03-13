'use client'

import { useState } from 'react'
import { MarketStats } from '@/components/trading/market-stats'
import { PriceChart } from '@/components/trading/price-chart'
import { OrderForm } from '@/components/trading/order-form'
import { PositionPanel } from '@/components/trading/position-panel'
import { RecentTrades } from '@/components/trading/recent-trades'
import { MobileTradeDrawer } from '@/components/trading/mobile-trade-drawer'
import { FloatingActionButton } from '@/components/ui/fab'
import { useBinancePrice } from '@/hooks/use-binance-price'
import { DEFAULT_BINANCE_SYMBOL } from '@/lib/binance-market'

export default function TradingPage() {
  const { data: priceData, isLoading, error } = useBinancePrice(DEFAULT_BINANCE_SYMBOL)
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false)

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_360px] h-[calc(100vh-64px)]">
      {/* Left main area */}
      <div className="flex flex-col gap-3 p-3 lg:p-4 overflow-auto">
        {/* Market stats */}
        <div className="bg-white rounded-lg shadow-panel overflow-hidden">
          <MarketStats
            priceData={priceData}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Chart area */}
        <div className="bg-white rounded-lg shadow-panel flex-1 min-h-[300px] lg:min-h-[380px] overflow-hidden">
          <PriceChart priceData={priceData} />
        </div>

        {/* Recent trades panel - 桌面端显示 */}
        <div className="hidden lg:block bg-white rounded-lg shadow-panel h-[280px] overflow-hidden">
          <RecentTrades />
        </div>
      </div>

      {/* Right trading panel - 桌面端显示 */}
      <div className="hidden lg:flex bg-white border-l border-pro-gray-200 flex-col overflow-auto">
        {/* Order form */}
        <OrderForm />

        {/* Position panel */}
        <PositionPanel />
      </div>

      {/* 移动端：最近成交（简化版） */}
      <div className="lg:hidden bg-white rounded-lg shadow-panel mx-3 mb-3 overflow-hidden">
        <RecentTrades />
      </div>

      {/* 移动端：浮动开仓按钮 */}
      <FloatingActionButton
        onClick={() => setIsTradeDrawerOpen(true)}
        label="开仓"
      />

      {/* 移动端：交易抽屉 */}
      <MobileTradeDrawer
        isOpen={isTradeDrawerOpen}
        onClose={() => setIsTradeDrawerOpen(false)}
      />
    </div>
  )
}
