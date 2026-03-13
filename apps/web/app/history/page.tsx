'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { useTransactions } from '@/hooks/use-transactions'
import type { Transaction, TransactionType } from '@/types/api'

const USDC_DECIMALS = 6

// 将原始值转换为可读的 USDC 金额
function formatUSDC(value: string | undefined): string {
  if (!value) return '0'
  return formatUnits(BigInt(value), USDC_DECIMALS)
}

const TYPE_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '充值', value: 'DEPOSIT' },
  { label: '提现', value: 'WITHDRAW' },
  { label: '保证金锁定', value: 'MARGIN_LOCK' },
  { label: '保证金释放', value: 'MARGIN_RELEASE' },
  { label: '已实现盈亏', value: 'REALIZED_PNL' },
  { label: '手续费', value: 'FEE' },
  { label: '清算', value: 'LIQUIDATION' },
]

const STATUS_OPTIONS = [
  { label: '所有状态', value: 'all' },
  { label: '已确认', value: 'CONFIRMED' },
  { label: '处理中', value: 'PENDING' },
  { label: '失败', value: 'FAILED' },
  { label: '已回滚', value: 'REVERTED' },
]

export default function HistoryPage() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-03-12')

  const typeParam = typeFilter === 'all' ? undefined : (typeFilter as TransactionType)

  const {
    transactions,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions({
    type: typeParam,
    limit: 20,
  })

  // 客户端状态过滤
  const filteredTransactions = transactions.filter((tx: Transaction) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) {
      return false
    }
    return true
  })

  const getTypeClass = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'bg-pro-accent-green/10 text-pro-accent-green'
      case 'WITHDRAW':
        return 'bg-pro-accent-red/10 text-pro-accent-red'
      case 'MARGIN_LOCK':
        return 'bg-pro-accent-cyan/10 text-pro-accent-cyan'
      case 'MARGIN_RELEASE':
        return 'bg-blue-100 text-blue-600'
      case 'REALIZED_PNL':
        return 'bg-purple-100 text-purple-600'
      case 'FEE':
        return 'bg-orange-100 text-orange-600'
      case 'LIQUIDATION':
        return 'bg-amber-100 text-amber-600'
      default:
        return 'bg-pro-gray-100 text-pro-gray-500'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return '充值'
      case 'WITHDRAW':
        return '提现'
      case 'MARGIN_LOCK':
        return '保证金锁定'
      case 'MARGIN_RELEASE':
        return '保证金释放'
      case 'REALIZED_PNL':
        return '已实现盈亏'
      case 'FEE':
        return '手续费'
      case 'LIQUIDATION':
        return '清算'
      default:
        return type
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-pro-accent-green/10 text-pro-accent-green'
      case 'PENDING':
        return 'bg-pro-accent-cyan/10 text-pro-accent-cyan'
      case 'FAILED':
        return 'bg-pro-accent-red/10 text-pro-accent-red'
      case 'REVERTED':
        return 'bg-amber-100 text-amber-600'
      default:
        return 'bg-pro-gray-100 text-pro-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return '已确认'
      case 'PENDING':
        return '处理中'
      case 'FAILED':
        return '失败'
      case 'REVERTED':
        return '已回滚'
      default:
        return status
    }
  }

  const exportCSV = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) return

    const headers = ['时间', '类型', '金额', '状态', '交易哈希', '确认时间']
    const rows = filteredTransactions.map((tx: Transaction) => [
      new Date(tx.createdAt).toISOString(),
      getTypeLabel(tx.type),
      tx.amount,
      getStatusLabel(tx.status),
      tx.txHash || '—',
      tx.confirmedAt ? new Date(tx.confirmedAt).toISOString() : '—',
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `perpdex-history-${startDate}-${endDate}.csv`
    link.click()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-pro-gray-800 mb-2">历史记录</h1>
        <p className="text-sm text-pro-gray-500">
          查看您的所有交易、充值、提现记录
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow-panel p-3 lg:p-4 mb-4 flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3 lg:gap-4">
        {/* Type Filters - 移动端横向滚动 */}
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0">
          {TYPE_FILTERS.slice(0, 5).map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              className={`flex-shrink-0 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                typeFilter === filter.value
                  ? 'bg-pro-gray-900 text-white'
                  : 'border border-pro-gray-200 text-pro-gray-600 hover:border-pro-gray-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Status Select */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-600 focus:outline-none focus:border-pro-accent-cyan"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-600 focus:outline-none focus:border-pro-accent-cyan"
          />
          <span className="text-pro-gray-400">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-600 focus:outline-none focus:border-pro-accent-cyan"
          />
        </div>

        <div className="flex-1" />

        {/* Export */}
        <button
          onClick={exportCSV}
          className="px-4 py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-600 hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors whitespace-nowrap"
        >
          导出 CSV
        </button>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg shadow-panel overflow-hidden">
        {/* Desktop: Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-pro-gray-50 text-xs text-pro-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">时间</th>
                <th className="px-4 py-3 text-left font-semibold">类型</th>
                <th className="px-4 py-3 text-right font-semibold">金额 (USDC)</th>
                <th className="px-4 py-3 text-center font-semibold">状态</th>
                <th className="px-4 py-3 text-left font-semibold">交易哈希</th>
                <th className="px-4 py-3 text-left font-semibold">确认时间</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-pro-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-pro-accent-red">
                    加载失败，请稍后重试
                  </td>
                </tr>
              ) : !filteredTransactions || filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-pro-gray-400">
                    暂无记录
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx: Transaction) => (
                  <tr
                    key={tx.id}
                    className="border-b border-pro-gray-50 hover:bg-pro-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="text-sm text-pro-gray-800">
                        {new Date(tx.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                      <div className="text-xs text-pro-gray-500 font-mono">
                        {new Date(tx.createdAt).toLocaleTimeString('zh-CN')}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded font-medium ${getTypeClass(
                          tx.type
                        )}`}
                      >
                        {getTypeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-medium">
                      {formatUSDC(tx.amount)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${getStatusClass(
                          tx.status
                        )}`}
                      >
                        {getStatusLabel(tx.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {tx.txHash ? (
                        <a
                          href={`https://arbiscan.io/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-pro-accent-cyan hover:underline"
                        >
                          {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                        </a>
                      ) : (
                        <span className="text-pro-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-pro-gray-600">
                      {tx.confirmedAt ? (
                        <div>
                          <div>{new Date(tx.confirmedAt).toLocaleDateString('zh-CN')}</div>
                          <div className="text-xs text-pro-gray-500 font-mono">
                            {new Date(tx.confirmedAt).toLocaleTimeString('zh-CN')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-pro-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: Card View */}
        <div className="lg:hidden space-y-3 p-3">
          {isLoading ? (
            <div className="text-center py-8 text-pro-gray-400">加载中...</div>
          ) : error ? (
            <div className="text-center py-8 text-pro-accent-red">加载失败，请稍后重试</div>
          ) : !filteredTransactions || filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-pro-gray-400">暂无记录</div>
          ) : (
            filteredTransactions.map((tx: Transaction) => (
              <div
                key={tx.id}
                className="bg-white rounded-lg shadow-panel p-4"
              >
                {/* 头部：类型和状态 */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded font-medium ${getTypeClass(tx.type)}`}>
                    {getTypeLabel(tx.type)}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${getStatusClass(tx.status)}`}>
                    {getStatusLabel(tx.status)}
                  </span>
                </div>

                {/* 时间和金额 */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm text-pro-gray-800">
                      {new Date(tx.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                    <div className="text-xs text-pro-gray-500 font-mono">
                      {new Date(tx.createdAt).toLocaleTimeString('zh-CN')}
                    </div>
                  </div>
                  <div className="font-mono font-medium text-lg">
                    {formatUSDC(tx.amount)}
                  </div>
                </div>

                {/* 交易哈希 */}
                {tx.txHash && (
                  <div className="pt-2 border-t border-pro-gray-100">
                    <a
                      href={`https://arbiscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-pro-accent-cyan hover:underline"
                    >
                      {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Load More */}
        <div className="px-6 py-4 border-t border-pro-gray-100 flex justify-center items-center">
          {hasNextPage ? (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-6 py-2 bg-pro-gray-900 text-white rounded-md text-sm font-medium hover:bg-pro-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isFetchingNextPage ? '加载中...' : '加载更多'}
            </button>
          ) : (
            <span className="text-sm text-pro-gray-400">
              {filteredTransactions.length > 0 ? '已加载全部记录' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
