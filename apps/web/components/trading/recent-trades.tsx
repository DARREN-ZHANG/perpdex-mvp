'use client'

import { useState } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { Loader2 } from 'lucide-react'

const TABS = ['最近交易', '委托订单', '资金流水']

export function RecentTrades() {
  const [activeTab, setActiveTab] = useState(0)
  const { transactions, isLoading } = useTransactions({ limit: 5 })

  const getTypeClass = (type: string) => {
    switch (type) {
      case 'trade':
        return 'text-pro-accent-cyan'
      case 'deposit':
        return 'text-pro-accent-green'
      case 'withdraw':
        return 'text-pro-accent-red'
      default:
        return 'text-pro-gray-500'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'trade':
        return '交易'
      case 'deposit':
        return '充值'
      case 'withdraw':
        return '提现'
      default:
        return type
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'filled':
      case 'completed':
        return 'bg-pro-accent-green/10 text-pro-accent-green'
      case 'pending':
        return 'bg-pro-accent-cyan/10 text-pro-accent-cyan'
      case 'failed':
        return 'bg-pro-accent-red/10 text-pro-accent-red'
      default:
        return 'bg-pro-gray-100 text-pro-gray-500'
    }
  }

  return (
    <div className="h-[280px] flex flex-col">
      {/* Tabs */}
      <div className="flex px-4 border-b border-pro-gray-100">
        {TABS.map((tab, index) => (
          <button
            key={tab}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === index
                ? 'text-pro-accent-cyan border-pro-accent-cyan'
                : 'text-pro-gray-500 border-transparent hover:text-pro-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="grid grid-cols-[100px_80px_1fr_1fr_80px] gap-2 px-4 py-2 text-xs text-pro-gray-500 uppercase tracking-wider border-b border-pro-gray-100">
        <span>时间</span>
        <span>类型</span>
        <span>数量</span>
        <span>交易对</span>
        <span>状态</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-pro-gray-400" />
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="text-center py-8 text-sm text-pro-gray-500">
            暂无记录
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="grid grid-cols-[100px_80px_1fr_1fr_80px] gap-2 px-4 py-3 text-sm border-b border-pro-gray-50 hover:bg-pro-gray-50 transition-colors"
            >
              <span className="text-pro-gray-500 font-mono text-xs">
                {new Date(tx.createdAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className={`font-medium ${getTypeClass(tx.type)}`}>
                {getTypeLabel(tx.type)}
              </span>
              <span className="font-mono font-medium">
                {tx.amount} {tx.symbol}
              </span>
              <span className="text-pro-gray-500">
                {tx.pair || '—'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${getStatusClass(tx.status)}`}>
                {tx.status === 'filled' ? '已成交' : tx.status === 'completed' ? '已完成' : tx.status === 'pending' ? '处理中' : '失败'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
