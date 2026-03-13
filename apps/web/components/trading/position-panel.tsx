'use client'

import { usePositions } from '@/hooks/use-positions'
import { useBinancePrice } from '@/hooks/use-binance-price'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  calculatePositionUnrealizedPnl,
  parseUsdcBaseUnits,
} from '@/hooks/use-positions'

export function PositionPanel() {
  const {
    positions,
    closePosition,
    closeAllPositions,
    isLoading,
    isClosing,
    isClosingAll,
  } = usePositions()
  const { data: priceData } = useBinancePrice('BTCUSDT')

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
        <button
          type="button"
          onClick={async () => {
            const result = await closeAllPositions()

            if (result.success) {
              toast.success('全部平仓成功', {
                description:
                  result.closedCount > 0
                    ? `已平仓 ${result.closedCount} 个仓位`
                    : '当前没有可平仓位',
                duration: 3000,
              })
              return
            }

            toast.error('全部平仓未完成', {
              description:
                result.closedCount > 0
                  ? `已平仓 ${result.closedCount} 个，失败 ${result.failedCount} 个`
                  : result.error || '请稍后重试',
              duration: 5000,
            })
          }}
          disabled={isClosingAll}
          className="inline-flex items-center text-xs text-pro-accent-red hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isClosingAll ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              全部平仓中...
            </span>
          ) : (
            '全部平仓'
          )}
        </button>
      </div>

      {positions.map((position) => {
        const pnl = calculatePositionUnrealizedPnl(position, priceData?.price)
        const isProfitable = pnl >= 0
        const positionSize = parseFloat(position.positionSize || '0')
        const entryPrice = parseFloat(position.entryPrice || '0')
        const liquidationPrice = parseFloat(position.liquidationPrice || '0')
        const markPrice = priceData?.price ?? 0
        const formattedPositionSize = positionSize.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 5,
        })
        const formattedMargin = parseUsdcBaseUnits(position.margin).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        })

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
                  {formattedPositionSize} BTC
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
                  {pnl.toFixed(2)} USD
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
                <div className="text-xs text-pro-gray-500 mb-0.5">金额</div>
                <div className="text-sm font-mono">{formattedMargin} USDC</div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">清算价格</div>
                <div className="text-sm font-mono text-pro-accent-red">
                  {liquidationPrice ? liquidationPrice.toLocaleString() : '—'}
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                const result = await closePosition(position.id)

                if (result.success) {
                  toast.success('平仓成功', {
                    description: `${position.symbol} 仓位已平仓`,
                    duration: 3000,
                  })
                  return
                }

                toast.error('平仓失败', {
                  description: result.error || '请稍后重试',
                  duration: 5000,
                })
              }}
              disabled={isClosing(position.id) || isClosingAll}
              className="w-full py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-500 hover:bg-pro-gray-50 hover:border-pro-accent-red hover:text-pro-accent-red transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClosing(position.id) || isClosingAll ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isClosingAll ? '全部平仓中...' : '平仓中...'}
                </span>
              ) : (
                '平仓'
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
