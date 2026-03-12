import { useMemo } from 'react'
import { useMarket } from './use-market'

interface OrderEstimateParams {
  margin: number
  leverage: number
  side: 'long' | 'short'
}

interface OrderEstimate {
  positionSize: number
  entryPrice: number
  liquidationPrice: number
  fee: number
}

export function useOrderEstimate({
  margin,
  leverage,
  side,
}: OrderEstimateParams): OrderEstimate {
  const { marketData } = useMarket('BTC')

  return useMemo(() => {
    if (!marketData || !margin || !leverage) {
      return {
        positionSize: 0,
        entryPrice: 0,
        liquidationPrice: 0,
        fee: 0,
      }
    }

    const positionSize = margin * leverage
    const entryPrice = parseFloat(marketData.markPrice)

    // Simplified liquidation price: entryPrice * (1 ± 1/leverage * 0.9)
    const liquidationPrice =
      side === 'long'
        ? entryPrice * (1 - (1 / leverage) * 0.9)
        : entryPrice * (1 + (1 / leverage) * 0.9)

    // Fee rate 0.05%
    const feeRate = 0.0005
    const fee = positionSize * feeRate

    return {
      positionSize,
      entryPrice,
      liquidationPrice,
      fee,
    }
  }, [margin, leverage, side, marketData])
}
