'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useBalance } from '@/hooks/use-balance'
import { BalanceSummary } from '@/components/asset/balance-card'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'

const USDC_DECIMALS = 6

// 将原始值转换为可读的 USDC 金额
function formatUSDC(value: string | undefined): number {
  if (!value) return 0
  return parseFloat(formatUnits(BigInt(value), USDC_DECIMALS))
}

const ASSETS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    color: '#2775CA',
    letter: 'U',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    color: '#F7931A',
    letter: '₿',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    color: '#627EEA',
    letter: 'Ξ',
  },
]

export default function AssetsPage() {
  const { balance } = useBalance()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [hideZero, setHideZero] = useState(false)

  const availableBalance = formatUSDC(balance?.availableBalance)
  const lockedBalance = formatUSDC(balance?.lockedBalance)
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
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <div className="mb-4 lg:mb-6">
          <div className="h-8 bg-pro-gray-200 rounded w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-pro-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
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
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <div className="mb-4 lg:mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-pro-gray-800 mb-1 lg:mb-2">资产概览</h1>
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
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-4 lg:mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-pro-gray-800 mb-1 lg:mb-2">资产概览</h1>
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

        {/* Desktop: Table View */}
        <div className="hidden md:block overflow-x-auto">
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
                  className="border-b border-pro-gray-50 hover:bg-pro-gray-50 transition-colors"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: asset.color }}
                      >
                        {asset.letter}
                      </div>
                      <div>
                        <div className="font-semibold text-pro-gray-800">
                          {asset.symbol}
                        </div>
                        <div className="text-sm text-pro-gray-500">
                          {asset.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="font-semibold font-mono text-pro-gray-800">
                      {asset.total.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-sm text-pro-gray-500">
                      ≈ ${asset.total.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="font-semibold font-mono text-pro-gray-800">
                      {asset.available.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-sm text-pro-gray-500">
                      ≈ ${asset.available.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {asset.locked > 0 ? (
                      <div className="font-semibold font-mono text-pro-gray-800">
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
                      {asset.symbol === 'USDC' && (
                        <Link
                          href="/deposit"
                          className="px-3 py-1.5 bg-pro-accent-green text-white text-xs font-medium rounded hover:bg-pro-accent-green/90 transition-colors"
                        >
                          充值
                        </Link>
                      )}
                      <button className="px-3 py-1.5 border border-pro-gray-200 text-pro-gray-600 text-xs font-medium rounded hover:border-pro-gray-300 transition-colors">
                        提现
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Card View */}
        <div className="md:hidden space-y-3">
          {assetData.map((asset) => (
            <div
              key={asset.symbol}
              className="bg-white rounded-lg shadow-panel p-4"
            >
              {/* 头部：图标和名称 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: asset.color }}
                  >
                    {asset.letter}
                  </div>
                  <div>
                    <div className="font-semibold text-pro-gray-800">{asset.symbol}</div>
                    <div className="text-xs text-pro-gray-500">{asset.name}</div>
                  </div>
                </div>
                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  {asset.symbol === 'USDC' && (
                    <Link
                      href="/deposit"
                      className="px-3 py-1.5 bg-pro-accent-green text-white text-xs font-medium rounded hover:bg-pro-accent-green/90 transition-colors"
                    >
                      充值
                    </Link>
                  )}
                  <button className="px-3 py-1.5 border border-pro-gray-200 text-pro-gray-600 text-xs font-medium rounded hover:border-pro-gray-300 transition-colors">
                    提现
                  </button>
                </div>
              </div>

              {/* 余额信息 */}
              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-pro-gray-100">
                <div>
                  <div className="text-xs text-pro-gray-500 mb-0.5">总余额</div>
                  <div className="text-sm font-semibold font-mono text-pro-gray-800">
                    {asset.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-pro-gray-500 mb-0.5">可用</div>
                  <div className="text-sm font-semibold font-mono text-pro-gray-800">
                    {asset.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-pro-gray-500 mb-0.5">锁定</div>
                  <div className="text-sm font-semibold font-mono text-pro-gray-800">
                    {asset.locked > 0
                      ? asset.locked.toLocaleString('en-US', { minimumFractionDigits: 2 })
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
