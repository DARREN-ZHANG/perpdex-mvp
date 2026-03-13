'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useBalance } from '@/hooks/use-balance'
import { useOrderEstimate } from '@/hooks/use-order-estimate'
import { useOrders } from '@/hooks/use-orders'
import { LeverageSlider } from './leverage-slider'
import { Loader2 } from 'lucide-react'
import type { OrderSide } from '@/types/trading'

const USDC_DECIMALS = 6

// 将原始值转换为可读的 USDC 金额
function formatBalance(value: string | undefined): number {
  if (!value) return 0
  return parseFloat(formatUnits(BigInt(value), USDC_DECIMALS))
}

export function OrderForm() {
  const [side, setSide] = useState<OrderSide>('LONG')
  const [margin, setMargin] = useState('')
  const [leverage, setLeverage] = useState(10)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { balance } = useBalance()
  const { submitOrder } = useOrders()
  const estimate = useOrderEstimate({
    margin: Number(margin) || 0,
    leverage,
    side: side === 'LONG' ? 'long' : 'short',
  })

  const availableBalance = formatBalance(balance?.availableBalance)

  const handleSubmit = async () => {
    if (!margin || Number(margin) <= 0) return
    if (Number(margin) > availableBalance) return

    setIsSubmitting(true)
    try {
      await submitOrder({
        side,
        size: (Number(margin) * leverage / estimate.entryPrice).toFixed(4),
        margin,
        leverage,
      })
      setMargin('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-5">
      {/* Long/Short toggle */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => setSide('LONG')}
          className={`py-2.5 rounded-md text-sm font-semibold transition-colors ${
            side === 'LONG'
              ? 'bg-pro-accent-green text-white'
              : 'bg-pro-accent-green/10 text-pro-accent-green border border-pro-accent-green/20'
          }`}
        >
          开多
        </button>
        <button
          onClick={() => setSide('SHORT')}
          className={`py-2.5 rounded-md text-sm font-semibold transition-colors ${
            side === 'SHORT'
              ? 'bg-pro-accent-red text-white'
              : 'bg-pro-accent-red/10 text-pro-accent-red border border-pro-accent-red/20'
          }`}
        >
          开空
        </button>
      </div>

      {/* Margin input */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-pro-gray-500 mb-1.5">
          <span>保证金</span>
          <span className="text-pro-accent-cyan">
            可用: {availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-pro-gray-50 border border-pro-gray-200 rounded-lg text-pro-gray-800 font-mono focus:outline-none focus:border-pro-accent-cyan focus:bg-white transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-pro-gray-500">
            USDC
          </span>
        </div>
      </div>

      {/* Leverage slider */}
      <div className="mb-5">
        <div className="flex justify-between text-sm text-pro-gray-500 mb-1.5">
          <span>杠杆倍数</span>
          <span className="text-pro-accent-cyan font-semibold">{leverage}x</span>
        </div>
        <LeverageSlider value={leverage} onChange={setLeverage} />
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!margin || Number(margin) <= 0 || Number(margin) > availableBalance || isSubmitting}
        className={`w-full py-3.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          side === 'LONG'
            ? 'bg-pro-accent-green text-white hover:bg-pro-accent-green/90'
            : 'bg-pro-accent-red text-white hover:bg-pro-accent-red/90'
        }`}
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          `开${side === 'LONG' ? '多' : '空'} BTC`
        )}
      </button>

      {/* Order estimate summary */}
      {Number(margin) > 0 && (
        <div className="mt-5 pt-5 border-t border-pro-gray-100 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">仓位大小</span>
            <span className="font-mono font-medium">
              {estimate.positionSize.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">开仓价格</span>
            <span className="font-mono font-medium">
              ≈ {estimate.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">清算价格</span>
            <span className="font-mono font-medium text-pro-accent-red">
              {estimate.liquidationPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">手续费</span>
            <span className="font-mono font-medium">
              {estimate.fee.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
