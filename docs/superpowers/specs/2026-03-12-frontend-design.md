# PerpDex MVP 前端设计文档

> 文档版本：1.2
> 更新日期：2026-03-12
> 状态：Ready for Implementation

---

## 1. 概述

### 1.1 项目背景
PerpDex MVP 是一个基于 EVM 链的永续合约交易系统，前端采用极简终端风格 (Pro Light) 设计，提供专业的交易体验。

### 1.2 设计目标
- 简洁专业的交易界面
- 清晰的数据展示
- 流畅的用户交互
- 响应式布局支持

### 1.3 核心功能
- SIWE 钱包登录
- USDC 充值/提现
- BTC 永续合约交易（市价单）
- 仓位管理与 PnL 展示
- 实时行情推送

---

## 2. 页面结构

### 2.1 路由设计

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 交易页 | 核心交易界面，K线图 + 订单面板 |
| `/assets` | 资产页 | 余额详情、充值提现历史 |

### 2.2 弹窗组件

| 弹窗 | 触发方式 | 说明 |
|------|----------|------|
| `LoginModal` | 点击"CONNECT" | SIWE 钱包连接 + 签名 |
| `DepositModal` | 点击"DEPOSIT" | Vault deposit 流程 |
| `WithdrawModal` | 点击"WITHDRAW" | Vault withdraw 流程 |
| `OrderConfirmModal` | 点击"OPEN POSITION" | 订单确认详情 |

---

## 3. 布局设计

### 3.1 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  [PERPDEX_]  TRADE   ASSETS   HISTORY    0x7a8b... [CONNECT] │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────┬───────────────┐ │
│  │                                    │   AVAILABLE   │ │
│  │         K线图区域 (TradingView)     │   1,250 USDC  │ │
│  │                                    │  [DEPOSIT]    │ │
│  │                                    │  [WITHDRAW]   │ │
│  │                                    ├───────────────┤ │
│  │                                    │   [LONG]      │ │
│  │                                    │   [SHORT]     │ │
│  │                                    │   MARGIN      │ │
│  │                                    │   LEVERAGE    │ │
│  │                                    │   [OPEN]      │ │
│  ├────────────────────────────────────┤               │ │
│  │  POSITIONS | ORDERS                │               │ │
│  │  [仓位列表表格]                      │               │ │
│  └────────────────────────────────────┴───────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 布局规格

- **整体**：两栏布局 `1fr + 300px`
- **左侧主区域**：K线图（自适应高度）+ 仓位列表（固定 200px）
- **右侧交易面板**：固定 300px 宽度
- **间距**：12px 卡片间距，20px 内部 padding
- **卡片圆角**：12px

---

## 4. 视觉设计系统

### 4.1 配色方案 (Pro Light)

| 用途 | 名称 | Hex | 应用场景 |
|------|------|-----|----------|
| 主背景 | 珍珠灰 | `#F8F9FA` | 页面背景 |
| 面板/卡片 | 纯净白 | `#FFFFFF` | 卡片背景 |
| 品牌主色 | 曜石黑 | `#0F172A` | Logo、主要按钮、导航选中 |
| 点缀色 | 科技青 | `#0EA5E9` | Hover、链接、高亮、杠杆显示 |
| 上涨/做多 | 森林绿 | `#059669` | 做多按钮、正收益、涨幅 |
| 下跌/做空 | 砖红色 | `#DC2626` | 做空按钮、负收益、跌幅、平仓 |
| 主要文字 | 碳黑色 | `#1E293B` | 标题、重要数据 |
| 次要文字 | 灰色 | `#64748B` | 标签、辅助信息 |
| 边框 | 浅灰 | `#E5E7EB` | 卡片边框、分割线 |

### 4.2 字体规范

- **界面字体**：系统默认无衬线字体 (system-ui, -apple-system, sans-serif)
- **数据字体**：等宽字体 (ui-monospace, SFMono-Regular, Menlo, monospace)
- **标题尺寸**：18-20px，font-weight: 600
- **数据尺寸**：14-16px，font-weight: 500/600
- **标签尺寸**：11-12px，font-weight: 500

### 4.3 间距规范

- **卡片圆角**：12px
- **按钮圆角**：8-10px
- **小按钮圆角**：6px
- **卡片内边距**：16-20px
- **元素间距**：8-12px
- **区块间距**：12-20px

---

## 5. 组件设计

### 5.1 顶部导航 (Header)

```
[PERPDEX_]    TRADE    ASSETS    HISTORY          0x7a8b...9c2d    [CONNECT]
```

- **Logo**：等宽字体 "PERPDEX_"，曜石黑
- **导航**：大写字母，选中项底部 2px 科技青下划线
- **地址**：等宽字体，截断显示
- **连接按钮**：曜石黑背景，白字，圆角 6px

### 5.2 K 线图区域 (ChartSection)

- **背景**：白色卡片，12px 圆角，轻微阴影
- **顶部信息栏**：交易对 + 当前价格 + 涨跌幅
- **时间周期选择器**：1m, 15m, 1h, 4h, 1d
- **左侧统计**：24H HIGH / LOW / VOL（等宽字体标签）
- **图表**：TradingView Lightweight Charts

### 5.3 余额卡片 (BalanceCard)

```
┌─────────────────────────┐
│  AVAILABLE BALANCE      │
│  1,250.50 USDC          │
│  [DEPOSIT] [WITHDRAW]   │
└─────────────────────────┘
```

- 标签：大写等宽，灰色
- 金额：24px 粗体，碳黑色
- 按钮：浅灰背景，边框，大写标签

### 5.4 订单表单 (OrderForm)

```
┌─────────────────────────┐
│   [LONG]    [SHORT]     │
│  MARGIN (USDC)          │
│  [____________] USDC    │
│  LEVERAGE          10x  │
│  [========●====]        │
│  [1x] [5x] [10x] [20x]  │
│  ┌─────────────────────┐│
│  │ Position Size       ││
│  │ 0.0149 BTC          ││
│  │ Liquidation Price   ││
│  │ $60,520.00          ││
│  │ Fee (0.05%)         ││
│  │ 0.05 USDC           ││
│  └─────────────────────┘│
│  [OPEN LONG POSITION]   │
│  [VIEW CALCULATION]      │
└─────────────────────────┘
```

- **多空切换**：选中项深绿/深红背景，未选中浅灰
- **保证金输入**：浅灰背景，等宽字体，右对齐单位
- **杠杆滑块**：科技青滑块色，快捷按钮组
- **计算详情**：浅灰背景卡片，等宽标签
- **主按钮**：长按钮深绿/深红，大写标签
- **VIEW CALCULATION**：点击后展开/收起详细计算说明面板，展示公式：Position Size = Margin × Leverage / Mark Price

### 5.5 仓位列表 (PositionTable)

| 字段 | 样式 |
|------|------|
| PAIR | 碳黑色，等宽 |
| SIDE | LONG=绿色标签，SHORT=红色标签，大写 |
| SIZE | 等宽字体 |
| ENTRY/MARK | 等宽字体 |
| PNL | 绿色/红色，等宽，带 +/- |
| ACTION | CLOSE 按钮，红色 |

---

## 6. 交互流程

### 6.1 登录流程

1. 用户点击 "CONNECT"
2. 弹出 Reown AppKit 钱包选择器
3. 用户选择钱包并连接
4. 前端调用 `GET /api/auth/challenge`
5. 用户签署 SIWE 消息
6. 前端调用 `POST /api/auth/verify`
7. 后端返回 JWT，前端存储到 localStorage
8. 弹窗关闭，显示用户地址

### 6.2 开仓流程

1. 用户输入保证金金额
2. 选择杠杆倍数（滑块或快捷按钮）
3. 前端实时计算：
   - Position Size = Margin × Leverage / Mark Price
   - Liquidation Price（根据公式计算）
   - Fee = Margin × 0.05%
4. 点击 "OPEN LONG/SHORT POSITION"
5. 弹出确认框展示订单详情
6. 用户确认后调用 `POST /api/trade/order`
7. 成功后：
   - Toast 提示成功
   - 仓位列表自动更新
   - 余额扣减

### 6.3 充值流程

1. 点击 "DEPOSIT" 打开弹窗
2. 输入充值金额（USDC），前端校验：金额 ≥ 1 USDC
3. 调用 USDC `approve(vault, amount)`
4. **错误处理**：
   - 用户拒绝签名：弹窗保持打开，Toast 提示 "Transaction rejected"
   - 交易失败：显示错误信息，保留输入值
   - **Gas 费不足**：检测钱包 ETH 余额，不足时提示 "Insufficient ETH for gas fee"
5. 等待 approve 确认
6. 调用 Vault `deposit(amount)`
7. **错误处理**：
   - 用户拒绝：同上处理
   - 合约 revert：显示具体错误（如 "Insufficient allowance"）
   - **Gas 费不足**：同上 Gas 费检测
8. 显示 "Pending" 状态，展示 tx hash 和区块链浏览器链接
9. **超时处理**：5 分钟后未确认，显示 "Check status manually" 按钮
10. Indexer 确认后：
    - 弹窗关闭或显示 "Confirmed"
    - 余额自动更新
    - Toast 提示 "Deposit confirmed"

### 6.4 平仓流程

1. 用户在仓位列表点击 "CLOSE"
2. 弹出确认框展示：
   - 仓位大小
   - 预计盈亏
   - 返还保证金
3. 用户确认后调用 `POST /api/trade/positions/:id/close`
4. 成功后：
   - Toast 提示盈亏
   - 仓位从列表移除
   - 余额更新

---

## 7. 技术实现

### 7.1 技术栈

| 类别 | 选型 | 版本 |
|------|------|------|
| 框架 | Next.js | 15 (App Router) |
| 语言 | TypeScript | 5+ |
| 状态管理 | Zustand | ^4.x |
| 钱包 | Reown AppKit + Wagmi | v2 |
| UI 组件 | shadcn/ui | latest |
| 样式 | Tailwind CSS | ^3.x |
| 图表 | TradingView Lightweight Charts | ^4.x |
| 表单 | React Hook Form + Zod | latest |
| WebSocket | Socket.IO Client | ^4.x |
| 数据获取 | TanStack Query (React Query) | ^5.x |

### 7.2 目录结构

```
apps/web/
├── app/
│   ├── page.tsx                 # 交易页
│   ├── assets/
│   │   └── page.tsx             # 资产页
│   ├── layout.tsx               # 根布局
│   └── globals.css              # 全局样式
├── components/
│   ├── ui/                      # shadcn/ui 组件
│   ├── layout/
│   │   └── Header.tsx           # 顶部导航
│   ├── trading/
│   │   ├── ChartSection.tsx     # K线图区域
│   │   ├── OrderForm.tsx        # 订单表单
│   │   ├── PositionTable.tsx    # 仓位列表
│   │   └── BalanceCard.tsx      # 余额卡片
│   ├── wallet/
│   │   ├── ConnectButton.tsx    # 连接按钮
│   │   └── LoginModal.tsx       # 登录弹窗
│   └── modals/
│       ├── DepositModal.tsx     # 充值弹窗
│       ├── WithdrawModal.tsx    # 提现弹窗
│       └── OrderConfirmModal.tsx # 订单确认
├── hooks/
│   ├── useAuth.ts               # 认证相关
│   ├── useBalance.ts            # 余额查询
│   ├── usePositions.ts          # 仓位查询
│   ├── useMarket.ts             # 行情数据
│   ├── useTrade.ts              # 交易操作
│   └── useWebSocket.ts          # WebSocket
├── stores/
│   ├── authStore.ts             # 认证状态
│   ├── tradingStore.ts          # 交易状态
│   └── uiStore.ts               # UI 状态
├── lib/
│   ├── api.ts                   # API 客户端
│   ├── websocket.ts             # WebSocket 封装
│   ├── constants.ts             # 常量配置
│   └── utils.ts                 # 工具函数
├── config/
│   ├── wagmi.ts                 # Wagmi 配置
│   ├── appkit.ts                # AppKit 配置
│   └── theme.ts                 # 主题配置
├── schemas/
│   ├── order.ts                 # 订单验证
│   └── auth.ts                  # 认证验证
├── types/
│   ├── api.ts                   # API 类型
│   └── trading.ts               # 交易类型
└── public/
    └── ...
```

### 7.3 关键配置

**Tailwind 自定义配置：**

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      pearl: '#F8F9FA',
      obsidian: '#0F172A',
      'tech-cyan': '#0EA5E9',
      'forest': '#059669',
      'brick': '#DC2626',
      'carbon': '#1E293B',
    },
    fontFamily: {
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
  },
}
```

**Wagmi + AppKit 配置：**

```typescript
// config/wagmi.ts
import { createConfig, http } from '@wagmi/core'
import { arbitrumSepolia } from '@wagmi/core/chains'
import { injected, walletConnect } from '@wagmi/connectors'

export const wagmiConfig = createConfig({
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
import { arbitrumSepolia } from '@reown/appkit/networks'

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

---

## 8. API 集成

### 8.1 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/challenge?address=0x...` | 获取 SIWE nonce |
| POST | `/api/auth/verify` | 验证签名，返回 JWT |

### 8.2 用户接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/balance` | 获取余额 |
| GET | `/api/user/positions` | 获取仓位列表 |
| GET | `/api/user/history` | 获取历史订单 |
| POST | `/api/user/withdraw` | 发起提现 |

### 8.3 交易接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/trade/order` | 开仓 |
| POST | `/api/trade/positions/:id/close` | 平仓 |

### 8.4 行情接口 (Hyperliquid)

**K 线数据获取：**

```typescript
// lib/hyperliquid.ts
const HYPERLIQUID_API = 'https://api.hyperliquid-testnet.xyz'

interface CandleData {
  t: number      // 开盘时间 (ms)
  T: number      // 收盘时间 (ms)
  s: string      // 交易对 (e.g., "BTC")
  o: string      // 开盘价
  c: string      // 收盘价
  h: string      // 最高价
  l: string      // 最低价
  v: string      // 成交量
}

// 获取历史 K 线
async function getCandles(
  symbol: string,
  interval: '1m' | '15m' | '1h' | '4h' | '1d',
  startTime?: number,
  endTime?: number
): Promise<CandleData[]>

// 获取当前标记价格
async function getMarkPrice(symbol: string): Promise<string>
```

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/info` | 查询 K 线数据 |
| POST | `/info` | 查询当前价格 |

**错误处理：**
- API 超时：3 秒超时，重试 2 次
- 数据解析错误：使用本地缓存数据
- 服务不可用：显示 "Data unavailable"，使用上次有效价格

**Rate Limiting：**
- Hyperliquid Testnet 限制：120 请求/分钟
- 前端实现请求队列，超限后延迟重试
- 使用指数退避策略：1s → 2s → 4s → 8s

---

## 9. WebSocket 集成

### 9.1 连接方式

```typescript
// Socket.IO 连接
const socket = io(WS_URL, {
  auth: { token: jwtToken },
  transports: ['websocket', 'polling'],
})
```

### 9.2 事件订阅

| 订阅 | 事件 | 数据 |
|------|------|------|
| `subscribe:market:BTC` | `market:BTC:update` | 价格更新 { price, timestamp } |
| `subscribe:position` | `position:update` | 仓位 PnL 更新 { positionId, pnl, markPrice } |

### 9.3 断线重连与状态同步

**重连机制：**
- 自动重连：指数退避 1s → 2s → 4s → 8s（最大 30s）
- 最大重试次数：10 次，之后显示 "Connection lost" 提示

**状态同步：**
- 重连成功后自动重新订阅之前的频道
- 获取断线期间的数据快照：
  - 价格数据：调用 REST API 获取最新价格
  - 仓位数据：调用 `/api/user/positions` 刷新
- 数据合并策略：使用服务器时间戳，避免重复处理

**连接状态指示器：**
- 顶部导航栏显示连接状态圆点
- 绿色 = 已连接，黄色 = 重连中，红色 = 已断开

---

## 10. 错误处理

### 10.1 错误展示方式

- **表单错误**：字段下方红色文字提示
- **操作错误**：Toast 提示（成功=绿色，错误=红色，警告=橙色）
- **全局错误**：顶部 Banner（如连接断开）

### 10.2 表单验证规则

| 字段 | 规则 | 错误提示 |
|------|------|----------|
| 保证金 | ≥ 1 USDC，≤ available_balance | "Minimum 1 USDC" / "Insufficient balance" |
| 杠杆 | 1x - 20x 整数 | "Leverage must be between 1x and 20x" |
| 提现金额 | ≥ 1 USDC，≤ available_balance | 同保证金规则 |

### 10.3 常见错误场景

| 错误 | 处理方式 |
|------|----------|
| 余额不足 | 订单表单显示错误，禁用提交 |
| 网络错误 | Toast 提示重试 |
| 签名拒绝 | 登录弹窗保持打开，提示用户 |
| 链上失败 | 充值/提现弹窗显示失败状态 |

---

## 11. 加载状态规范

| 场景 | 加载状态 |
|------|----------|
| 页面初始加载 | Skeleton 骨架屏，保持布局结构 |
| 数据刷新 | Spinner 覆盖卡片右上角 |
| 按钮提交 | 按钮内显示 Spinner，禁用点击 |
| 链上交易 | 进度条 + 状态文字（Pending → Confirming → Confirmed） |

**Spinner 样式：**
- 颜色：科技青 #0EA5E9
- 大小：小(16px) / 中(24px) / 大(32px)

---

## 12. 移动端适配

### 12.1 断点规则

| 断点 | 宽度 | 布局调整 |
|------|------|----------|
| Desktop | ≥ 1280px | 完整两栏布局 |
| Tablet | 768px - 1279px | 右侧面板收窄至 260px |
| Mobile | < 768px | 单栏布局，底部固定交易面板 |

### 12.2 Mobile 布局

```
┌─────────────────────────┐
│ [PERPDEX_]  0x7a8b...   │
├─────────────────────────┤
│  BTC/USDC  $67,245 ▲2%  │
├─────────────────────────┤
│                         │
│      K线图区域           │
│                         │
├─────────────────────────┤
│  仓位列表 (可折叠)        │
├─────────────────────────┤
│ [开仓面板 - 底部固定]     │
│ LONG | SHORT            │
│ MARGIN: [____]  LEVERAGE│
│ [OPEN POSITION]         │
└─────────────────────────┘
```

### 12.3 交互调整

- 交易面板底部固定，可滑动展开
- 仓位列表可折叠
- K 线图支持手势缩放

---

## 13. 性能优化

- **图表懒加载**：TradingView 组件动态导入
- **数据缓存**：React Query 缓存 API 响应
- **WebSocket 重连**：自动重连，指数退避
- **组件懒加载**：弹窗组件动态导入

---

## 14. 验收标准

- [ ] 所有页面和弹窗按设计实现
- [ ] 配色严格遵循 Pro Light 规范
- [ ] SIWE 登录流程完整可用
- [ ] 充值/提现流程完整可用（含错误处理）
- [ ] 开平仓功能完整可用
- [ ] 实时价格更新正常
- [ ] 仓位 PnL 实时更新
- [ ] 移动端响应式适配
- [ ] 表单验证完整
- [ ] 加载状态规范统一

---

**文档变更记录：**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-03-12 | 前端团队 | 初始版本，Pro Light 设计 |
| 1.1 | 2026-03-12 | 前端团队 | 修复 Review 问题：平仓接口改为 POST、补充充值错误处理、移除 RootLayout.tsx、补充 Hyperliquid API 配置、统一 WebSocket 事件命名、添加 VIEW CALCULATION 说明、补充表单验证和加载状态规范 |
| 1.2 | 2026-03-12 | 前端团队 | 添加 Review 建议：Gas 费不足错误处理、Hyperliquid rate limiting、WebSocket 断线重连状态同步、连接状态指示器 |
