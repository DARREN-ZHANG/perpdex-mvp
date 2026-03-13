import { MarketStats } from '@/components/trading/market-stats'
import { PriceChart } from '@/components/trading/price-chart'
import { OrderForm } from '@/components/trading/order-form'
import { PositionPanel } from '@/components/trading/position-panel'
import { RecentTrades } from '@/components/trading/recent-trades'

export default function TradingPage() {
  return (
    <div className="grid grid-cols-[1fr_360px] h-[calc(100vh-64px)]">
      {/* Left main area */}
      <div className="flex flex-col gap-3 p-4 overflow-auto">
        {/* Market stats */}
        <div className="bg-white rounded-lg shadow-panel overflow-hidden">
          <MarketStats />
        </div>

        {/* Chart area */}
        <div className="bg-white rounded-lg shadow-panel flex-1 min-h-[380px] overflow-hidden">
          <PriceChart />
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
