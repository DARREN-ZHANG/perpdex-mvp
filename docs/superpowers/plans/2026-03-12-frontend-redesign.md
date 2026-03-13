# PerpDex MVP 前端重写实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按照设计规范重写 PerpDex MVP 前端，实现极简终端风 (Pro Light) 设计系统，包含交易页、资产页、历史记录页。

**Architecture:**
- 使用 Tailwind CSS 自定义配色系统，替代现有的深色主题
- 采用终端式左右分栏布局重构交易页
- 组件按功能域组织（trading/asset/history/layout），保持单一职责
- 复用现有的 hooks 和 API 层，仅重构 UI 层

**Tech Stack:** Next.js 15 + React 19 + Tailwind CSS + shadcn/ui + Reown AppKit + TanStack Query

**参考文档:** @docs/superpowers/specs/2026-03-12-frontend-redesign.md

---

## 文件结构概览

```
apps/web/
├── app/
│   ├── layout.tsx              # 修改: 更新全局布局结构
│   ├── globals.css             # 修改: 重写配色系统
│   ├── page.tsx                # 修改: 交易页（终端式左右分栏）
│   ├── assets/page.tsx         # 修改: 资产页（纯列表式）
│   ├── history/page.tsx        # 新建: 历史记录页（表格式）
│   └── positions/page.tsx      # 删除: 移除独立仓位页
├── components/
│   ├── layout/
│   │   ├── header.tsx          # 修改: 新导航结构（移除仓位标签）
│   │   └── sidebar.tsx         # 删除: 不再需要侧边栏
│   ├── trading/
│   │   ├── market-stats.tsx    # 新建: 市场统计栏
│   │   ├── price-chart.tsx     # 修改: 集成 TradingView
│   │   ├── order-form.tsx      # 修改: 新交易表单（多空切换）
│   │   ├── leverage-slider.tsx # 新建: 杠杆滑块组件
│   │   ├── order-summary.tsx   # 新建: 预估订单摘要
│   │   ├── position-panel.tsx  # 新建: 当前仓位面板
│   │   └── recent-trades.tsx   # 新建: 最近交易历史
│   ├── asset/
│   │   ├── balance-card.tsx    # 修改: 资产汇总卡片
│   │   └── asset-table.tsx     # 新建: 资产列表表格
│   └── history/
│       ├── filter-bar.tsx      # 新建: 筛选栏
│       └── history-table.tsx   # 新建: 历史记录表格
├── hooks/
│   └── use-order-estimate.ts   # 新建: 订单预估计算
├── lib/
│   └── utils.ts                # 修改: 添加格式化工具函数
└── types/
    └── index.ts                # 修改: 添加新类型定义
```

---

## Chunk 1: 全局样式与配置

### Task 1: 更新 Tailwind 配置和全局样式

**Files:**
- Create: `apps/web/tailwind.config.ts`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: 创建 Tailwind 配置文件**

```typescript
// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pro Light 配色系统
        "pro-gray": {
          50: "#F8F9FA",   // 珍珠灰 - 主背景
          100: "#F1F5F9",  // 边框/分割线
          200: "#E2E8F0",  // 输入框边框
          300: "#CBD5E1",
          400: "#94A3B8",  // 次要文字
          500: "#64748B",  // 辅助灰
          600: "#475569",
          700: "#334155",
          800: "#1E293B",  // 碳黑色 - 主要文字
          900: "#0F172A",  // 曜石黑 - 品牌主色
        },
        "pro-accent": {
          cyan: "#0EA5E9",     // 科技青
          green: "#059669",    // 森林绿
          red: "#DC2626",      // 砖红色
        },
      },
      fontFamily: {
        mono: ["SF Mono", "Monaco", "monospace"],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
      },
      boxShadow: {
        panel: "0 1px 3px rgba(0,0,0,0.04)",
        float: "0 2px 8px rgba(0,0,0,0.08)",
        hover: "0 4px 12px rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 2: 重写全局 CSS**

```css
/* apps/web/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #F8F9FA;
  --foreground: #1E293B;
  --card: #FFFFFF;
  --card-foreground: #1E293B;
  --border: #E2E8F0;
  --input: #E2E8F0;
  --primary: #0F172A;
  --primary-foreground: #FFFFFF;
  --secondary: #F1F5F9;
  --secondary-foreground: #64748B;
  --muted: #F8F9FA;
  --muted-foreground: #64748B;
  --accent: #0EA5E9;
  --accent-foreground: #FFFFFF;
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
  --success: #059669;
  --success-foreground: #FFFFFF;
  --radius: 0.5rem;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  color: var(--foreground);
  background: var(--background);
}

/* 等宽字体用于数字 */
.font-mono {
  font-family: 'SF Mono', Monaco, monospace;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #CBD5E1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94A3B8;
}

/* 禁用输入框的箭头 */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 3: 安装 tailwindcss-animate**

```bash
cd apps/web && pnpm add -D tailwindcss-animate
```

- [ ] **Step 4: 提交**

```bash
git add tailwind.config.ts app/globals.css package.json
pnpm prettier --write tailwind.config.ts app/globals.css
git commit -m "feat: add Pro Light color system and tailwind config"
```

---

### Task 2: 更新根布局和 Header

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/components/layout/header.tsx`
- Delete: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: 更新 Header 组件**

```typescript
// apps/web/components/layout/header.tsx
'use client'

import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from '../wallet/connect-button'
import { useBalance } from '@/hooks/use-balance'

const navItems = [
  { label: '交易', href: '/' },
  { label: '资产', href: '/assets' },
  { label: '历史', href: '/history' },
]

export function Header() {
  const { isAuthenticated } = useAuth()
  const { balance } = useBalance()
  const pathname = usePathname()

  return (
    <header className="h-16 bg-pro-gray-900 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-10">
        <Link href="/" className="text-white font-bold text-xl tracking-tight">
          PerpDex
        </Link>
        <nav className="flex gap-1">
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

      <div className="flex items-center gap-4">
        {isAuthenticated && balance && (
          <div className="text-sm text-gray-400">
            <span className="text-white font-medium">
              {Number(balance.available).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>{' '}
            USDC
          </div>
        )}
        <WalletButton />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: 更新根布局**

```typescript
// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import { Web3Provider } from "@/config/wagmi";
import { Header } from "@/components/layout/header";
import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "PerpDex - Perpetual DEX",
  description: "Perpetual DEX MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-pro-gray-50 text-pro-gray-800 min-h-screen">
        <Providers>
          <Web3Provider>
            <Header />
            <main className="min-h-[calc(100vh-64px)]">
              {children}
            </main>
          </Web3Provider>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 删除 Sidebar 组件**

```bash
rm apps/web/components/layout/sidebar.tsx
```

- [ ] **Step 4: 提交**

```bash
git add components/layout/header.tsx app/layout.tsx
git rm components/layout/sidebar.tsx 2>/dev/null || true
git commit -m "feat: update header with new nav structure, remove sidebar"
```

---

## Chunk 2: 交易页面组件

### Task 3: 创建市场统计栏组件

**Files:**
- Create: `apps/web/components/trading/market-stats.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/trading/market-stats.tsx
'use client'

import { useMarket } from '@/hooks/use-market'

interface StatItemProps {
  label: string
  value: string
  change?: number
  isPercentage?: boolean
}

function StatItem({ label, value, change, isPercentage }: StatItemProps) {
  return (
    <div className="flex flex-col items-center py-3">
      <div className="text-xs text-pro-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold font-mono ${change !== undefined ? (change >= 0 ? 'text-pro-accent-green' : 'text-pro-accent-red') : 'text-pro-gray-800'}`}>
        {isPercentage && change !== undefined ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : value}
      </div>
    </div>
  )
}

export function MarketStats() {
  const { marketData } = useMarket('BTC')

  if (!marketData) {
    return (
      <div className="grid grid-cols-5 gap-px bg-pro-gray-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white py-3">
            <div className="h-4 w-16 bg-gray-200 rounded mx-auto animate-pulse mb-1" />
            <div className="h-5 w-20 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-5 gap-px bg-pro-gray-100">
      <StatItem
        label="标记价格"
        value={marketData.markPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="指数价格"
        value={marketData.indexPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 涨跌"
        value=""
        change={marketData.change24h}
        isPercentage
      />
      <StatItem
        label="24h 最高"
        value={marketData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      />
      <StatItem
        label="24h 成交量"
        value={marketData.volume24h > 1e9
          ? `${(marketData.volume24h / 1e9).toFixed(1)}B`
          : `${(marketData.volume24h / 1e6).toFixed(1)}M`}
      />
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add components/trading/market-stats.tsx
git commit -m "feat: add market stats component"
```

---

### Task 4: 创建杠杆滑块组件

**Files:**
- Create: `apps/web/components/trading/leverage-slider.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/trading/leverage-slider.tsx
'use client'

import { useCallback } from 'react'

interface LeverageSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

const LEVERAGE_MARKS = [1, 5, 10, 15, 20]

export function LeverageSlider({
  value,
  onChange,
  min = 1,
  max = 20,
}: LeverageSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }, [onChange])

  return (
    <div className="mt-3">
      <div className="relative h-1 bg-pro-gray-200 rounded">
        <div
          className="absolute h-full bg-pro-accent-cyan rounded"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          className="absolute w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-pro-accent-cyan rounded-full border-2 border-white shadow"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-pro-gray-500">
        {LEVERAGE_MARKS.map((mark) => (
          <span
            key={mark}
            className={`cursor-pointer hover:text-pro-accent-cyan transition-colors ${
              value === mark ? 'text-pro-accent-cyan font-medium' : ''
            }`}
            onClick={() => onChange(mark)}
          >
            {mark}x
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add components/trading/leverage-slider.tsx
git commit -m "feat: add leverage slider component"
```

---

### Task 5: 创建订单预估 Hook

**Files:**
- Create: `apps/web/hooks/use-order-estimate.ts`

- [ ] **Step 1: 创建 Hook**

```typescript
// apps/web/hooks/use-order-estimate.ts
import { useMemo } from 'react'
import { useMarket } from './use-market'

interface OrderEstimateParams {
  margin: number
  leverage: number
  side: 'long' | 'short'
}

interface OrderEstimate {
  positionSize: number
  entryPrice: number
  liquidationPrice: number
  fee: number
}

export function useOrderEstimate({
  margin,
  leverage,
  side,
}: OrderEstimateParams): OrderEstimate {
  const { marketData } = useMarket('BTC')

  return useMemo(() => {
    if (!marketData || !margin || !leverage) {
      return {
        positionSize: 0,
        entryPrice: 0,
        liquidationPrice: 0,
        fee: 0,
      }
    }

    const positionSize = margin * leverage
    const entryPrice = marketData.markPrice

    // 简化清算价格公式: 开仓价 * (1 ± 1/杠杆 * 0.9)
    const liquidationPrice =
      side === 'long'
        ? entryPrice * (1 - (1 / leverage) * 0.9)
        : entryPrice * (1 + (1 / leverage) * 0.9)

    // 手续费率 0.05%
    const feeRate = 0.0005
    const fee = positionSize * feeRate

    return {
      positionSize,
      entryPrice,
      liquidationPrice,
      fee,
    }
  }, [margin, leverage, side, marketData])
}
```

- [ ] **Step 2: 提交**

```bash
git add hooks/use-order-estimate.ts
git commit -m "feat: add order estimate hook"
```

---

### Task 6: 创建交易表单组件

**Files:**
- Create: `apps/web/components/trading/order-form.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/trading/order-form.tsx
'use client'

import { useState } from 'react'
import { useBalance } from '@/hooks/use-balance'
import { useOrderEstimate } from '@/hooks/use-order-estimate'
import { useOrders } from '@/hooks/use-orders'
import { LeverageSlider } from './leverage-slider'
import { Loader2 } from 'lucide-react'

export function OrderForm() {
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [margin, setMargin] = useState('')
  const [leverage, setLeverage] = useState(10)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { balance } = useBalance()
  const { createOrder } = useOrders()
  const estimate = useOrderEstimate({
    margin: Number(margin) || 0,
    leverage,
    side,
  })

  const availableBalance = balance?.available || 0

  const handleSubmit = async () => {
    if (!margin || Number(margin) <= 0) return
    if (Number(margin) > availableBalance) return

    setIsSubmitting(true)
    try {
      await createOrder({
        symbol: 'BTC',
        side,
        type: 'market',
        margin: Number(margin),
        leverage,
      })
      setMargin('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-5">
      {/* 多空切换 */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={() => setSide('long')}
          className={`py-2.5 rounded-md text-sm font-semibold transition-colors ${
            side === 'long'
              ? 'bg-pro-accent-green text-white'
              : 'bg-pro-accent-green/10 text-pro-accent-green border border-pro-accent-green/20'
          }`}
        >
          开多
        </button>
        <button
          onClick={() => setSide('short')}
          className={`py-2.5 rounded-md text-sm font-semibold transition-colors ${
            side === 'short'
              ? 'bg-pro-accent-red text-white'
              : 'bg-pro-accent-red/10 text-pro-accent-red border border-pro-accent-red/20'
          }`}
        >
          开空
        </button>
      </div>

      {/* 保证金输入 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-pro-gray-500 mb-1.5">
          <span>保证金</span>
          <span className="text-pro-accent-cyan">
            可用: {availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-pro-gray-50 border border-pro-gray-200 rounded-lg text-pro-gray-800 font-mono focus:outline-none focus:border-pro-accent-cyan focus:bg-white transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-pro-gray-500">
            USDC
          </span>
        </div>
      </div>

      {/* 杠杆滑块 */}
      <div className="mb-5">
        <div className="flex justify-between text-sm text-pro-gray-500 mb-1.5">
          <span>杠杆倍数</span>
          <span className="text-pro-accent-cyan font-semibold">{leverage}x</span>
        </div>
        <LeverageSlider value={leverage} onChange={setLeverage} />
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={!margin || Number(margin) <= 0 || Number(margin) > availableBalance || isSubmitting}
        className={`w-full py-3.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          side === 'long'
            ? 'bg-pro-accent-green text-white hover:bg-pro-accent-green/90'
            : 'bg-pro-accent-red text-white hover:bg-pro-accent-red/90'
        }`}
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          `开${side === 'long' ? '多' : '空'} BTC`
        )}
      </button>

      {/* 预估订单摘要 */}
      {Number(margin) > 0 && (
        <div className="mt-5 pt-5 border-t border-pro-gray-100 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">仓位大小</span>
            <span className="font-mono font-medium">
              {estimate.positionSize.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">开仓价格</span>
            <span className="font-mono font-medium">
              ≈ {estimate.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">清算价格</span>
            <span className="font-mono font-medium text-pro-accent-red">
              {estimate.liquidationPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-pro-gray-500">手续费</span>
            <span className="font-mono font-medium">
              {estimate.fee.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add components/trading/order-form.tsx
git commit -m "feat: add order form component with leverage slider"
```

---

### Task 7: 创建当前仓位面板组件

**Files:**
- Create: `apps/web/components/trading/position-panel.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/trading/position-panel.tsx
'use client'

import { usePositions } from '@/hooks/use-positions'
import { useMarket } from '@/hooks/use-market'
import { Loader2 } from 'lucide-react'

export function PositionPanel() {
  const { positions, closePosition, isLoading } = usePositions()
  const { marketData } = useMarket('BTC')

  if (isLoading) {
    return (
      <div className="border-t border-pro-gray-200 p-5 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-pro-gray-400" />
      </div>
    )
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="border-t border-pro-gray-200 p-5">
        <div className="text-sm text-pro-gray-500 text-center py-4">
          暂无持仓
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-pro-gray-200">
      <div className="px-5 py-3 border-b border-pro-gray-100 flex justify-between items-center">
        <span className="text-xs font-semibold text-pro-gray-800 uppercase tracking-wider">
          当前仓位
        </span>
        <span className="text-xs text-pro-accent-cyan cursor-pointer hover:underline">
          查看全部
        </span>
      </div>

      {positions.map((position) => {
        const pnl = position.unrealizedPnl || 0
        const isProfitable = pnl >= 0

        return (
          <div key={position.id} className="p-5 border-b border-pro-gray-100 last:border-b-0">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-pro-gray-800">{position.symbol}/USD</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  position.side === 'long'
                    ? 'bg-pro-accent-green/10 text-pro-accent-green'
                    : 'bg-pro-accent-red/10 text-pro-accent-red'
                }`}
              >
                {position.side === 'long' ? '做多' : '做空'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">仓位大小</div>
                <div className="text-sm font-semibold font-mono">
                  {position.positionSize.toLocaleString()} USD
                </div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">未实现盈亏</div>
                <div
                  className={`text-sm font-semibold font-mono ${
                    isProfitable ? 'text-pro-accent-green' : 'text-pro-accent-red'
                  }`}
                >
                  {isProfitable ? '+' : ''}
                  {pnl.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">开仓价格</div>
                <div className="text-sm font-mono">{position.entryPrice.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">标记价格</div>
                <div className="text-sm font-mono">
                  {marketData?.markPrice.toLocaleString() || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">杠杆</div>
                <div className="text-sm font-mono">{position.leverage}x</div>
              </div>
              <div>
                <div className="text-xs text-pro-gray-500 mb-0.5">清算价格</div>
                <div className="text-sm font-mono text-pro-accent-red">
                  {position.liquidationPrice?.toLocaleString() || '—'}
                </div>
              </div>
            </div>

            <button
              onClick={() => closePosition(position.id)}
              className="w-full py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-500 hover:bg-pro-gray-50 hover:border-pro-accent-red hover:text-pro-accent-red transition-colors"
            >
              平仓
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add components/trading/position-panel.tsx
git commit -m "feat: add position panel component"
```

---

### Task 8: 创建最近交易历史组件

**Files:**
- Create: `apps/web/components/trading/recent-trades.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/trading/recent-trades.tsx
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
```

- [ ] **Step 2: 提交**

```bash
git add components/trading/recent-trades.tsx
git commit -m "feat: add recent trades component"
```

---

### Task 9: 创建价格图表组件（集成 TradingView）

**Files:**
- Create: `apps/web/components/trading/price-chart.tsx`

- [ ] **Step 1: 创建组件**

```typescript
// apps/web/components/trading/price-chart.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useMarket } from '@/hooks/use-market'

const TIMEFRAMES = [
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
]

export function PriceChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [timeframe, setTimeframe] = useState('15')
  const { marketData } = useMarket('BTC')

  // 简化版本：使用 TradingView 嵌入式图表
  useEffect(() => {
    if (!chartRef.current) return

    // 清除旧内容
    chartRef.current.innerHTML = ''

    // 创建 TradingView 容器
    const container = document.createElement('div')
    container.id = 'tradingview-chart'
    container.style.height = '100%'
    container.style.width = '100%'
    chartRef.current.appendChild(container)

    // 加载 TradingView 脚本
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).TradingView) {
        new (window as any).TradingView.widget({
          autosize: true,
          symbol: 'BINANCE:BTCUSDT',
          interval: timeframe,
          timezone: 'Etc/UTC',
          theme: 'light',
          style: '1',
          locale: 'zh_CN',
          toolbar_bg: '#f8f9fa',
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: 'tradingview-chart',
          hide_top_toolbar: true,
          hide_legend: true,
          save_image: false,
          backgroundColor: '#F8F9FA',
          gridColor: '#E2E8F0',
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      if (chartRef.current) {
        chartRef.current.innerHTML = ''
      }
    }
  }, [timeframe])

  const change24h = marketData?.change24h || 0
  const isPositive = change24h >= 0

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-pro-gray-100">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`text-sm transition-colors ${
              timeframe === tf.value
                ? 'text-pro-accent-cyan font-medium'
                : 'text-pro-gray-500 hover:text-pro-gray-700'
            }`}
          >
            {tf.label}
          </button>
        ))}
        <span className="ml-auto text-pro-accent-cyan font-medium text-sm">
          BTC/USD
        </span>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative">
        {/* Price Overlay */}
        {marketData && (
          <div className="absolute top-4 left-4 z-10 bg-white/95 rounded-lg shadow-float p-3">
            <div className="text-sm text-pro-gray-500 mb-1">BTC / USD</div>
            <div className="text-2xl font-bold font-mono text-pro-gray-800">
              {marketData.markPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div
              className={`text-sm font-medium mt-1 ${
                isPositive ? 'text-pro-accent-green' : 'text-pro-accent-red'
              }`}
            >
              {isPositive ? '+' : ''}
              {marketData.change24h.toFixed(2)}%
            </div>
          </div>
        )}

        {/* TradingView Chart */}
        <div ref={chartRef} className="w-full h-full" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 添加 TradingView 类型声明**

```typescript
// apps/web/types/tradingview.d.ts
declare global {
  interface Window {
    TradingView: {
      widget: new (config: {
        autosize: boolean
        symbol: string
        interval: string
        timezone: string
        theme: string
        style: string
        locale: string
        toolbar_bg: string
        enable_publishing: boolean
        allow_symbol_change: boolean
        container_id: string
        hide_top_toolbar?: boolean
        hide_legend?: boolean
        save_image?: boolean
        backgroundColor?: string
        gridColor?: string
      }) => void
    }
  }
}

export {}
```

- [ ] **Step 3: 提交**

```bash
git add components/trading/price-chart.tsx types/tradingview.d.ts
git commit -m "feat: add TradingView price chart component"
```

---

### Task 10: 组装交易页面

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: 重写交易页面**

```typescript
// apps/web/app/page.tsx
import { MarketStats } from '@/components/trading/market-stats'
import { PriceChart } from '@/components/trading/price-chart'
import { OrderForm } from '@/components/trading/order-form'
import { PositionPanel } from '@/components/trading/position-panel'
import { RecentTrades } from '@/components/trading/recent-trades'

export default function TradingPage() {
  return (
    <div className="grid grid-cols-[1fr_360px] h-[calc(100vh-64px)]">
      {/* 左侧主区域 */}
      <div className="flex flex-col gap-3 p-4 overflow-auto">
        {/* 市场统计栏 */}
        <div className="bg-white rounded-lg shadow-panel overflow-hidden">
          <MarketStats />
        </div>

        {/* 图表区域 */}
        <div className="bg-white rounded-lg shadow-panel flex-1 min-h-[380px] overflow-hidden">
          <PriceChart />
        </div>

        {/* 历史记录面板 */}
        <div className="bg-white rounded-lg shadow-panel h-[280px] overflow-hidden">
          <RecentTrades />
        </div>
      </div>

      {/* 右侧交易区 */}
      <div className="bg-white border-l border-pro-gray-200 flex flex-col overflow-auto">
        {/* 交易表单 */}
        <OrderForm />

        {/* 当前仓位面板 */}
        <PositionPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 删除旧的 positions 页面**

```bash
rm -rf apps/web/app/positions
```

- [ ] **Step 3: 提交**

```bash
git add app/page.tsx
git rm -r app/positions 2>/dev/null || true
git commit -m "feat: assemble trading page with new layout"
```

---

## Chunk 3: 资产页面

### Task 11: 创建资产页面

**Files:**
- Modify: `apps/web/app/assets/page.tsx`
- Create: `apps/web/components/asset/balance-card.tsx`
- Delete: `apps/web/components/asset/deposit-flow.tsx`
- Delete: `apps/web/components/asset/withdraw-flow.tsx`

- [ ] **Step 1: 创建资产汇总卡片组件**

```typescript
// apps/web/components/asset/balance-card.tsx
'use client'

import { useBalance } from '@/hooks/use-balance'
import { usePositions } from '@/hooks/use-positions'

interface SummaryCardProps {
  label: string
  value: number
  prefix?: string
  variant?: 'default' | 'green' | 'red'
}

function SummaryCard({ label, value, prefix = '$', variant = 'default' }: SummaryCardProps) {
  const valueClass =
    variant === 'green'
      ? 'text-pro-accent-green'
      : variant === 'red'
      ? 'text-pro-accent-red'
      : 'text-pro-gray-800'

  return (
    <div className="bg-white rounded-lg shadow-panel p-5">
      <div className="text-xs text-pro-gray-500 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={`text-2xl font-bold font-mono ${valueClass}`}>
        {prefix}
        {value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    </div>
  )
}

export function BalanceSummary() {
  const { balance } = useBalance()
  const { positions } = usePositions()

  const totalValue = (balance?.equity || 0) + (balance?.available || 0)
  const availableBalance = balance?.available || 0
  const lockedBalance = balance?.locked || 0

  // 计算未实现盈亏
  const unrealizedPnl =
    positions?.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0) || 0

  return (
    <div className="grid grid-cols-4 gap-4">
      <SummaryCard label="总资产价值" value={totalValue} />
      <SummaryCard
        label="可用余额"
        value={availableBalance}
        variant="green"
      />
      <SummaryCard label="已锁定保证金" value={lockedBalance} />
      <SummaryCard
        label="未实现盈亏"
        value={unrealizedPnl}
        variant={unrealizedPnl >= 0 ? 'green' : 'red'}
        prefix={unrealizedPnl >= 0 ? '+$' : '-$'}
      />
    </div>
  )
}
```

- [ ] **Step 2: 重写资产页面**

```typescript
// apps/web/app/assets/page.tsx
'use client'

import { useState } from 'react'
import { useBalance } from '@/hooks/use-balance'
import { BalanceSummary } from '@/components/asset/balance-card'
import Link from 'next/link'

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
  const [hideZero, setHideZero] = useState(false)

  const availableBalance = balance?.available || 0
  const lockedBalance = balance?.locked || 0
  const totalBalance = availableBalance + lockedBalance

  const assetData = ASSETS.map((asset) => ({
    ...asset,
    total: asset.symbol === 'USDC' ? totalBalance : 0,
    available: asset.symbol === 'USDC' ? availableBalance : 0,
    locked: asset.symbol === 'USDC' ? lockedBalance : 0,
  })).filter((asset) => !hideZero || asset.total > 0)

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
                      <button className="px-3 py-1.5 bg-pro-accent-green text-white text-xs font-medium rounded hover:bg-pro-accent-green/90 transition-colors">
                        充值
                      </button>
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
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 清理旧组件**

```bash
rm -f apps/web/components/asset/deposit-flow.tsx
rm -f apps/web/components/asset/withdraw-flow.tsx
rm -f apps/web/components/asset/transaction-history.tsx
```

- [ ] **Step 4: 提交**

```bash
git add components/asset/balance-card.tsx app/assets/page.tsx
git rm -f components/asset/deposit-flow.tsx components/asset/withdraw-flow.tsx components/asset/transaction-history.tsx 2>/dev/null || true
git commit -m "feat: rewrite assets page with new design"
```

---

## Chunk 4: 历史记录页面

### Task 12: 创建历史记录页面

**Files:**
- Create: `apps/web/app/history/page.tsx`

- [ ] **Step 1: 创建页面**

```typescript
// apps/web/app/history/page.tsx
'use client'

import { useState } from 'react'
import { useTransactions } from '@/hooks/use-transactions'

const TYPE_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '交易', value: 'trade' },
  { label: '充值', value: 'deposit' },
  { label: '提现', value: 'withdraw' },
  { label: '清算', value: 'liquidation' },
]

const STATUS_OPTIONS = [
  { label: '所有状态', value: 'all' },
  { label: '已成交', value: 'filled' },
  { label: '处理中', value: 'pending' },
  { label: '失败', value: 'failed' },
]

export default function HistoryPage() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-03-12')
  const [currentPage, setCurrentPage] = useState(1)

  const { transactions, isLoading, totalCount = 127 } = useTransactions({
    page: currentPage,
    limit: 20,
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

  const getTypeClass = (type: string) => {
    switch (type) {
      case 'trade':
        return 'bg-pro-accent-cyan/10 text-pro-accent-cyan'
      case 'deposit':
        return 'bg-pro-accent-green/10 text-pro-accent-green'
      case 'withdraw':
        return 'bg-pro-accent-red/10 text-pro-accent-red'
      case 'liquidation':
        return 'bg-amber-100 text-amber-600'
      default:
        return 'bg-pro-gray-100 text-pro-gray-500'
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
      case 'liquidation':
        return '清算'
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'filled':
        return '已成交'
      case 'completed':
        return '已完成'
      case 'pending':
        return '处理中'
      case 'failed':
        return '失败'
      default:
        return status
    }
  }

  const totalPages = Math.ceil(totalCount / 20)

  const exportCSV = () => {
    if (!transactions) return

    const headers = ['时间', '类型', '交易对', '方向', '数量', '价格', '盈亏', '手续费', '状态', '交易哈希']
    const rows = transactions.map((tx) => [
      new Date(tx.createdAt).toISOString(),
      getTypeLabel(tx.type),
      tx.pair || '—',
      tx.side || '—',
      tx.amount,
      tx.price || '—',
      tx.pnl || '—',
      tx.fee || '0',
      getStatusLabel(tx.status),
      tx.txHash || '—',
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
      <div className="bg-white rounded-lg shadow-panel p-4 mb-4 flex flex-wrap items-center gap-4">
        {/* Type Filters */}
        <div className="flex gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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
          className="px-4 py-2 border border-pro-gray-200 rounded-md text-sm text-pro-gray-600 hover:border-pro-accent-cyan hover:text-pro-accent-cyan transition-colors"
        >
          导出 CSV
        </button>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-lg shadow-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-pro-gray-50 text-xs text-pro-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">时间</th>
                <th className="px-4 py-3 text-left font-semibold">类型</th>
                <th className="px-4 py-3 text-left font-semibold">交易对</th>
                <th className="px-4 py-3 text-left font-semibold">方向</th>
                <th className="px-4 py-3 text-right font-semibold">数量</th>
                <th className="px-4 py-3 text-right font-semibold">价格</th>
                <th className="px-4 py-3 text-right font-semibold">盈亏</th>
                <th className="px-4 py-3 text-right font-semibold">手续费</th>
                <th className="px-4 py-3 text-center font-semibold">状态</th>
                <th className="px-4 py-3 text-left font-semibold">交易哈希</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-pro-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : !transactions || transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-pro-gray-400">
                    暂无记录
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
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
                    <td className="px-4 py-4 font-mono text-sm">
                      {tx.pair || '—'}
                    </td>
                    <td className="px-4 py-4">
                      {tx.side && (
                        <span
                          className={`text-sm font-semibold ${
                            tx.side === 'long'
                              ? 'text-pro-accent-green'
                              : tx.side === 'short'
                              ? 'text-pro-accent-red'
                              : 'text-pro-gray-500'
                          }`}
                        >
                          {tx.side === 'long'
                            ? '开多'
                            : tx.side === 'short'
                            ? '开空'
                            : '平仓'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-medium">
                      {tx.amount} {tx.symbol}
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      {tx.price?.toLocaleString() || '—'}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-medium">
                      {tx.pnl !== undefined ? (
                        <span
                          className={
                            tx.pnl >= 0
                              ? 'text-pro-accent-green'
                              : 'text-pro-accent-red'
                          }
                        >
                          {tx.pnl >= 0 ? '+' : ''}
                          {tx.pnl.toFixed(2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-pro-gray-500 text-xs">
                      {tx.fee?.toFixed(2) || '0.00'}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-pro-gray-100 flex justify-between items-center">
          <span className="text-sm text-pro-gray-500">
            显示 {(currentPage - 1) * 20 + 1}-{Math.min(currentPage * 20, totalCount)} 条，共{' '}
            {totalCount} 条记录
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-pro-gray-200 rounded text-sm text-pro-gray-600 disabled:opacity-50 hover:border-pro-gray-300 transition-colors"
            >
              上一页
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    currentPage === page
                      ? 'bg-pro-gray-900 text-white'
                      : 'border border-pro-gray-200 text-pro-gray-600 hover:border-pro-gray-300'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            {totalPages > 5 && <span className="px-2 text-pro-gray-400">...</span>}
            {totalPages > 5 && (
              <button
                onClick={() => setCurrentPage(totalPages)}
                className="px-3 py-1.5 border border-pro-gray-200 rounded text-sm text-pro-gray-600 hover:border-pro-gray-300 transition-colors"
              >
                {totalPages}
              </button>
            )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-pro-gray-200 rounded text-sm text-pro-gray-600 disabled:opacity-50 hover:border-pro-gray-300 transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add app/history/page.tsx
git commit -m "feat: add history page with filters and pagination"
```

---

## Chunk 5: 清理与验证

### Task 13: 清理旧组件并验证构建

**Files:**
- Multiple files to delete

- [ ] **Step 1: 删除旧组件**

```bash
# 删除不再需要的旧组件
rm -rf apps/web/components/position/
rm -f apps/web/components/asset/transaction-history.tsx
rm -f apps/web/components/trading/order-confirm.tsx
rm -f apps/web/components/trading/trade-result.tsx
```

- [ ] **Step 2: 更新 types/index.ts（如需要）**

确保类型定义完整。

- [ ] **Step 3: 运行类型检查**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: 运行构建**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "chore: clean up old components"
```

---

## 验收清单

### 功能验收

- [ ] 全局样式使用 Pro Light 配色系统
- [ ] 导航栏显示交易、资产、历史三个标签
- [ ] 交易页采用终端式左右分栏布局
- [ ] 交易表单包含多空切换、杠杆滑块、预估摘要
- [ ] 图表区域显示 TradingView 图表和价格悬浮卡片
- [ ] 历史记录面板显示最近交易
- [ ] 当前仓位面板显示持仓详情和平仓按钮
- [ ] 资产页显示汇总卡片和资产列表表格
- [ ] 历史记录页显示筛选栏和分页表格
- [ ] CSV 导出功能正常工作

### 视觉验收

- [ ] 配色与设计稿一致（珍珠灰/纯净白/曜石黑/科技青/森林绿/砖红色）
- [ ] 字体使用系统字体 + 等宽字体显示数字
- [ ] 阴影和圆角符合设计规范
- [ ] 响应式布局在各尺寸下正常

### 性能验收

- [ ] 首屏加载时间 < 3秒
- [ ] 图表懒加载正常工作
- [ ] 页面切换流畅无闪烁

---

**执行顺序：**
1. Chunk 1 → Chunk 2 → Chunk 3 → Chunk 4 → Chunk 5
2. 每个 Task 按 Step 顺序执行
3. 每个 Task 完成后提交

**相关技能：**
- @superpowers:subagent-driven-development - 用于并行执行任务
- @superpowers:tdd - 用于编写测试（可选）
- @superpowers:verification-before-completion - 最终验收
