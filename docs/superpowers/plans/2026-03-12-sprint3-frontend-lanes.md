# Sprint 3 前端开发任务分配

> 文档版本：1.0
> 更新日期：2026-03-12
> 状态：Ready for Implementation

---

## 1. Sprint 3 概述

### 1.1 目标
完成 PerpDex MVP 前端核心功能开发，实现完整的交易闭环：
`Wallet Login -> Deposit -> Trade -> Position -> Withdraw`

### 1.2 关键路径

```
泳道E（基础设施）→ 解锁 → 泳道F/G/H（并行）
     ↓
   泳道E 完成后，F/G/H 同时启动
```

### 1.3 团队分工

| 成员 | 泳道 | 职责 | 依赖 |
|------|------|------|------|
| fe-dev-e | 泳道E | 基础设施 | 无（可立即开始） |
| fe-dev-f | 泳道F | 交易核心 | 泳道E |
| fe-dev-g | 泳道G | 仓位管理 | 泳道E |
| fe-dev-h | 泳道H | 资产页面 | 泳道E |

---

## 2. 泳道E - 基础设施 (fe-dev-e)

**状态**: 待启动
**优先级**: P0（阻塞级）
**预计工期**: 2-3 天

### 2.1 任务清单

#### E1: 项目初始化与依赖安装
- [ ] 安装核心依赖
  - wagmi, viem, @reown/appkit
  - @tanstack/react-query
  - zustand
  - react-hook-form, zod
  - @hookform/resolvers
  - lightweight-charts
  - socket.io-client
  - sonner (Toast)
- [ ] 安装 shadcn/ui 基础组件
  - button, input, dialog, select, slider, tabs, table, card, label, skeleton
- [ ] 配置 Tailwind 自定义主题色

#### E2: 目录结构搭建
```
apps/web/
├── app/
│   ├── page.tsx                 # 交易页
│   ├── assets/page.tsx          # 资产页
│   ├── layout.tsx               # 根布局
│   └── globals.css              # 全局样式
├── components/
│   ├── ui/                      # shadcn/ui 组件
│   ├── layout/Header.tsx        # 顶部导航
│   ├── trading/                 # 交易相关组件
│   ├── wallet/                  # 钱包相关组件
│   └── modals/                  # 弹窗组件
├── hooks/                       # 自定义 Hooks
├── stores/                      # Zustand 状态管理
├── lib/                         # 工具函数和 API 客户端
├── config/                      # 配置文件
├── schemas/                     # Zod 验证 schema
└── types/                       # TypeScript 类型定义
```

#### E3: 核心配置
- [ ] Tailwind 配置（Pro Light 主题色）
- [ ] Wagmi + AppKit 配置
- [ ] API 客户端封装（axios/fetch + 拦截器）
- [ ] WebSocket 客户端封装
- [ ] 常量定义（合约地址、配置参数）

#### E4: 共享类型与 Schema
- [ ] API 类型定义（与后端对齐）
- [ ] 交易相关类型
- [ ] Zod 验证 Schema
  - 订单表单验证
  - 充值/提现验证
  - 登录验证

#### E5: 基础组件
- [ ] Header 组件（导航 + 连接按钮）
- [ ] ConnectButton 组件
- [ ] LoginModal 组件（SIWE 流程）
- [ ] 全局 Toast 配置

### 2.2 验收标准
- [ ] 项目能正常启动（pnpm dev）
- [ ] 所有依赖安装完成无冲突
- [ ] Tailwind 自定义颜色可用
- [ ] 钱包连接按钮可显示
- [ ] 类型定义与后端 API 文档一致

### 2.3 接口契约

**需要与后端对齐的接口**:
- `GET /api/auth/challenge?address={address}`
- `POST /api/auth/verify`
- `GET /api/user/balance`
- `GET /api/user/positions`
- `POST /api/trade/order`
- `POST /api/trade/positions/:id/close`

**枚举值规范**（必须使用大写）:
```typescript
enum OrderSide {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

enum OrderStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED'
}

enum PositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}
```

---

## 3. 泳道F - 交易核心 (fe-dev-f)

**状态**: 等待泳道E完成
**优先级**: P1
**预计工期**: 3-4 天
**前置依赖**: 泳道E

### 3.1 任务清单

#### F1: K线图区域 (ChartSection)
- [ ] TradingView Lightweight Charts 集成
- [ ] 时间周期选择器（1m, 15m, 1h, 4h, 1d）
- [ ] 顶部信息栏（交易对、价格、涨跌幅）
- [ ] 24H 统计数据（HIGH/LOW/VOL）
- [ ] Hyperliquid API 数据获取封装

#### F2: 订单表单 (OrderForm)
- [ ] 多空切换按钮（LONG/SHORT）
- [ ] 保证金输入框（带 USDC 单位）
- [ ] 杠杆滑块（1x-20x）
- [ ] 杠杆快捷按钮（1x, 5x, 10x, 20x）
- [ ] 实时计算显示：
  - Position Size = Margin × Leverage / Mark Price
  - Liquidation Price
  - Fee (0.05%)
- [ ] VIEW CALCULATION 展开/收起
- [ ] 表单验证（Zod + React Hook Form）

#### F3: 订单确认弹窗 (OrderConfirmModal)
- [ ] 订单详情展示
- [ ] 确认/取消按钮
- [ ] 提交后状态反馈

#### F4: 交易 Hook
- [ ] useMarket - 行情数据获取
- [ ] useTrade - 开仓/平仓操作
- [ ] useOrderCalculation - 订单计算逻辑

### 3.2 验收标准
- [ ] K线图能正常显示历史数据
- [ ] 订单表单能实时计算仓位大小和清算价格
- [ ] 表单验证能阻止无效输入
- [ ] 开仓 API 调用成功
- [ ] 错误处理符合规范

### 3.3 接口依赖
- Hyperliquid API: `POST /info`（K线数据）
- Backend API: `POST /api/trade/order`

---

## 4. 泳道G - 仓位管理 (fe-dev-g)

**状态**: 等待泳道E完成
**优先级**: P1
**预计工期**: 2-3 天
**前置依赖**: 泳道E

### 4.1 任务清单

#### G1: 仓位列表 (PositionTable)
- [ ] 表格组件（PAIR, SIDE, SIZE, ENTRY/MARK, PNL, ACTION）
- [ ] SIDE 标签样式（LONG=绿色，SHORT=红色）
- [ ] PNL 颜色（正=绿色，负=红色）
- [ ] CLOSE 按钮（红色）
- [ ] 空状态展示

#### G2: 平仓确认弹窗
- [ ] 仓位详情展示
- [ ] 预计盈亏显示
- [ ] 返还保证金显示
- [ ] 确认/取消按钮

#### G3: 仓位相关 Hook
- [ ] usePositions - 获取仓位列表
- [ ] usePositionUpdates - WebSocket 仓位更新

#### G4: WebSocket 集成
- [ ] 连接 Socket.IO
- [ ] 订阅仓位更新事件
- [ ] 断线重连处理

### 4.2 验收标准
- [ ] 仓位列表能正确显示数据
- [ ] PNL 颜色根据正负正确显示
- [ ] 平仓按钮能触发确认弹窗
- [ ] 平仓 API 调用成功
- [ ] WebSocket 能实时更新仓位 PNL

### 4.3 接口依赖
- Backend API: `GET /api/user/positions`
- Backend API: `POST /api/trade/positions/:id/close`
- WebSocket: `position:update` 事件

---

## 5. 泳道H - 资产页面 (fe-dev-h)

**状态**: 等待泳道E完成
**优先级**: P1
**预计工期**: 3-4 天
**前置依赖**: 泳道E

### 5.1 任务清单

#### H1: 余额卡片 (BalanceCard)
- [ ] 可用余额显示
- [ ] DEPOSIT 按钮
- [ ] WITHDRAW 按钮

#### H2: 充值弹窗 (DepositModal)
- [ ] 金额输入框
- [ ] 表单验证（≥ 1 USDC）
- [ ] USDC approve 流程
- [ ] Vault deposit 流程
- [ ] 交易状态显示（Pending → Confirming → Confirmed）
- [ ] 错误处理：
  - 用户拒绝签名
  - Gas 费不足检测
  - 合约 revert
- [ ] 超时处理（5分钟）

#### H3: 提现弹窗 (WithdrawModal)
- [ ] 金额输入框
- [ ] 表单验证（≥ 1 USDC，≤ available）
- [ ] 提现请求提交
- [ ] 状态跟踪

#### H4: 资产页面 (Assets Page)
- [ ] 余额详情展示
- [ ] 充值/提现历史列表
- [ ] 交易哈希链接

#### H5: 资产相关 Hook
- [ ] useBalance - 余额查询
- [ ] useDeposit - 充值操作
- [ ] useWithdraw - 提现操作

### 5.2 验收标准
- [ ] 余额能正确显示
- [ ] 充值流程完整可用（含 approve）
- [ ] 错误处理符合规范
- [ ] 交易状态能正确显示
- [ ] 资产页面能展示历史记录

### 5.3 接口依赖
- Backend API: `GET /api/user/balance`
- Contract: USDC `approve`
- Contract: Vault `deposit`
- Backend API: `POST /api/user/withdraw`

---

## 6. 技术规范

### 6.1 表单验证规范

使用 **Zod** 进行表单验证，**React Hook Form** 管理表单状态：

```typescript
// schemas/order.ts
import { z } from 'zod'

export const orderSchema = z.object({
  margin: z.number()
    .min(1, 'Minimum 1 USDC')
    .refine(val => val <= availableBalance, 'Insufficient balance'),
  leverage: z.number()
    .min(1, 'Minimum 1x')
    .max(20, 'Maximum 20x')
    .int('Leverage must be integer'),
  side: z.enum(['LONG', 'SHORT'])
})

export type OrderFormData = z.infer<typeof orderSchema>
```

### 6.2 组件规范

- 使用函数式组件 + Hooks
- Props 使用 TypeScript 接口定义
- 组件文件不超过 400 行
- 复杂逻辑抽取到自定义 Hook

### 6.3 状态管理规范

- 全局状态使用 Zustand
- 服务端状态使用 React Query
- 表单状态使用 React Hook Form

### 6.4 错误处理规范

- 表单错误：字段下方红色文字
- 操作错误：Toast 提示
- 全局错误：顶部 Banner

### 6.5 枚举值规范

**必须使用大写**，与后端保持一致：

```typescript
// 正确
enum OrderSide {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

// 错误
enum OrderSide {
  Long = 'Long',
  Short = 'Short'
}
```

---

## 7. 进度跟踪

### 7.1 每日站会检查项

1. 泳道E进度（是否阻塞其他泳道）
2. F/G/H 是否可启动
3. 跨泳道接口对齐问题
4. 阻塞和风险点

### 7.2 状态流转

```
Todo → In Progress → In Review → Done
         ↓
      Blocked
```

### 7.3 当前状态

| 泳道 | 负责人 | 状态 | 进度 | 阻塞项 |
|------|--------|------|------|--------|
| E | fe-dev-e | 待启动 | 0% | 无 |
| F | fe-dev-f | 等待中 | 0% | 泳道E |
| G | fe-dev-g | 等待中 | 0% | 泳道E |
| H | fe-dev-h | 等待中 | 0% | 泳道E |

---

## 8. 风险提示

1. **泳道E阻塞风险**: 如果基础设施延期，整个 Sprint 将延期
2. **接口变更风险**: 后端 API 变更需及时同步
3. **合约集成风险**: 充值流程依赖合约 ABI，需提前确认
4. **WebSocket 稳定性**: 断线重连逻辑需充分测试

---

## 9. 立即行动

### 给 fe-dev-e 的通知

> 你负责泳道E（基础设施），这是 P0 阻塞级任务。
>
> **立即开始以下工作**：
> 1. 安装所有依赖（ wagmi, appkit, react-query, zustand, react-hook-form, zod, lightweight-charts, socket.io-client ）
> 2. 安装 shadcn/ui 基础组件
> 3. 配置 Tailwind 主题色
> 4. 搭建目录结构
> 5. 配置 Wagmi + AppKit
>
> **完成后通知我**，我将解锁 F/G/H 泳道。

### 给 fe-dev-f/g/h 的通知

> 你们分别负责泳道F（交易核心）、泳道G（仓位管理）、泳道H（资产页面）。
>
> **当前状态**: 等待泳道E完成
> **请提前准备**：
> - 熟悉前端设计文档：`/docs/superpowers/specs/2026-03-12-frontend-design.md`
> - 熟悉 API 接口定义（与后端对齐）
> - 准备开发环境
>
> **泳道E完成后，我会立即通知你们启动开发**。

---

**文档变更记录：**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-03-12 | 前端 Leader | 初始版本，Sprint 3 任务分配 |
