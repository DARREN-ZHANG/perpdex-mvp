'use client'

import { useCallback } from 'react'
import type { OrderFormData } from '@/types/trading'

interface OrderConfirmProps {
  isOpen: boolean
  formData: OrderFormData | null
  currentPrice: number
  onConfirm: () => void
  onCancel: () => void
}

export function OrderConfirm({
  isOpen,
  formData,
  currentPrice,
  onConfirm,
  onCancel,
}: OrderConfirmProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel()
      }
    },
    [onCancel]
  )

  if (!isOpen || !formData) return null

  const notional = parseFloat(formData.size) * currentPrice
  const isLong = formData.side === 'LONG'

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-white mb-4">确认订单</h3>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">方向</span>
            <span
              className={`font-medium ${
                isLong ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {isLong ? '做多' : '做空'}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">杠杆</span>
            <span className="text-white font-medium">{formData.leverage}x</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">数量</span>
            <span className="text-white font-medium">
              {formData.size} BTC
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">保证金</span>
            <span className="text-white font-medium">
              {formData.margin} USDC
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">名义价值</span>
            <span className="text-white font-medium">
              ${notional.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-gray-800">
            <span className="text-gray-400">当前价格</span>
            <span className="text-white font-medium">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">订单类型</span>
            <span className="text-white font-medium">市价单</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              isLong
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            确认下单
          </button>
        </div>
      </div>
    </div>
  )
}
