'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Order, Position } from '@perpdex/shared'

interface TradeResultProps {
  order: Order | null
  position?: Position
  onClose: () => void
}

export function TradeResult({ order, position, onClose }: TradeResultProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (order) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [order, onClose])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }, [onClose])

  if (!order) return null

  const isSuccess = order.status === 'FILLED'
  const isLong = order.side === 'LONG'

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-sm w-full bg-gray-900 rounded-xl shadow-2xl border-l-4 transition-all duration-300 z-50 ${
        isSuccess
          ? 'border-green-500'
          : order.status === 'FAILED'
          ? 'border-red-500'
          : 'border-yellow-500'
      } ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isSuccess
                  ? 'bg-green-500/20'
                  : order.status === 'FAILED'
                  ? 'bg-red-500/20'
                  : 'bg-yellow-500/20'
              }`}
            >
              {isSuccess ? (
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : order.status === 'FAILED' ? (
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-yellow-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-white">
                {isSuccess
                  ? '订单成交'
                  : order.status === 'FAILED'
                  ? '订单失败'
                  : '订单处理中'}
              </h4>
              <p className="text-sm text-gray-400">
                {order.symbol} {isLong ? '做多' : '做空'} {order.size} @ {' '}
                {order.executedPrice || order.requestedPrice || '市价'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {isSuccess && position && (
          <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">仓位 ID</span>
              <span className="text-white font-mono text-xs">
                {position.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">入场价格</span>
              <span className="text-white">${position.entryPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">杠杆</span>
              <span className="text-white">{order.leverage}x</span>
            </div>
          </div>
        )}

        {order.status === 'FAILED' && order.failureMessage && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-sm text-red-400">{order.failureMessage}</p>
          </div>
        )}
      </div>

      <div className="h-1 bg-gray-800 rounded-b-xl overflow-hidden">
        <div
          className={`h-full ${
            isSuccess ? 'bg-green-500' : order.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'
          }`}
          style={{
            animation: 'progress 5s linear forwards',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}
