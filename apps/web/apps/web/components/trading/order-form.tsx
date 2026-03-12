'use client'

import { useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// 订单表单验证 schema
const orderSchema = z.object({
  symbol: z.enum(['BTC', 'ETH']),
  side: z.enum(['LONG', 'SHORT']),
  margin: z.string().min(1, '请输入保证金'),
  leverage: z.number().min(1).max(20),
})

type OrderFormData = z.infer<typeof orderSchema>

interface OrderFormProps {
  availableBalance?: string
  currentPrice?: number
  onSubmit?: (data: OrderFormData) => void
}

export function OrderForm({
  availableBalance = '10000',
  currentPrice = 65000,
  onSubmit,
}: OrderFormProps) {
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      symbol: 'BTC',
      side: 'LONG',
      margin: '',
      leverage: 10,
    },
  })

  const watchMargin = watch('margin')
  const watchLeverage = watch('leverage')

  // 计算仓位信息
  const positionInfo = useMemo(() => {
    const margin = parseFloat(watchMargin) || 0
    const leverage = watchLeverage || 1

    if (margin > 0 && currentPrice > 0) {
      const notional = margin * leverage
      const size = notional / currentPrice
      const liquidationPrice =
        selectedSide === 'LONG'
          ? currentPrice * (1 - 0.9 / leverage)
          : currentPrice * (1 + 0.9 / leverage)

      return {
        size: size.toFixed(4),
        notional: notional.toFixed(2),
        liquidationPrice: liquidationPrice.toFixed(2),
        fee: (notional * 0.0005).toFixed(2),
      }
    }

    return null
  }, [watchMargin, watchLeverage, currentPrice, selectedSide])

  // 处理多空切换
  const handleSideChange = useCallback(
    (side: 'LONG' | 'SHORT') => {
      setSelectedSide(side)
      setValue('side', side)
    },
    [setValue]
  )

  // 处理杠杆快捷按钮
  const handleLeverageQuickSet = useCallback(
    (value: number) => {
      setValue('leverage', value)
    },
    [setValue]
  )

  // 处理表单提交
  const handleFormSubmit = useCallback(
    (data: OrderFormData) => {
      onSubmit?.(data)
    },
    [onSubmit]
  )

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">下单</h3>

      {/* 多空切换 */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleSideChange('LONG')}
          className={\`flex-1 py-2 px-4 rounded-lg font-medium transition-colors \${
            selectedSide === 'LONG'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }\`}
        >
          做多
        </button>
        <button
          type="button"
          onClick={() => handleSideChange('SHORT')}
          className={\`flex-1 py-2 px-4 rounded-lg font-medium transition-colors \${
            selectedSide === 'SHORT'
              ? 'bg-red-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }\`}
        >
          做空
        </button>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* 交易对选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            交易对
          </label>
          <select
            {...register('symbol')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="BTC">BTC/USD</option>
            <option value="ETH">ETH/USD</option>
          </select>
        </div>

        {/* 保证金输入 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            保证金 (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              {...register('margin')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              USDC
            </span>
          </div>
          {errors.margin && (
            <p className="text-red-500 text-xs mt-1">{errors.margin.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            可用余额: {parseFloat(availableBalance).toFixed(2)} USDC
          </p>
        </div>

        {/* 杠杆滑块 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">杠杆</label>
            <span className="text-sm font-bold text-blue-600">
              {watchLeverage}x
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            {...register('leverage', { valueAsNumber: true })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between mt-2">
            {[1, 5, 10, 20].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleLeverageQuickSet(value)}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                {value}x
              </button>
            ))}
          </div>
        </div>

        {/* 计算结果展示 */}
        {positionInfo && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">仓位大小</span>
              <span className="font-medium">{positionInfo.size} BTC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">名义价值</span>
              <span className="font-medium">\${positionInfo.notional}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">预估强平价</span>
              <span className="font-medium text-red-500">
                \${positionInfo.liquidationPrice}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">手续费 (0.05%)</span>
              <span className="font-medium">\${positionInfo.fee}</span>
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          className={\`w-full py-3 rounded-lg font-semibold text-white transition-colors \${
            selectedSide === 'LONG'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-red-500 hover:bg-red-600'
          }\`}
        >
          {selectedSide === 'LONG' ? '买入/做多' : '卖出/做空'}
        </button>
      </form>
    </div>
  )
}
