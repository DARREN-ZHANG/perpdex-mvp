// apps/web/components/asset/transaction-history.tsx
'use client'

import { useTransactions } from '@/hooks/use-transactions'
import { formatUSDC } from '@/lib/contracts'
import type { Transaction, TransactionType, TransactionStatus } from '@/types/api'

interface TransactionHistoryProps {
  type?: TransactionType
}

const TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: '充值',
  WITHDRAW: '提现',
  MARGIN_LOCK: '保证金锁定',
  MARGIN_RELEASE: '保证金释放',
  REALIZED_PNL: '已实现盈亏',
  FEE: '手续费',
  LIQUIDATION: '清算',
}

const STATUS_LABELS: Record<TransactionStatus, { text: string; color: string }> = {
  PENDING: { text: '处理中', color: 'text-yellow-400' },
  CONFIRMED: { text: '已完成', color: 'text-green-400' },
  FAILED: { text: '失败', color: 'text-red-400' },
  REVERTED: { text: '已撤销', color: 'text-gray-400' },
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isPositive = ['DEPOSIT', 'MARGIN_RELEASE', 'REALIZED_PNL'].includes(transaction.type)
  const status = STATUS_LABELS[transaction.status]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-4">
        {/* 类型图标 */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            transaction.type === 'DEPOSIT'
              ? 'bg-green-500/20'
              : transaction.type === 'WITHDRAW'
              ? 'bg-red-500/20'
              : 'bg-gray-700'
          }`}
        >
          <span
            className={`text-lg ${
              transaction.type === 'DEPOSIT'
                ? 'text-green-400'
                : transaction.type === 'WITHDRAW'
                ? 'text-red-400'
                : 'text-gray-400'
            }`}
          >
            {transaction.type === 'DEPOSIT' ? '↓' : transaction.type === 'WITHDRAW' ? '↑' : '•'}
          </span>
        </div>

        {/* 类型和时间 */}
        <div>
          <p className="text-white font-medium">{TYPE_LABELS[transaction.type]}</p>
          <p className="text-gray-500 text-sm">{formatDate(transaction.createdAt)}</p>
        </div>
      </div>

      {/* 金额和状态 */}
      <div className="text-right">
        <p className={`font-medium ${isPositive ? 'text-green-400' : 'text-white'}`}>
          {isPositive ? '+' : '-'}
          {formatUSDC(BigInt(transaction.amount))} USDC
        </p>
        <p className={`text-sm ${status.color}`}>{status.text}</p>
      </div>
    </div>
  )
}

export function TransactionHistory({ type }: TransactionHistoryProps) {
  const {
    transactions,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactions({ type, limit: 20 })

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">交易记录</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-800 rounded-lg animate-pulse" />
              <div className="flex-1">
                <div className="w-24 h-4 bg-gray-800 rounded animate-pulse mb-2" />
                <div className="w-16 h-3 bg-gray-800 rounded animate-pulse" />
              </div>
              <div className="text-right">
                <div className="w-20 h-4 bg-gray-800 rounded animate-pulse mb-2" />
                <div className="w-12 h-3 bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">交易记录</h2>
        <p className="text-red-400">加载失败: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-4">
        交易记录
        {type && ` - ${TYPE_LABELS[type]}`}
      </h2>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">暂无交易记录</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-800">
            {transactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </div>

          {/* 加载更多 */}
          {hasNextPage && (
            <div className="mt-4 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 text-green-400 hover:text-green-300 disabled:text-gray-500 transition-colors"
              >
                {isFetchingNextPage ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
