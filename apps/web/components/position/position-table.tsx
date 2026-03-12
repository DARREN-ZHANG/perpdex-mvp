// apps/web/components/position/position-table.tsx
'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react'
import { usePositions, formatAmount, formatPrice } from '@/hooks/use-positions'
import { PnLDisplay, PnLPercentDisplay } from './pnl-display'
import { RiskIndicator } from './risk-indicator'
import { ClosePositionButton } from './close-position'
import type { Position } from '@perpdex/shared'

// 方向标签组件
function SideBadge({ side }: { side: Position['side'] }) {
  const isLong = side === 'LONG'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        isLong
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-red-100 text-red-700 border border-red-200'
      }`}
    >
      {isLong ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isLong ? '做多' : '做空'}
    </span>
  )
}

// 空状态组件
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <TrendingUp className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">暂无持仓</h3>
      <p className="text-sm text-gray-500">您当前没有开仓的仓位</p>
    </div>
  )
}

// 加载状态组件
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
      <p className="text-sm text-gray-500">加载仓位数据...</p>
    </div>
  )
}

// 错误状态组件
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <TrendingDown className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">加载失败</h3>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        重试
      </button>
    </div>
  )
}

// 统计卡片组件
function StatCard({
  label,
  value,
  prefix,
  suffix,
  isPositive,
  isNegative,
}: {
  label: string
  value: string
  prefix?: string
  suffix?: string
  isPositive?: boolean
  isNegative?: boolean
}) {
  const valueColor = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-900'

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-mono font-semibold text-lg ${valueColor}`}>
        {prefix}
        {value}
        {suffix}
      </p>
    </div>
  )
}

export function PositionTable() {
  const {
    positions,
    isLoading,
    isError,
    error,
    refetch,
    closePosition,
    isClosing,
    totalUnrealizedPnl,
    totalMargin,
  } = usePositions()

  const [expandedPosition, setExpandedPosition] = useState<string | null>(null)

  // 切换展开状态
  const toggleExpand = (positionId: string) => {
    setExpandedPosition(expandedPosition === positionId ? null : positionId)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* 标题栏 */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">我的仓位</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {positions.length > 0 ? `共 ${positions.length} 个开仓` : '暂无持仓'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 统计概览 */}
      {positions.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-200 grid grid-cols-3 gap-4">
          <StatCard
            label="总保证金"
            value={formatAmount(totalMargin.toString(), 2)}
            prefix="$"
            suffix=" USDC"
          />
          <StatCard
            label="总未实现盈亏"
            value={formatAmount(Math.abs(totalUnrealizedPnl).toString(), 2)}
            prefix={totalUnrealizedPnl >= 0 ? '+$' : '-$'}
            suffix=" USDC"
            isPositive={totalUnrealizedPnl > 0}
            isNegative={totalUnrealizedPnl < 0}
          />
          <StatCard
            label="仓位数量"
            value={positions.length.toString()}
            suffix=" 个"
          />
        </div>
      )}

      {/* 内容区域 */}
      <div className="p-6">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={error || '加载失败'} onRetry={refetch} />
        ) : positions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    交易对
                  </th>
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    方向
                  </th>
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    仓位大小
                  </th>
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    开仓价格
                  </th>
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    标记价格
                  </th>
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    未实现盈亏
                  </th>
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                    风险
                  </th>
                  <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positions.map((position) => (
                  <>
                    <tr
                      key={position.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(position.id)}
                    >
                      {/* 交易对 */}
                      <td className="py-4">
                        <span className="font-mono font-medium text-gray-900">
                          {position.symbol}/USDC
                        </span>
                      </td>

                      {/* 方向 */}
                      <td className="py-4">
                        <SideBadge side={position.side} />
                      </td>

                      {/* 仓位大小 */}
                      <td className="py-4 text-right">
                        <span className="font-mono text-sm text-gray-900">
                          {formatAmount(position.positionSize, 6)} BTC
                        </span>
                      </td>

                      {/* 开仓价格 */}
                      <td className="py-4 text-right">
                        <span className="font-mono text-sm text-gray-900">
                          {formatPrice(position.entryPrice)}
                        </span>
                      </td>

                      {/* 标记价格 */}
                      <td className="py-4 text-right">
                        <span className="font-mono text-sm text-gray-900">
                          {formatPrice(position.markPrice)}
                        </span>
                      </td>

                      {/* 未实现盈亏 */}
                      <td className="py-4 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <PnLDisplay pnl={position.unrealizedPnl} />
                          <PnLPercentDisplay
                            pnl={position.unrealizedPnl}
                            margin={position.margin}
                          />
                        </div>
                      </td>

                      {/* 风险等级 */}
                      <td className="py-4 text-center">
                        <div className="flex justify-center">
                          <RiskIndicator riskLevel={position.riskLevel} />
                        </div>
                      </td>

                      {/* 操作 */}
                      <td className="py-4 text-right">
                        <div onClick={(e) => e.stopPropagation()}>
                          <ClosePositionButton
                            position={position}
                            onClose={closePosition}
                            isClosing={isClosing(position.id)}
                          />
                        </div>
                      </td>
                    </tr>

                    {/* 展开详情 */}
                    {expandedPosition === position.id && (
                      <tr>
                        <td colSpan={8} className="py-4 px-4 bg-gray-50">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">保证金</p>
                              <p className="font-mono font-medium text-gray-900">
                                {formatAmount(position.margin, 2)} USDC
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">杠杆倍数</p>
                              <p className="font-mono font-medium text-gray-900">
                                {(
                                  parseFloat(position.positionSize) *
                                  parseFloat(position.markPrice)
                                ).toFixed(2)}x
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">清算价格</p>
                              <p className="font-mono font-medium text-red-600">
                                {formatPrice(position.liquidationPrice)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">开仓时间</p>
                              <p className="font-mono font-medium text-gray-900">
                                {new Date(position.openedAt).toLocaleString('zh-CN')}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
