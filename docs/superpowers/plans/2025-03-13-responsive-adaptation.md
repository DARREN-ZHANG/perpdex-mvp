# PerpDex 全站响应式适配实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 PerpDex 交易平台实现完整的响应式适配，支持从手机到大屏显示器的所有设备尺寸。

**Architecture:** 采用 Tailwind CSS 移动优先的响应式类策略，核心布局在 `lg` 断点（1024px）处从单列切换为双列。移动端使用抽屉组件承载交易面板，表格数据在移动端转为卡片列表展示。

**Tech Stack:** Next.js + React + TypeScript + Tailwind CSS

---

## Chunk 1: 基础配置与工具组件

### Task 1.1: 扩展 Tailwind 配置

**Files:**
- Modify: `apps/web/tailwind.config.ts`

**Context:**
设计文档要求自定义间距值和可能的额外断点。

- [ ] **Step 1: 添加自定义间距**

在 `theme.extend` 中添加自定义间距：

```typescript
spacing: {
  '18': '4.5rem',
  '88': '22rem',
}
```

- [ ] **Step 2: 验证配置**

Run: `cd apps/web && npx tailwindcss --config tailwind.config.ts --content "app/**/*.{tsx,ts}" --content "components/**/*.{tsx,ts}" --output /tmp/test.css`

Expected: 命令成功执行，无报错

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "config: add custom spacing to tailwind"
```

---

### Task 1.2: 创建 Drawer 抽屉组件

**Files:**
- Create: `apps/web/components/ui/drawer.tsx`

**Context:**
抽屉组件用于移动端 Header 导航菜单和交易下单面板。支持从左侧、右侧、底部滑出。

- [ ] **Step 1: 创建 Drawer 组件**

```tsx
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  position?: 'left' | 'right' | 'bottom'
  title?: string
  children: React.ReactNode
}

export function Drawer({
  isOpen,
  onClose,
  position = 'left',
  title,
  children,
}: DrawerProps) {
  // 锁定背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const positionClasses = {
    left: 'top-0 left-0 h-full w-[280px] rounded-r-lg',
    right: 'top-0 right-0 h-full w-[320px] rounded-l-lg',
    bottom: 'bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl',
  }

  const transformClasses = {
    left: isOpen ? 'translate-x-0' : '-translate-x-full',
    right: isOpen ? 'translate-x-0' : 'translate-x-full',
    bottom: isOpen ? 'translate-y-0' : 'translate-y-full',
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* 遮罩 */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div
        className={`absolute bg-white shadow-2xl transition-transform duration-300 ease-out ${positionClasses[position]} ${transformClasses[position]}`}
      >
        {/* 底部抽屉的拖动指示器 */}
        {position === 'bottom' && (
          <div
            className="flex justify-center pt-3 pb-1"
            onClick={onClose}
          >
            <div className="w-12 h-1.5 bg-pro-gray-300 rounded-full" />
          </div>
        )}

        {/* 头部 */}
        {(title || position !== 'bottom') && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-pro-gray-100">
            {title && (
              <h2 className="text-lg font-semibold text-pro-gray-800">{title}</h2>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-pro-gray-100 transition-colors ml-auto"
            >
              <X className="w-5 h-5 text-pro-gray-500" />
            </button>
          </div>
        )}

        {/* 内容 */}
        <div className="overflow-auto h-[calc(100%-60px)]">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/ui/drawer.tsx
git commit -m "feat: add Drawer component for mobile navigation"
```

---

### Task 1.3: 创建浮动按钮 FAB 组件

**Files:**
- Create: `apps/web/components/ui/fab.tsx`

**Context:**
浮动操作按钮用于移动端交易页，固定在右下角，点击打开下单抽屉。

- [ ] **Step 1: 创建 FAB 组件**

```tsx
'use client'

import { Plus } from 'lucide-react'

interface FabProps {
  onClick: () => void
  icon?: React.ReactNode
  label?: string
  className?: string
}

export function FloatingActionButton({
  onClick,
  icon = <Plus className="w-6 h-6" />,
  label,
  className = '',
}: FabProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed right-4 bottom-4 z-40 flex items-center justify-center gap-2
        w-14 h-14 rounded-full bg-pro-gray-900 text-white
        shadow-[0_4px_12px_rgba(0,0,0,0.3)]
        hover:bg-pro-gray-800 active:scale-95
        transition-all duration-200
        lg:hidden ${className}`}
      aria-label={label || 'Open'}
    >
      {icon}
      {label && <span className="text-sm font-medium pr-2">{label}</span>}
    </button>
  )
}
```

注意：`lg:hidden` 表示在桌面端隐藏此按钮。

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/ui/fab.tsx
git commit -m "feat: add FloatingActionButton component"
```

---

## Chunk 2: Header 移动端适配

### Task 2.1: 重构 Header 组件

**Files:**
- Modify: `apps/web/components/layout/header.tsx`
- Create: `apps/web/components/layout/mobile-nav.tsx` (可选，如果 Header 变得过大)

**Context:**
当前 Header 是固定桌面布局，需要添加移动端汉堡菜单和抽屉导航。

- [ ] **Step 1: 更新 Header 组件**

```tsx
'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { ConnectButton as WalletButton } from '../wallet/connect-button'
import { Drawer } from '../ui/drawer'

const navItems = [
  { label: '交易', href: '/' },
  { label: '资产', href: '/assets' },
  { label: '历史', href: '/history' },
]

export function Header() {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="h-16 bg-pro-gray-900 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-4 lg:gap-10">
          <Link href="/" className="text-white font-bold text-xl lg:text-2xl tracking-tight">
            PerpDex
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-pro-accent-cyan bg-pro-accent-cyan/10'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 lg:gap-4">
          <WalletButton />

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="打开菜单"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <Drawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        position="left"
        title="菜单"
      >
        <nav className="flex flex-col py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 text-base font-medium transition-colors border-b border-pro-gray-50 ${
                pathname === item.href
                  ? 'text-pro-accent-cyan bg-pro-accent-cyan/5'
                  : 'text-pro-gray-700 hover:bg-pro-gray-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Drawer>
    </>
  )
}
```

- [ ] **Step 2: 在移动端测试 Header**

缩小浏览器窗口至 < 768px，验证：
- 汉堡菜单按钮显示
- 点击后抽屉从左侧滑出
- 导航链接正常工作
- 点击链接后抽屉关闭

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/header.tsx
git commit -m "feat: add mobile navigation drawer to header"
```

---

## Chunk 3: 交易页响应式适配

### Task 3.1: 创建移动端交易抽屉

**Files:**
- Create: `apps/web/components/trading/mobile-trade-drawer.tsx`

**Context:**
移动端需要一个组合抽屉，包含下单表单和持仓面板的 Tab 切换。

- [ ] **Step 1: 创建 MobileTradeDrawer 组件**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/trading/mobile-trade-drawer.tsx
git commit -m "feat: add mobile trade drawer with order/position tabs"
```

---

### Task 3.2: 重构交易页布局

**Files:**
- Modify: `apps/web/app/page.tsx`

**Context:**
交易页需要从固定两列布局改为响应式布局，移动端使用浮动按钮+抽屉模式。

- [ ] **Step 1: 更新交易页**

```tsx
'use client'

import { useState } from 'react'
import { MarketStats } from '@/components/trading/market-stats'
import { PriceChart } from '@/components/trading/price-chart'
import { OrderForm } from '@/components/trading/order-form'
import { PositionPanel } from '@/components/trading/position-panel'
import { RecentTrades } from '@/components/trading/recent-trades'
import { MobileTradeDrawer } from '@/components/trading/mobile-trade-drawer'
import { FloatingActionButton } from '@/components/ui/fab'
import { useBinancePrice } from '@/hooks/use-binance-price'
import { DEFAULT_BINANCE_SYMBOL } from '@/lib/binance-market'

export default function TradingPage() {
  const { data: priceData, isLoading, error } = useBinancePrice(DEFAULT_BINANCE_SYMBOL)
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false)

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[1fr_360px] h-[calc(100vh-64px)]">
      {/* Left main area */}
      <div className="flex flex-col gap-3 p-3 lg:p-4 overflow-auto">
        {/* Market stats */}
        <div className="bg-white rounded-lg shadow-panel overflow-hidden">
          <MarketStats
            priceData={priceData}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Chart area */}
        <div className="bg-white rounded-lg shadow-panel flex-1 min-h-[300px] lg:min-h-[380px] overflow-hidden">
          <PriceChart priceData={priceData} />
        </div>

        {/* Recent trades panel - 桌面端显示 */}
        <div className="hidden lg:block bg-white rounded-lg shadow-panel h-[280px] overflow-hidden">
          <RecentTrades />
        </div>
      </div>

      {/* Right trading panel - 桌面端显示 */}
      <div className="hidden lg:flex bg-white border-l border-pro-gray-200 flex-col overflow-auto">
        {/* Order form */}
        <OrderForm />

        {/* Position panel */}
        <PositionPanel />
      </div>

      {/* 移动端：最近成交（简化版） */}
      <div className="lg:hidden bg-white rounded-lg shadow-panel mx-3 mb-3 overflow-hidden">
        <RecentTrades />
      </div>

      {/* 移动端：浮动开仓按钮 */}
      <FloatingActionButton
        onClick={() => setIsTradeDrawerOpen(true)}
        label="开仓"
      />

      {/* 移动端：交易抽屉 */}
      <MobileTradeDrawer
        isOpen={isTradeDrawerOpen}
        onClose={() => setIsTradeDrawerOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: 测试响应式布局**

在不同宽度下验证：
- < 1024px: 单列布局，显示浮动按钮
- ≥ 1024px: 双列布局，隐藏浮动按钮

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/trading/mobile-trade-drawer.tsx
git commit -m "feat: make trading page responsive with mobile drawer"
```

---

### Task 3.3: 市场统计组件响应式

**Files:**
- Modify: `apps/web/components/trading/market-stats.tsx`

**Context:**
市场统计在移动端需要简化显示，只展示核心数据。

- [ ] **Step 1: 更新 MarketStats 组件**

```tsx
'use client'

import type { BinancePriceData } from '@/lib/binance-market'

interface StatItemProps {
  label: string
  value: string
  change?: string
  isPercentage?: boolean
  className?: string
}

function StatItem({ label, value, change, isPercentage, className = '' }: StatItemProps) {
  const changeNum = change ? parseFloat(change) : undefined
  return (
    <div className={`flex flex-col items-center py-2 lg:py-3 ${className}`}>
      <div className="text-xs text-pro-gray-500 uppercase tracking-wider mb-0.5 lg:mb-1">
        {label}
      </div>
      <div className={`text-sm lg:text-base font-semibold font-mono ${changeNum !== undefined ? (changeNum >= 0 ? 'text-pro-accent-green' : 'text-pro-accent-red') : 'text-pro-gray-800'}`}>
        {isPercentage && changeNum !== undefined ? `${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(2)}%` : value}
      </div>
    </div>
  )
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toFixed(2)
}

export interface MarketStatsProps {
  priceData: BinancePriceData | null
  isLoading?: boolean
  error?: string | null
}

export function MarketStats({ priceData, isLoading = false, error = null }: MarketStatsProps) {
  if (isLoading && !priceData) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-px bg-pro-gray-100">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white py-2 lg:py-3">
            <div className="h-3 lg:h-4 w-14 lg:w-16 bg-gray-200 rounded mx-auto animate-pulse mb-0.5 lg:mb-1" />
            <div className="h-4 lg:h-5 w-16 lg:w-20 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
        ))}
        {/* 桌面端额外的骨架屏 */}
        {[...Array(2)].map((_, i) => (
          <div key={`extra-${i}`} className="hidden lg:block bg-white py-3">
            <div className="h-4 w-16 bg-gray-200 rounded mx-auto animate-pulse mb-1" />
            <div className="h-5 w-20 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!priceData) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-px bg-pro-gray-100">
        {['最新价格', '24h 涨跌', '24h 成交量'].map((label) => (
          <StatItem key={label} label={label} value="--" />
        ))}
        {/* 桌面端额外项 */}
        <StatItem className="hidden lg:flex" label="24h 最高" value="--" />
        <StatItem className="hidden lg:flex" label="24h 最低" value="--" />
        {error && (
          <div className="col-span-3 lg:col-span-5 bg-white px-4 py-2 text-center text-xs text-pro-accent-red">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 lg:grid-cols-5 gap-px bg-pro-gray-100">
      <StatItem
        label="最新价格"
        value={priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 涨跌"
        value=""
        change={priceData.changePercent24h.toString()}
        isPercentage
      />
      {/* 移动端显示成交量，桌面端显示最高 */}
      <StatItem
        className="lg:hidden"
        label="24h 成交量"
        value={formatVolume(priceData.volume24h)}
      />
      <StatItem
        className="hidden lg:flex"
        label="24h 最高"
        value={priceData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      {/* 桌面端额外项 */}
      <StatItem
        className="hidden lg:flex"
        label="24h 最低"
        value={priceData.low24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        className="hidden lg:flex"
        label="24h 成交量"
        value={formatVolume(priceData.volume24h)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/trading/market-stats.tsx
git commit -m "feat: make market stats responsive"
```

---

### Task 3.4: 价格图表响应式

**Files:**
- Modify: `apps/web/components/trading/price-chart.tsx`

**Context:**
价格图表需要适配移动端，左上角的浮动价格卡片需要调整位置和大小。

- [ ] **Step 1: 更新 PriceChart 组件**

修改左上角的浮动价格卡片：

```tsx
// 在 PriceChart 组件内，替换浮动价格卡片的样式

{priceData && priceData.price > 0 && (
  <div className="absolute top-2 left-2 lg:top-4 lg:left-4 z-10 bg-white/95 rounded-lg shadow-float p-2 lg:p-3">
    <div className="text-xs lg:text-sm text-pro-gray-500 mb-0.5 lg:mb-1">BTC / USDT</div>
    <div className="text-xl lg:text-2xl font-bold font-mono text-pro-gray-800">
      {priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
    </div>
    <div
      className={`text-xs lg:text-sm font-medium mt-0.5 lg:mt-1 ${
        isPositive ? 'text-pro-accent-green' : 'text-pro-accent-red'
      }`}
    >
      {isPositive ? '+' : ''}
      {changePercent24h.toFixed(2)}%
    </div>
  </div>
)}
```

同时更新时间周期选择按钮：

```tsx
<div className="flex items-center gap-2 lg:gap-4 px-3 lg:px-4 py-2 border-b border-pro-gray-100 overflow-x-auto">
  {TIMEFRAMES.map((tf) => (
    <button
      key={tf.value}
      onClick={() => setTimeframe(tf.value)}
      className={`text-xs lg:text-sm transition-colors whitespace-nowrap ${
        timeframe === tf.value
          ? 'text-pro-accent-cyan font-medium'
          : 'text-pro-gray-500 hover:text-pro-gray-700'
      }`}
    >
      {tf.label}
    </button>
  ))}
  <span className="ml-auto text-pro-accent-cyan font-medium text-xs lg:text-sm whitespace-nowrap">
    BTC/USDT
  </span>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/trading/price-chart.tsx
git commit -m "feat: make price chart responsive"
```

---

### Task 3.5: 最近成交组件响应式

**Files:**
- Modify: `apps/web/components/trading/recent-trades.tsx`

**Context:**
最近成交表格在移动端需要横向滚动，同时调整高度。

- [ ] **Step 1: 更新 RecentTrades 组件**

修改容器高度和表格布局：

```tsx
// 修改容器高度
<div className="h-[240px] lg:h-[280px] flex flex-col">

// 修改表头网格（订单记录 Tab）
<div className="grid grid-cols-[80px_80px_1fr_90px_70px] lg:grid-cols-[96px_92px_1fr_110px_90px] items-center gap-2 px-3 lg:px-4 py-2 text-xs text-pro-gray-500 uppercase tracking-wider border-b border-pro-gray-100">

// 修改订单行网格
<div
  key={order.id}
  className="grid grid-cols-[80px_80px_1fr_90px_70px] lg:grid-cols-[96px_92px_1fr_110px_90px] items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 text-sm border-b border-pro-gray-50 hover:bg-pro-gray-50 transition-colors"
>

// 修改资金流水表头
<div className="grid grid-cols-[80px_1fr_1fr_70px] lg:grid-cols-[100px_1fr_1fr_80px] items-center gap-2 px-3 lg:px-4 py-2 text-xs text-pro-gray-500 uppercase tracking-wider border-b border-pro-gray-100">

// 修改资金流水行
<div
  key={tx.id}
  className="grid grid-cols-[80px_1fr_1fr_70px] lg:grid-cols-[100px_1fr_1fr_80px] items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 text-sm border-b border-pro-gray-50 hover:bg-pro-gray-50 transition-colors"
>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/trading/recent-trades.tsx
git commit -m "feat: make recent trades responsive"
```

---

## Chunk 4: 资产页响应式适配

### Task 4.1: 统计卡片响应式

**Files:**
- Modify: `apps/web/components/asset/balance-card.tsx`

**Context:**
资产页的统计卡片需要从 4 列布局改为响应式网格。

- [ ] **Step 1: 更新 BalanceSummary 组件**

查看现有组件，添加响应式类：

```tsx
// 假设统计卡片容器使用 grid，修改为：
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
  {/* 4 张统计卡片 */}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/asset/balance-card.tsx
git commit -m "feat: make balance summary cards responsive"
```

---

### Task 4.2: 资产表格响应式

**Files:**
- Modify: `apps/web/app/assets/page.tsx`

**Context:**
资产表格在移动端需要改为卡片列表展示。

- [ ] **Step 1: 创建移动端资产卡片组件**

在 `apps/web/app/assets/page.tsx` 中添加移动端卡片视图：

```tsx
// 在 AssetsPage 组件内，表格下方添加移动端卡片视图

{/* Desktop: Table View */}
<div className="hidden md:block overflow-x-auto">
  <table className="w-full">
    {/* 现有表格内容 */}
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/assets/page.tsx
git commit -m "feat: add mobile card view for assets page"
```

---

### Task 4.3: 页面容器响应式

**Files:**
- Modify: `apps/web/app/assets/page.tsx`

**Context:**
调整页面容器的内边距和最大宽度。

- [ ] **Step 1: 更新页面容器**

```tsx
// 修改页面容器
<div className="p-4 lg:p-6 max-w-7xl mx-auto">

// 修改页面标题区域
<div className="mb-4 lg:mb-6">
  <h1 className="text-xl lg:text-2xl font-bold text-pro-gray-800 mb-1 lg:mb-2">资产概览</h1>
  <p className="text-sm text-pro-gray-500">
    查看您的账户余额和资金状况
  </p>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/assets/page.tsx
git commit -m "feat: make assets page container responsive"
```

---

## Chunk 5: 历史页响应式适配

### Task 5.1: 过滤器栏响应式

**Files:**
- Modify: `apps/web/app/history/page.tsx`

**Context:**
历史页的过滤器栏在移动端需要堆叠显示。

- [ ] **Step 1: 更新过滤器栏布局**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/history/page.tsx
git commit -m "feat: make history filter bar responsive"
```

---

### Task 5.2: 历史记录表格响应式

**Files:**
- Modify: `apps/web/app/history/page.tsx`

**Context:**
历史记录在移动端需要改为卡片列表。

- [ ] **Step 1: 创建移动端历史记录卡片**

```tsx
{/* Desktop: Table View */}
<div className="hidden lg:block overflow-x-auto">
  <table className="w-full">
    {/* 现有表格内容 */}
  </table>
</div>

{/* Mobile: Card View */}
<div className="lg:hidden space-y-3">
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
        {/* 头部：类型和时间 */}
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/history/page.tsx
git commit -m "feat: add mobile card view for history page"
```

---

## Chunk 6: 充值页响应式适配

### Task 6.1: 充值页响应式

**Files:**
- Modify: `apps/web/app/deposit/page.tsx`

**Context:**
充值页主要是表单布局，需要调整快速金额按钮和间距。

- [ ] **Step 1: 更新充值页布局**

```tsx
// 修改页面容器
<div className="p-4 lg:p-6 max-w-2xl mx-auto">

// 修改页面标题
<div className="mb-4 lg:mb-6">
  <div className="flex items-center gap-2 mb-2">
    <Link
      href="/assets"
      className="text-pro-gray-400 hover:text-pro-gray-600 transition-colors text-sm"
    >
      ← 返回资产
    </Link>
  </div>
  <h1 className="text-xl lg:text-2xl font-bold text-pro-gray-800">充值 USDC</h1>
  <p className="text-sm text-pro-gray-500 mt-1">
    将 USDC 充值到 Vault 合约以开始交易
  </p>
</div>

// 修改主卡片
<div className="bg-white rounded-lg shadow-panel p-4 lg:p-6">

// 修改快速金额按钮（移动端 2x2 网格）
<div className="grid grid-cols-2 sm:flex gap-2 mt-3">
  {quickAmounts.map((amt) => (
    <button
      key={amt}
      onClick={() => setAmount(amt)}
      disabled={isLoading}
      className="px-3 py-2 text-sm border border-pro-gray-200 rounded-md hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {amt} USDC
    </button>
  ))}
  <button
    onClick={() => setAmount(usdcBalance)}
    disabled={isLoading}
    className="px-3 py-2 text-sm border border-pro-gray-200 rounded-md hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed col-span-2 sm:col-span-1"
  >
    全部
  </button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/deposit/page.tsx
git commit -m "feat: make deposit page responsive"
```

---

## Chunk 7: 最终验证与清理

### Task 7.1: 构建验证

**Files:**
- All modified files

- [ ] **Step 1: 运行构建**

Run: `cd apps/web && npm run build`

Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 2: 运行 lint**

Run: `cd apps/web && npm run lint`

Expected: 无 lint 错误

- [ ] **Step 3: Commit（如有修复）**

```bash
git add .
git commit -m "fix: resolve build and lint issues"
```

---

### Task 7.2: 响应式测试清单

- [ ] **手机 (375px)**
  - [ ] Header 汉堡菜单正常展开/收起
  - [ ] 交易页浮动按钮显示/点击
  - [ ] 下单抽屉滑动关闭
  - [ ] 资产页卡片布局正常
  - [ ] 历史页时间线显示正确

- [ ] **平板 (768px)**
  - [ ] 横竖屏切换布局正确
  - [ ] 交易页抽屉/侧边栏切换

- [ ] **桌面 (1024px+)**
  - [ ] 两列布局显示正常
  - [ ] 大屏拉伸无异常

---

## 附录

### 文件变更清单

**新增文件：**
- `apps/web/components/ui/drawer.tsx`
- `apps/web/components/ui/fab.tsx`
- `apps/web/components/trading/mobile-trade-drawer.tsx`

**修改文件：**
- `apps/web/tailwind.config.ts`
- `apps/web/components/layout/header.tsx`
- `apps/web/app/page.tsx`
- `apps/web/components/trading/market-stats.tsx`
- `apps/web/components/trading/price-chart.tsx`
- `apps/web/components/trading/recent-trades.tsx`
- `apps/web/components/asset/balance-card.tsx`
- `apps/web/app/assets/page.tsx`
- `apps/web/app/history/page.tsx`
- `apps/web/app/deposit/page.tsx`

### 参考文档
- 设计文档：`docs/superpowers/specs/2025-03-13-responsive-design.md`
