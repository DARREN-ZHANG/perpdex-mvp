// apps/web/components/position/close-position.tsx
'use client'

import { useState } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import type { Position } from '@perpdex/shared'
import { formatPrice, formatAmount, formatPnL } from '@/hooks/use-positions'
import { PnLDisplay } from './pnl-display'

interface ClosePositionButtonProps {
  position: Position
  onClose: (positionId: string) => Promise<boolean>
  isClosing: boolean
}

export function ClosePositionButton({ position, onClose, isClosing }: ClosePositionButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const handleClose = async () => {
    const success = await onClose(position.id)
    if (success) {
      setShowModal(false)
    }
  }

  const estimatedPnl = parseFloat(position.unrealizedPnl)
  const marginReturn = parseFloat(position.margin)

  return (
    <>
      {/* 平仓按钮 */}
      <button
        onClick={() => setShowModal(true)}
        disabled={isClosing}
        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
      >
        {isClosing ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            平仓中
          </>
        ) : (
          <>
            <X className="w-3 h-3" />
            平仓
          </>
        )}
      </button>

      {/* 确认弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">确认平仓</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容 */}
            <div className="px-6 py-4 space-y-4">
              {/* 警告提示 */}
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  平仓后将无法撤销，请确认您的操作。
                </p>
              </div>

              {/* 仓位详情 */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">交易对</span>
                  <span className="font-medium text-gray-900">{position.symbol}/USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">方向</span>
                  <span
                    className={`font-medium ${
                      position.side === 'LONG' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {position.side === 'LONG' ? '做多' : '做空'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">仓位大小</span>
                  <span className="font-mono font-medium text-gray-900">
                    {formatAmount(position.positionSize, 6)} BTC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">开仓价格</span>
                  <span className="font-mono font-medium text-gray-900">
                    {formatPrice(position.entryPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">标记价格</span>
                  <span className="font-mono font-medium text-gray-900">
                    {formatPrice(position.markPrice)}
                  </span>
                </div>
              </div>

              {/* 分割线 */}
              <div className="border-t border-gray-200" />

              {/* 盈亏和返还 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">预计盈亏</span>
                  <PnLDisplay pnl={position.unrealizedPnl} size="lg" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">返还保证金</span>
                  <span className="font-mono font-semibold text-lg text-gray-900">
                    +{formatAmount(marginReturn.toString(), 2)} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="font-medium text-gray-900">总计返还</span>
                  <span
                    className={`font-mono font-bold text-lg ${
                      estimatedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {estimatedPnl >= 0 ? '+' : '-'}
                    {formatAmount((marginReturn + Math.abs(estimatedPnl)).toString(), 2)} USDC
                  </span>
                </div>
              </div>
            </div>

            {/* 按钮 */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isClosing}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClose}
                disabled={isClosing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isClosing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  '确认平仓'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
