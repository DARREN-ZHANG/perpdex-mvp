'use client'

import { useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { OrderSide, OrderFormData } from '@/types/trading'
import { TRADING_CONFIG } from '@/config/constants'

interface OrderFormProps {
  currentPrice: number
  availableBalance: string
  onSubmit: (data: OrderFormData) => Promise<void>
  isSubmitting: boolean
}

const orderFormSchema = z.object({
  side: z.enum(['LONG', 'SHORT']),
  size: z.string().min(1, '请输入数量'),
  margin: z.string().min(1, '请输入保证金'),
  leverage: z.number().min(1).max(20),
})

type OrderFormValues = z.infer<typeof orderFormSchema>

export function OrderForm({
  currentPrice,
  availableBalance,
  onSubmit,
  isSubmitting,
}: OrderFormProps) {
  const [selectedSide, setSelectedSide] = useState<OrderSide>('LONG')
  const balanceNum = parseFloat(availableBalance) || 0

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      side: 'LONG',
      size: '',
      margin: '',
      leverage: TRADING_CONFIG.DEFAULT_LEVERAGE,
    },
  })

  const watchSize = watch('size')
  const watchMargin = watch('margin')
  const watchLeverage = watch('leverage')

  const estimate = useMemo(() => {
    const size = parseFloat(watchSize) || 0
    const leverage = watchLeverage || 1

    if (size > 0 && currentPrice > 0) {
      const notional = size * currentPrice
      const requiredMargin = notional / leverage
      return {
        notional: notional.toFixed(2),
        requiredMargin: requiredMargin.toFixed(2),
        liquidationPrice:
          selectedSide === 'LONG'
            ? (currentPrice * (1 - 0.9 / leverage)).toFixed(2)
            : (currentPrice * (1 + 0.9 / leverage)).toFixed(2),
      }
    }

    return null
  }, [watchSize, watchMargin, watchLeverage, currentPrice, selectedSide])

  const handleSideChange = useCallback(
    (side: OrderSide) => {
      setSelectedSide(side)
      setValue('side', side)
    },
    [setValue]
  )

  const handlePercentageClick = useCallback(
    (percentage: number) => {
      const margin = (balanceNum * percentage).toFixed(2)
      setValue('margin', margin)

      if (currentPrice > 0 && watchLeverage > 0) {
        const notional = parseFloat(margin) * watchLeverage
        const size = (notional / currentPrice).toFixed(4)
        setValue('size', size)
      }
    },
    [balanceNum, currentPrice, watchLeverage, setValue]
  )

  const handleLeverageChange = useCallback(
    (value: number) => {
      setValue('leverage', value)

      if (watchMargin && currentPrice > 0) {
        const notional = parseFloat(watchMargin) * value
        const size = (notional / currentPrice).toFixed(4)
        setValue('size', size)
      }
    },
    [watchMargin, currentPrice, setValue]
  )

  const handleFormSubmit = useCallback(
    async (values: OrderFormValues) => {
      await onSubmit({
        side: values.side,
        size: values.size,
        margin: values.margin,
        leverage: values.leverage,
      })
    },
    [onSubmit]
  )

  return (
    <div className="w-full bg-gray-900 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">下单</h3>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleSideChange('LONG')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            selectedSide === 'LONG'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          做多
        </button>
        <button
          type="button"
          onClick={() => handleSideChange('SHORT')}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
            selectedSide === 'SHORT'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          做空
        </button>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-gray-400">杠杆</label>
            <span className="text-sm font-medium text-white">
              {watchLeverage}x
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={TRADING_CONFIG.MAX_LEVERAGE}
            {...register('leverage', { valueAsNumber: true })}
            onChange={(e) => handleLeverageChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1x</span>
            <span>{TRADING_CONFIG.MAX_LEVERAGE}x</span>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            保证金 (USDC)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              {...register('margin')}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
              placeholder="0.00"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              USDC
            </span>
          </div>
          {errors.margin && (
            <p className="text-red-500 text-xs mt-1">{errors.margin.message}</p>
          )}

          <div className="flex gap-2 mt-2">
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentageClick(pct)}
                className="flex-1 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors"
              >
                {pct * 100}%
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            可用余额: {balanceNum.toFixed(2)} USDC
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            数量 (BTC)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.0001"
              {...register('size')}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
              placeholder="0.0000"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              BTC
            </span>
          </div>
          {errors.size && (
            <p className="text-red-500 text-xs mt-1">{errors.size.message}</p>
          )}
        </div>

        {estimate && (
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">名义价值</span>
              <span className="text-white">${estimate.notional}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">所需保证金</span>
              <span className="text-white">${estimate.requiredMargin}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">预估强平价</span>
              <span className="text-red-400">${estimate.liquidationPrice}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedSide === 'LONG'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              提交中...
            </span>
          ) : (
            `${selectedSide === 'LONG' ? '买入/做多' : '卖出/做空'}`
          )}
        </button>
      </form>
    </div>
  )
}
