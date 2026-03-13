'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useBalance } from '@/hooks/use-balance'
import { parseUsdcBaseUnits, usePositions } from '@/hooks/use-positions'
import { BalanceSummary } from '@/components/asset/balance-card'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'

const USDC_DECIMALS = 6

// 将原始值转换为可读的 USDC 金额
function formatUSDC(value: string | undefined): number {
  if (!value) return 0
  return parseFloat(formatUnits(BigInt(value), USDC_DECIMALS))
}

function clampNonNegative(value: number): number {
  return value > 0 ? value : 0
}

const ASSETS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    color: '#2775CA',
    letter: 'U',
    supported: true,
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    color: '#F7931A',
    letter: '₿',
    supported: false,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    color: '#627EEA',
    letter: 'Ξ',
    supported: false,
  },
]

export default function AssetsPage() {
  const { balance } = useBalance()
  const { positions } = usePositions()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [hideZero, setHideZero] = useState(false)

  const availableBalance = formatUSDC(balance?.availableBalance)
  const lockedBalanceFromPositions = positions.reduce((sum, pos) => {
    return sum + parseUsdcBaseUnits(pos.margin)
  }, 0)
  const lockedBalance = clampNonNegative(
    positions.length > 0 ? lockedBalanceFromPositions : formatUSDC(balance?.lockedBalance)
  )
  const totalBalance = availableBalance + lockedBalance

  const assetData = ASSETS.map((asset) => ({
    ...asset,
    total: asset.symbol === 'USDC' ? totalBalance : 0,
    available: asset.symbol === 'USDC' ? availableBalance : 0,
    locked: asset.symbol === 'USDC' ? lockedBalance : 0,
  })).filter((asset) => !hideZero || asset.total > 0)

  // 加载状态
  if (authLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="h-8 bg-pro-gray-200 rounded w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-pro-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-5 h-24 animate-pulse" />
          ))}
        </div>
        <div className="bg-white rounded-lg h-64 animate-pulse" />
      </div>
    )
  }

  // 未登录状态
  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-pro-gray-800 mb-2">资产概览</h1>
          <p className="text-sm text-pro-gray-500">查看您的账户余额和资金状况</p>
        </div>

        <div className="bg-white rounded-lg shadow-panel p-12 text-center">
          <p className="text-pro-gray-500 mb-4">请先连接钱包并登录以查看资产</p>
          <p className="text-sm text-pro-gray-400">点击右上角「连接钱包」按钮开始</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-pro-gray-800 mb-2">资产概览</h1>
        <p className="text-sm text-pro-gray-500">
          查看您的账户余额和资金状况
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6">
        <BalanceSummary />
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-lg shadow-panel overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-pro-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-pro-gray-800">我的资产</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-pro-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={hideZero}
                onChange={(e) => setHideZero(e.target.checked)}
                className="rounded border-pro-gray-300"
              />
              隐藏零余额
            </label>
            <Link
              href="/deposit"
              className="px-4 py-2 bg-pro-gray-900 text-white text-sm font-medium rounded-md hover:bg-pro-gray-800 transition-colors"
            >
              充值
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-pro-gray-50 text-xs text-pro-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left font-semibold">资产</th>
                <th className="px-6 py-3 text-right font-semibold">总余额</th>
                <th className="px-6 py-3 text-right font-semibold">可用余额</th>
                <th className="px-6 py-3 text-right font-semibold">已锁定</th>
                <th className="px-6 py-3 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {assetData.map((asset) => (
                <tr
                  key={asset.symbol}
                  className={`border-b border-pro-gray-50 transition-colors ${
                    asset.supported ? 'hover:bg-pro-gray-50' : 'bg-pro-gray-50/60'
                  }`}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          asset.supported ? 'text-white' : 'text-pro-gray-500'
                        }`}
                        style={{ backgroundColor: asset.supported ? asset.color : '#E5E7EB' }}
                      >
                        {asset.letter}
                      </div>
                      <div>
                        <div className={`font-semibold ${asset.supported ? 'text-pro-gray-800' : 'text-pro-gray-400'}`}>
                          {asset.symbol}
                        </div>
                        <div className={`text-sm ${asset.supported ? 'text-pro-gray-500' : 'text-pro-gray-400'}`}>
                          {asset.name}
                        </div>
                        {!asset.supported && (
                          <div className="text-xs text-pro-gray-400 mt-1">
                            CFD 模式暂不支持该资产充提
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className={`font-semibold font-mono ${asset.supported ? 'text-pro-gray-800' : 'text-pro-gray-400'}`}>
                      {asset.total.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className={`text-sm ${asset.supported ? 'text-pro-gray-500' : 'text-pro-gray-400'}`}>
                      ≈ ${asset.total.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className={`font-semibold font-mono ${asset.supported ? 'text-pro-gray-800' : 'text-pro-gray-400'}`}>
                      {asset.available.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className={`text-sm ${asset.supported ? 'text-pro-gray-500' : 'text-pro-gray-400'}`}>
                      ≈ ${asset.available.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {asset.locked > 0 ? (
                      <div className={`font-semibold font-mono ${asset.supported ? 'text-pro-gray-800' : 'text-pro-gray-400'}`}>
                        {asset.locked.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    ) : (
                      <span className="text-pro-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {asset.symbol === 'USDC' ? (
                        <>
                          <Link
                            href="/deposit"
                            className="px-3 py-1.5 bg-pro-accent-green text-white text-xs font-medium rounded hover:bg-pro-accent-green/90 transition-colors"
                          >
                            充值
                          </Link>
                          <Link
                            href="/withdraw"
                            className="px-3 py-1.5 border border-pro-gray-200 text-pro-gray-600 text-xs font-medium rounded hover:border-pro-gray-300 transition-colors"
                          >
                            提现
                          </Link>
                        </>
                      ) : (
                        <span className="px-3 py-1.5 text-xs font-medium text-pro-gray-400 bg-pro-gray-100 rounded">
                          暂不支持
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
