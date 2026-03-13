'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { Loader2 } from 'lucide-react'
import { useOrderHistory } from '@/hooks/use-order-history'
import { useTransactions } from '@/hooks/use-transactions'
import type { OrderHistoryItem } from '@/types/api'

const USDC_DECIMALS = 6
const TABS = ['订单记录', '资金流水'] as const
const STATUS_BADGE_CLASS = 'inline-flex h-5 w-fit self-center items-center rounded-full px-2 text-xs leading-none'

function formatUSDC(value: string | undefined): string {
  if (!value) return '0'
  return formatUnits(BigInt(value), USDC_DECIMALS)
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getOrderLabel(order: OrderHistoryItem): string {
  if (order.action === 'CLOSE') {
    return order.side === 'LONG' ? `平空 ${order.symbol}` : `平多 ${order.symbol}`
  }

  return order.side === 'LONG' ? `开多 ${order.symbol}` : `开空 ${order.symbol}`
}

export function RecentTrades() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('订单记录')
  const { orders, isLoading: isOrdersLoading } = useOrderHistory({ limit: 5 })
  const { transactions, isLoading: isTransactionsLoading } = useTransactions({ limit: 20 })

  const fundTransactions = transactions
    .filter((tx) => tx.type === 'DEPOSIT' || tx.type === 'WITHDRAW')
    .slice(0, 5)

  const isOrderTab = activeTab === '订单记录'
  const isLoading = isOrderTab ? isOrdersLoading : isTransactionsLoading

  const getFundTypeClass = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'text-pro-accent-green'
      case 'WITHDRAW':
        return 'text-pro-accent-red'
      default:
        return 'text-pro-gray-500'
    }
  }

  const getFundStatusClass = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-pro-accent-green/10 text-pro-accent-green'
      case 'PENDING':
        return 'bg-pro-accent-cyan/10 text-pro-accent-cyan'
      case 'FAILED':
      case 'REVERTED':
        return 'bg-pro-accent-red/10 text-pro-accent-red'
      default:
        return 'bg-pro-gray-100 text-pro-gray-500'
    }
  }

  const getFundStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return '已确认'
      case 'PENDING':
        return '处理中'
      case 'FAILED':
      case 'REVERTED':
        return '失败'
      default:
        return status
    }
  }

  const getOrderStatusClass = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'bg-pro-accent-green/10 text-pro-accent-green'
      case 'PENDING':
        return 'bg-pro-accent-cyan/10 text-pro-accent-cyan'
      case 'FAILED':
      case 'CANCELED':
        return 'bg-pro-accent-red/10 text-pro-accent-red'
      default:
        return 'bg-pro-gray-100 text-pro-gray-500'
    }
  }

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case 'FILLED':
        return '已成交'
      case 'PENDING':
        return '处理中'
      case 'FAILED':
        return '失败'
      case 'CANCELED':
        return '已取消'
      default:
        return status
    }
  }

  const isEmpty = isOrderTab ? orders.length === 0 : fundTransactions.length === 0

  return (
    <div className="h-[280px] flex flex-col">
      <div className="flex px-4 border-b border-pro-gray-100">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'text-pro-accent-cyan border-pro-accent-cyan'
                : 'text-pro-gray-500 border-transparent hover:text-pro-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isOrderTab ? (
        <div className="grid grid-cols-[96px_92px_1fr_110px_90px] gap-2 px-4 py-2 text-xs text-pro-gray-500 uppercase tracking-wider border-b border-pro-gray-100">
          <span>时间</span>
          <span>方向</span>
          <span>数量 / 价格</span>
          <span>金额</span>
          <span>状态</span>
        </div>
      ) : (
        <div className="grid grid-cols-[100px_1fr_1fr_80px] gap-2 px-4 py-2 text-xs text-pro-gray-500 uppercase tracking-wider border-b border-pro-gray-100">
          <span>时间</span>
          <span>类型</span>
          <span>数量</span>
          <span>状态</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-pro-gray-400" />
          </div>
        ) : isEmpty ? (
          <div className="text-center py-8 text-sm text-pro-gray-500">暂无记录</div>
        ) : isOrderTab ? (
          orders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[96px_92px_1fr_110px_90px] gap-2 px-4 py-3 text-sm border-b border-pro-gray-50 hover:bg-pro-gray-50 transition-colors"
            >
              <span className="text-pro-gray-500 font-mono text-xs">{formatTime(order.createdAt)}</span>
              <span className={`font-medium ${order.side === 'LONG' ? 'text-pro-accent-green' : 'text-pro-accent-red'}`}>
                {getOrderLabel(order)}
              </span>
              <div className="min-w-0">
                <div className="font-mono font-medium truncate">
                  {Number(order.size).toLocaleString('en-US', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })}
                </div>
                <div className="text-xs text-pro-gray-500 truncate">
                  {order.executedPrice
                    ? `成交价 ${Number(order.executedPrice).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : order.failureMessage || '等待成交'}
                </div>
              </div>
              <span className="font-mono font-medium">
                {order.action === 'CLOSE'
                  ? '平仓'
                  : `${parseFloat(formatUSDC(order.margin)).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })} USDC`}
              </span>
              <span className={`${STATUS_BADGE_CLASS} ${getOrderStatusClass(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>
            </div>
          ))
        ) : (
          fundTransactions.map((tx) => (
            <div
              key={tx.id}
              className="grid grid-cols-[100px_1fr_1fr_80px] gap-2 px-4 py-3 text-sm border-b border-pro-gray-50 hover:bg-pro-gray-50 transition-colors"
            >
              <span className="text-pro-gray-500 font-mono text-xs">{formatTime(tx.createdAt)}</span>
              <span className={`font-medium ${getFundTypeClass(tx.type)}`}>
                {tx.type === 'DEPOSIT' ? '充值' : '提现'}
              </span>
              <span className="font-mono font-medium">
                {parseFloat(formatUSDC(tx.amount)).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}{' '}
                USDC
              </span>
              <span className={`${STATUS_BADGE_CLASS} ${getFundStatusClass(tx.status)}`}>
                {getFundStatusLabel(tx.status)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
