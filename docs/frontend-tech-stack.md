# PerpDex MVP 前端技术选型方案

> 文档版本：1.2
> 更新日期：2026-03-11
> 作者：前端开发团队
> 变更记录：升级 Next.js 15；替换 RainbowKit 为 Reown AppKit；替换原生 WebSocket 为 Socket.IO Client；移除 E2E 测试；明确只实现 CFD 市价单

---

## 1. 框架选型

### 推荐方案：Next.js 15 (App Router)

### 备选方案
- Remix
- Vite + React SPA

### 选择理由

| 维度 | Next.js 15 优势 |
|------|----------------|
| **SSR/SSG** | 首屏加载快，SEO 友好（虽然 DApp 对 SEO 需求较低，但 SSR 能提升首屏体验） |
| **API Routes** | 可作为 BFF 层，聚合后端 API，隐藏敏感逻辑 |
| **生态成熟度** | 与 Reown AppKit、Wagmi 集成案例丰富，社区支持好 |
| **开发体验** | Turbopack 加速构建，热更新快 |
| **路由系统** | App Router 支持嵌套布局，适合交易页面的复杂结构 |
| **中间件** | 支持边缘中间件，可做鉴权预处理 |
| **React 19** | Next.js 15 支持 React 19，带来更好的并发渲染和性能优化 |

### 与后端协作方式
- 前端通过 API Routes 代理后端请求，统一错误处理
- 客户端组件直接调用后端 REST API（`/api/*`）
- 实时数据通过 WebSocket 连接后端行情服务

---

## 2. 状态管理

### 推荐方案：Zustand

### 备选方案
- Jotai（更轻量，原子化）
- Redux Toolkit（功能全面，但较重）

### 选择理由

| 维度 | Zustand 优势 |
|------|-------------|
| **包体积** | ~1KB gzipped，对 MVP 项目友好 |
| **学习曲线** | API 简单，无 boilerplate |
| **TypeScript** | 原生支持，类型推断完善 |
| **与 React 18+ 兼容** | 支持 Concurrent 模式 |
| **中间件** | 内置 persist、devtools、immer 中间件 |
| **钱包状态** | Wagmi 已有内置状态，Zustand 只管理业务状态 |

### 状态设计建议

```typescript
// stores/tradingStore.ts
interface TradingState {
  // 行情数据
  marketPrice: number | null
  priceHistory: PricePoint[]

  // 用户数据（来自后端 API）
  balance: Balance | null
  positions: Position[]

  // UI 状态
  selectedSymbol: 'BTC'
  orderForm: OrderFormData

  // Actions
  updateMarketPrice: (price: number) => void
  setBalance: (balance: Balance) => void
  setPositions: (positions: Position[]) => void
}

// stores/settingsStore.ts
interface SettingsState {
  leverage: number
  slippageTolerance: number
  theme: 'light' | 'dark'
}
```

### 与后端协作方式
- 用户状态（余额、仓位）通过 API 获取，存入 Zustand
- 实时更新通过 WebSocket 推送，更新 Zustand 状态
- 组件订阅 Zustand 状态，实现响应式更新

---

## 3. 钱包连接

### 推荐方案：Reown AppKit + Wagmi v2

### 备选方案
- RainbowKit + Wagmi（UI 美观，但功能较少）
- ConnectKit（更轻量，但生态较小）

### 选择理由

| 维度 | Reown AppKit + Wagmi 优势 |
|------|--------------------------|
| **钱包支持** | 500+ 钱包通过 WalletConnect 协议支持 |
| **社交登录** | 内置 Email、Google、Apple 等社交登录 |
| **SIWE 支持** | 内置认证适配器，与 SIWE 无缝集成 |
| **Wagmi v2** | Hooks 丰富（`useAccount`、`useSignMessage`、`useWriteContract`） |
| **智能账户** | 支持账户抽象（Account Abstraction） |
| **多链支持** | 支持 EVM + Solana，后续扩展灵活 |
| **React Native** | 支持 Mobile App 开发，与 Web 共享配置 |

### 配置示例

```typescript
// config/wagmi.ts
import { http, createConfig } from '@wagmi/core'
import { arbitrumSepolia } from '@wagmi/core/chains'
import { injected, walletConnect } from '@wagmi/connectors'

export const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [
    injected(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID! }),
  ],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
})

// config/appkit.ts
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

const wagmiAdapter = new WagmiAdapter({
  networks: [arbitrumSepolia],
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks: [arbitrumSepolia],
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
  metadata: {
    name: 'PerpDex',
    description: 'Perpetual DEX MVP',
    url: 'https://perpdex.com',
    icons: ['https://perpdex.com/logo.png'],
  },
  features: {
    analytics: true,
    socials: ['google', 'apple', 'email'],
  },
})
```

### 与后端协作方式
- 前端获取 SIWE challenge：`GET /api/auth/challenge`
- 用户签名后，前端调用：`POST /api/auth/verify`
- 后端返回 JWT，前端存储在 httpOnly cookie 或 localStorage
- 后续请求携带 JWT 进行身份验证
- 支持社交登录快速注册（AppKit 特有功能）

---

## 4. UI 组件库

### 推荐方案：shadcn/ui + Tailwind CSS

### 备选方案
- Ant Design（企业级，但样式定制成本高）
- MUI（Material Design 风格，与交易界面风格不符）
- Radix UI + Tailwind 自研（shadcn/ui 的底层方案）

### 选择理由

| 维度 | shadcn/ui 优势 |
|------|---------------|
| **可定制性** | 组件代码直接复制到项目，完全可控 |
| **无依赖锁定** | 基于 Radix UI 原语，不依赖外部包版本 |
| **Tailwind 原生** | 样式使用 Tailwind，与项目风格统一 |
| **暗色模式** | 内置 CSS 变量，轻松切换暗色主题 |
| **交易场景适配** | 可灵活定制输入框、按钮、表格等交易组件 |
| **包体积** | 只引入需要的组件，无冗余 |

### 关键组件
- `Input`：保证金、杠杆输入
- `Button`：开多/开空/平仓按钮
- `Tabs`：交易对切换
- `Table`：仓位列表、历史记录
- `Dialog`：充值/提现弹窗
- `Toast`：交易结果通知

### 与后端协作方式
- 纯前端组件，通过状态管理获取数据
- 异步操作（交易、充值）显示 loading 状态
- 后端错误通过 Toast 提示用户

---

## 5. 实时通信

### 推荐方案：Socket.IO Client

### 备选方案
- 原生 WebSocket（轻量，但需手动实现重连和房间管理）
- Partytown（Web Worker 隔离，复杂度高）

### 选择理由

| 维度 | Socket.IO 优势 |
|------|---------------|
| **自动重连** | 内置指数退避重连机制，无需手动实现 |
| **房间/命名空间** | 支持按用户、按交易对推送，灵活的订阅管理 |
| **HTTP 降级** | 自动降级到 HTTP long-polling，兼容移动端/防火墙场景 |
| **心跳机制** | 内置心跳检测，自动清理断开连接 |
| **消息确认** | 支持 ACK 机制，确保消息送达 |
| **与后端统一** | 后端使用 Socket.IO Server，前后端协议一致 |

### 封装示例

```typescript
// lib/websocket.ts
import { io, Socket } from 'socket.io-client'

export class MarketSocket {
  private socket: Socket | null = null

  connect(token: string) {
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      // Socket.IO 会自动重连
    })

    return this.socket
  }

  subscribeMarket(symbol: string, callback: (data: MarketData) => void) {
    this.socket?.emit('subscribe:market', { symbol })
    this.socket?.on(`market:${symbol}:update`, callback)
  }

  subscribePosition(userId: string, callback: (data: PositionUpdate) => void) {
    this.socket?.emit('subscribe:position', { userId })
    this.socket?.on(`position:${userId}:update`, callback)
  }

  unsubscribe(symbol: string) {
    this.socket?.emit('unsubscribe:market', { symbol })
    this.socket?.off(`market:${symbol}:update`)
  }

  disconnect() {
    this.socket?.disconnect()
  }
}

// hooks/useMarketSocket.ts
export function useMarketSocket(symbol: string) {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const { token } = useAuth()

  useEffect(() => {
    const socket = new MarketSocket()
    socket.connect(token)
    socket.subscribeMarket(symbol, setMarketData)

    return () => {
      socket.unsubscribe(symbol)
      socket.disconnect()
    }
  }, [symbol, token])

  return marketData
}
```

### 与后端协作方式
- 连接 `SOCKET /api/socket.io` 获取实时行情
- 按交易对订阅：`subscribe:market` → `market:BTC:update`
- 按用户订阅：`subscribe:position` → `position:{userId}:update`
- 自动重连：断线后 Socket.IO 自动重连，无需手动处理

---

## 6. 样式方案

### 推荐方案：Tailwind CSS

### 备选方案
- CSS Modules（作用域隔离，但写法繁琐）
- CSS-in-JS（emotion/styled-components，运行时开销）

### 选择理由

| 维度 | Tailwind CSS 优势 |
|------|------------------|
| **开发速度** | 无需切换文件，直接写类名 |
| **一致性** | 设计系统内置，间距、颜色统一 |
| **暗色模式** | `dark:` 前缀一键切换 |
| **包体积** | JIT 模式，只生成用到的类 |
| **与 shadcn/ui 兼容** | shadcn/ui 默认使用 Tailwind |
| **响应式** | `md:`、`lg:` 前签快速适配 |

### 配置建议

```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 交易专用颜色
        long: '#22c55e',   // 绿色 - 做多
        short: '#ef4444',  // 红色 - 做空
        warning: '#f59e0b',
        danger: '#dc2626',
      },
    },
  },
}
```

---

## 7. 图表库

### 推荐方案：TradingView Lightweight Charts

### 备选方案
- ECharts（功能全面，但金融场景不如 Lightweight 专业）
- Recharts（React 生态，但 K 线图支持较弱）
- KlineCharts（国产，社区较小）

### 选择理由

| 维度 | Lightweight Charts 优势 |
|------|------------------------|
| **专业性** | TradingView 出品，金融行业标准 |
| **包体积** | ~44KB gzipped，轻量 |
| **性能** | Canvas 渲染，支持大量数据点 |
| **功能** | K 线、折线图、成交量图内置 |
| **框架无关** | 原生 JS，React 封装简单 |
| **实时更新** | 支持 real-time 数据推送 |

### 封装示例

```typescript
// components/PriceChart.tsx
import { createChart, IChartApi } from 'lightweight-charts'
import { useEffect, useRef } from 'react'

interface PriceChartProps {
  data: CandleData[]
  currentPrice: number
}

export function PriceChart({ data, currentPrice }: PriceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    chartInstance.current = createChart(chartRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#999',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      width: chartRef.current.clientWidth,
      height: 400,
    })

    const candlestickSeries = chartInstance.current.addCandlestickSeries()
    candlestickSeries.setData(data)

    return () => chartInstance.current?.remove()
  }, [data])

  return <div ref={chartRef} className="w-full h-[400px]" />
}
```

### 与后端协作方式
- 历史数据通过 `GET /api/markets/:symbol` 获取
- 实时价格通过 WebSocket 推送，更新最新 K 线
- 切换时间周期（1m/5m/1h）重新请求历史数据

---

## 8. 表单处理

### 推荐方案：React Hook Form + Zod

### 备选方案
- Formik（老牌，但性能不如 RHF）
- 原生表单（MVP 够用，但验证逻辑分散）

### 选择理由

| 维度 | RHF + Zod 优势 |
|------|---------------|
| **性能** | 非受控组件，减少重渲染 |
| **验证** | Zod schema 统一前后端验证规则 |
| **类型安全** | Zod 类型推断，自动生成表单类型 |
| **错误处理** | 统一的错误提示机制 |
| **钱包交互** | 可结合 Wagmi 的异步操作 |

### 使用示例

```typescript
// schemas/order.ts
import { z } from 'zod'

export const orderSchema = z.object({
  side: z.enum(['long', 'short']),
  margin: z.number().min(1, '最低保证金 1 USDC'),
  leverage: z.number().min(1).max(20, '杠杆范围 1x - 20x'),
})

export type OrderFormData = z.infer<typeof orderSchema>

// components/OrderForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

export function OrderForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      side: 'long',
      margin: 10,
      leverage: 10,
    },
  })

  const onSubmit = async (data: OrderFormData) => {
    // 调用交易 API
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  )
}
```

### 与后端协作方式
- 前端 Zod schema 与后端验证规则保持一致
- 后端返回验证错误时，前端显示在对应字段
- 交易确认前可调用预检查接口验证

---

## 9. 技术栈总览

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Stack                        │
├─────────────────────────────────────────────────────────────┤
│  Framework       │  Next.js 15 (App Router)                 │
│  Language        │  TypeScript 5+                           │
│  State           │  Zustand                                 │
│  Wallet          │  Reown AppKit + Wagmi v2                 │
│  UI Library      │  shadcn/ui                               │
│  Styling         │  Tailwind CSS                            │
│  Charts          │  TradingView Lightweight Charts          │
│  Forms           │  React Hook Form + Zod                   │
│  Real-time       │  Socket.IO Client                        │
│  HTTP Client     │  fetch / ky                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. 目录结构建议

```
frontend/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (trading)/
│   │   ├── layout.tsx           # 交易页面布局
│   │   ├── page.tsx             # 首页/交易页
│   │   └── history/
│   │       └── page.tsx
│   ├── api/                     # API Routes (BFF)
│   │   ├── auth/
│   │   └── proxy/
│   └── layout.tsx
├── components/
│   ├── ui/                      # shadcn/ui 组件
│   ├── trading/                 # 交易组件
│   │   ├── OrderForm.tsx
│   │   ├── PositionTable.tsx
│   │   └── PriceChart.tsx
│   ├── wallet/                  # 钱包组件
│   │   └── ConnectButton.tsx
│   └── layout/
│       ├── Header.tsx
│       └── Sidebar.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useBalance.ts
│   ├── useMarket.ts
│   └── usePositions.ts
├── stores/
│   ├── tradingStore.ts
│   └── settingsStore.ts
├── lib/
│   ├── api.ts                   # API 客户端
│   ├── websocket.ts             # WebSocket 封装
│   └── utils.ts
├── config/
│   ├── wagmi.ts                 # Wagmi 配置
│   └── constants.ts
├── types/
│   ├── api.ts
│   └── trading.ts
└── schemas/
    ├── order.ts
    └── auth.ts
```

---

## 11. 与后端协作方式总结

| 功能 | 前端职责 | 后端职责 | 通信方式 |
|------|---------|---------|---------|
| 钱包登录 | 签名 SIWE 消息 | 验证签名，颁发 JWT | REST |
| 行情数据 | 渲染图表，订阅更新 | 推送实时价格 | WebSocket |
| 余额查询 | 展示余额 | 查询数据库 | REST |
| 充值/提现 | 调用合约，展示状态 | 监听事件，更新余额 | 合约 + REST |
| 交易下单 | 表单验证，发送请求 | 校验余额，执行交易 | REST |
| 仓位管理 | 展示仓位，实时 PnL | 计算盈亏，推送更新 | REST + WebSocket |

---

## 12. 风险与建议

### 风险
1. **钱包兼容性**：部分钱包可能不支持特定链，需要 fallback 处理
2. **实时性**：WebSocket 断线可能导致数据延迟，需要重连机制
3. **精度问题**：前端 JS 处理大数需要使用 BigInt 或 decimal.js

### 建议
1. **渐进式开发**：先实现核心交易流程，再优化体验
2. **Mock 数据**：开发阶段使用 Mock API，前后端并行开发
3. **监控告警**：集成 Sentry 监控前端错误

---

## 14. MVP 范围说明

### 交易模式

**MVP 阶段采用 CFD 模式，只实现市价单：**

| 功能 | MVP 状态 | 说明 |
|------|---------|------|
| 市价开多/开空 | ✅ 实现 | 用户输入保证金和杠杆，按标记价格成交 |
| 市价平仓 | ✅ 实现 | 一键全平，按标记价格结算 |
| 限价单 | ❌ 暂不实现 | MVP 后续迭代 |
| 止盈止损 | ❌ 暂不实现 | MVP 后续迭代 |
| 订单簿 | ❌ 不实现 | CFD 模式无需订单簿 |
| K 线图 | ✅ 实现 | TradingView Lightweight Charts |

### 前端组件范围

| 组件 | 是否实现 | 说明 |
|------|---------|------|
| PriceChart | ✅ | K 线图展示 |
| OrderForm | ✅ | 市价单表单（保证金 + 杠杆） |
| PositionTable | ✅ | 仓位列表 + PnL 展示 |
| BalanceCard | ✅ | 余额展示 |
| DepositDialog | ✅ | 充值弹窗 |
| WithdrawDialog | ✅ | 提现弹窗 |
| OrderBook | ❌ | CFD 模式不需要 |
| TradeHistory | ✅ | 交易历史记录 |

---

## 13. 下一步行动

- [ ] 确认测试网配置（Arbitrum Sepolia 或其他）
- [ ] 创建 Next.js 15 项目脚手架
- [ ] 配置 Reown AppKit + Wagmi v2
- [ ] 配置 Socket.IO Client
- [ ] 实现基础布局和路由
- [ ] 对接后端 API（mock 阶段）
