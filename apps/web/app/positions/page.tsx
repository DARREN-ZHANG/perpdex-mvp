// apps/web/app/positions/page.tsx
import { PositionTable } from '@/components/position'

export const metadata = {
  title: '我的仓位 | PerpDex',
  description: '管理您的永续合约仓位',
}

export default function PositionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">仓位管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            查看和管理您的永续合约持仓
          </p>
        </div>

        {/* 仓位表格 */}
        <PositionTable />
      </div>
    </div>
  )
}
