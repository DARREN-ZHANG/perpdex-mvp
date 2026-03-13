'use client'

import { useState } from 'react'
import { Drawer } from '@/components/ui/drawer'
import { OrderForm } from './order-form'
import { PositionPanel } from './position-panel'

const TABS = [
  { id: 'order', label: '下单' },
  { id: 'positions', label: '持仓' },
] as const

interface MobileTradeDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileTradeDrawer({ isOpen, onClose }: MobileTradeDrawerProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('order')

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      position="bottom"
      title={TABS.find(t => t.id === activeTab)?.label}
    >
      {/* Tab 切换 */}
      <div className="flex border-b border-pro-gray-100">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-pro-accent-cyan'
                : 'text-pro-gray-500 hover:text-pro-gray-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pro-accent-cyan" />
            )}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="overflow-auto">
        {activeTab === 'order' ? (
          <div className="p-4">
            <OrderForm />
          </div>
        ) : (
          <PositionPanel />
        )}
      </div>
    </Drawer>
  )
}
