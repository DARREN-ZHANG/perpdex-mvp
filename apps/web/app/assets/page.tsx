// apps/web/app/assets/page.tsx
'use client'

import { useState } from 'react'
import { BalanceCard } from '@/components/asset/balance-card'
import { DepositFlow } from '@/components/asset/deposit-flow'
import { WithdrawFlow } from '@/components/asset/withdraw-flow'
import { TransactionHistory } from '@/components/asset/transaction-history'
import { useAuth } from '@/hooks/use-auth'

export default function AssetsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">资产管理</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-8 bg-gray-800 rounded mb-4" />
              <div className="h-32 bg-gray-800 rounded" />
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-8 bg-gray-800 rounded mb-4" />
              <div className="h-64 bg-gray-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">资产管理</h1>
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-400 mb-4">请先连接钱包并登录以查看资产</p>
          <p className="text-gray-500 text-sm">点击右上角「连接钱包」按钮开始</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">资产管理</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：余额卡片 */}
        <div className="lg:col-span-1 space-y-6">
          <BalanceCard
            onDeposit={() => setIsDepositOpen(true)}
            onWithdraw={() => setIsWithdrawOpen(true)}
          />

          {/* 快速链接 */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-white font-medium mb-4">快速链接</h3>
            <div className="space-y-2">
              <a
                href="https://sepolia.arbiscan.io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors"
              >
                <span>Arbiscan 浏览器</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="https://faucet.quicknode.com/arbitrum/sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors"
              >
                <span>Arbitrum Sepolia 水龙头</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* 右侧：交易历史 */}
        <div className="lg:col-span-2">
          <TransactionHistory />
        </div>
      </div>

      {/* 充值弹窗 */}
      <DepositFlow isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />

      {/* 提现弹窗 */}
      <WithdrawFlow isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} />
    </div>
  )
}
