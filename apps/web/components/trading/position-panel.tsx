'use client'

import { usePositions } from '@/hooks/use-positions'
import { useMarket } from '@/hooks/use-market'
import { Loader2 } from 'lucide-react'

export function PositionPanel() {
  const { positions, closePosition, isLoading } = usePositions()
  const { marketData } = useMarket('BTC')

  if (isLoading) {
    return (
      <div className="border-t border-pro-gray-200 p-5 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-pro-gray-400" />
      </div>
    )
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="border-t border-pro-gray-200 p-5">
        <div className="text-sm text-pro-gray-500 text-center py-4">
          暂无持仓
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-pro-gray-200">
      <div className="px-5 py-3 border-b border-pro-gray-100 flex justify-between items-center">
        <span className="text-xs font-semibold text-pro-gray-800 uppercase tracking-wider">
          当前仓位
        </span>
        <span className="text-xs text-pro-accent-cyan cursor-pointer hover:underline">
          查看全部
        </span>
      </div>

      {positions.map((position) => {
        const pnl = parseFloat(position.unrealizedPnl || '0')
        const isProfitable = pnl >= 0
        const positionSize = parseFloat(position.positionSize || '0')
        const entryPrice = parseFloat(position.entryPrice || '0')
        const liquidationPrice = parseFloat(position.liquidationPrice || '0')
        const markPrice = marketData?.markPrice ? parseFloat(marketData.markPrice) : 0

        return (
          <div key={position.id} className="p-5 border-b border-pro-gray-100 last:border-b-0">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-pro-gray-800">{position.symbol}/USD</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  position.side === 'LONG'
                    ? 'bg-pro-accent-green/10 text-pro-accent-green'
                    : 'bg-pro-accent-red/10 text-pro-accent-red'
                }`}
              >
                {position.side === 'LONG' ? '做多' : '做空'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">仓位大小</div>
                <div className="text-sm font-semibold font-mono">
                  {positionSize.toLocaleString()} USD
                </div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">未实现盈亏</div>
                <div
                  className={`text-sm font-semibold font-mono ${
                    isProfitable ? 'text-pro-accent-green' : 'text-pro-accent-red'
                  }`}
                >
                  {isProfitable ? '+' : ''}
                  {pnl.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">开仓价格</div>
                <div className="text-sm font-mono">{entryPrice.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">标记价格</div>
                <div className="text-sm font-mono">
                  {markPrice ? markPrice.toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">保证金</div>
                <div className="text-sm font-mono">{parseFloat(position.margin).toLocaleString()} USDC</div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">清算价格</div>
                <div className="text-sm font-mono text-pro-accent-red">
                  {liquidationPrice ? liquidationPrice.toLocaleString() : '—'}
                </div>
              </div>
            </div>

            <button
              onClick={() => closePosition(position.id)}
              className="w-full py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-500 hover:bg-pro-gray-50 hover:border-pro-accent-red hover:text-pro-accent-red transition-colors"
            >
              平仓
            </button>
          </div>
        )
      })}
    </div>
  )
}
