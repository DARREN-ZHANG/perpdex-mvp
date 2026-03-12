// apps/web/components/position/close-position.tsx
'use client'

import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import type { Position } from '@perpdex/shared'
import { formatAmount, formatPrice, formatPnL } from '@/hooks/use-positions'
import { PnLDisplay } from './pnl-display'

interface ClosePositionProps {
  position: Position
  onClose: (positionId: string) => Promise<boolean>
  isClosing: boolean
}

export function ClosePositionButton({ position, onClose, isClosing }: ClosePositionProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClose = async () => {
    const success = await onClose(position.id)
    if (success) {
      setShowConfirm(false)
    }
  }

  const { isPositive, isNegative } = formatPnL(position.unrealizedPnl)

  return (
    <>
      {/* 平仓按钮 */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isClosing}
        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1"
      >
        {isClosing ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            处理中
          </>
        ) : (
          <>
            <X className="w-3 h-3" />
            平仓
          </>
        )}
      </button>

      {/* 确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            {/* 标题 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">确认平仓</h3>
                <p className="text-sm text-gray-500">此操作不可撤销</p>
              </div>
            </div>

            {/* 仓位信息 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">交易对</span>
                <span className="font-mono font-medium text-gray-900">
                  {position.symbol}/USDC
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-500">方向</span>
                <span
                  className={`font-medium ${
                    position.side === 'LONG' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {position.side === 'LONG' ? '做多' : '做空'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-500">仓位大小</span>
                <span className="font-mono font-medium text-gray-900">
                  {formatAmount(position.positionSize, 6)} BTC
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-500">开仓价格</span>
                <span className="font-mono font-medium text-gray-900">
                  {formatPrice(position.entryPrice)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-500">标记价格</span>
                <span className="font-mono font-medium text-gray-900">
                  {formatPrice(position.markPrice)}
                </span>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">预计盈亏</span>
                  <PnLDisplay pnl={position.unrealizedPnl} size="lg" />
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-500">返还保证金</span>
                <span className="font-mono font-medium text-gray-900">
                  {formatAmount(position.margin, 2)} USDC
                </span>
              </div>
            </div>

            {/* 盈亏提示 */}
            {(isPositive || isNegative) && (
              <div
                className={`mb-6 p-3 rounded-lg text-sm ${
                  isPositive
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {isPositive
                  ? `盈利 $${formatAmount(position.unrealizedPnl, 2)} USDC 将添加到您的可用余额`
                  : `亏损 $${formatAmount(position.unrealizedPnl.replace('-', ''), 2)} USDC 将从保证金中扣除`}
              </div>
            )}

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isClosing}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClose}
                disabled={isClosing}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isClosing && <Loader2 className="w-4 h-4 animate-spin" />}
                确认平仓
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
