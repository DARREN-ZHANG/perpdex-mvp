'use client'

import { MarketStats } from '@/components/trading/market-stats'
import { PriceChart } from '@/components/trading/price-chart'
import { OrderForm } from '@/components/trading/order-form'
import { PositionPanel } from '@/components/trading/position-panel'
import { RecentTrades } from '@/components/trading/recent-trades'
import { useBinancePrice } from '@/hooks/use-binance-price'
import { DEFAULT_BINANCE_SYMBOL } from '@/lib/binance-market'

export default function TradingPage() {
  const { data: priceData, isLoading, error } = useBinancePrice(DEFAULT_BINANCE_SYMBOL)

  return (
    <div className="grid grid-cols-[1fr_360px] h-[calc(100vh-64px)]">
      {/* Left main area */}
      <div className="flex flex-col gap-3 p-4 overflow-auto">
        {/* Market stats */}
        <div className="bg-white rounded-lg shadow-panel overflow-hidden">
          <MarketStats
            priceData={priceData}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Chart area */}
        <div className="bg-white rounded-lg shadow-panel flex-1 min-h-[380px] overflow-hidden">
          <PriceChart priceData={priceData} />
        </div>

        {/* Recent trades panel */}
        <div className="bg-white rounded-lg shadow-panel h-[280px] overflow-hidden">
          <RecentTrades />
        </div>
      </div>

      {/* Right trading panel */}
      <div className="bg-white border-l border-pro-gray-200 flex flex-col overflow-auto">
        {/* Order form */}
        <OrderForm />

        {/* Position panel */}
        <PositionPanel />
      </div>
    </div>
  )
}
