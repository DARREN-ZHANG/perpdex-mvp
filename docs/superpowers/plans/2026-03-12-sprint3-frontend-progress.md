# Sprint 3 前端开发进度看板

> 更新日期：2026-03-12
> 状态：Sprint 启动

---

## 1. 总体进度

```
Sprint 3 进度: [░░░░░░░░░░] 0%

关键路径: 泳道E → 解锁 → 泳道F/G/H
              ↑
         当前在这里
```

---

## 2. 各泳道进度

### 泳道E - 基础设施 (fe-dev-e)

**状态**: 🔵 待启动
**进度**: 0%
**优先级**: P0（阻塞级）
**预计完成**: 2026-03-15

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| E1: 依赖安装 | 🔵 Todo | fe-dev-e | wagmi, appkit, react-query, zustand, rhf, zod, charts, socket.io |
| E2: 目录结构 | 🔵 Todo | fe-dev-e | 按设计文档创建 |
| E3: 核心配置 | 🔵 Todo | fe-dev-e | Tailwind, Wagmi, API, WebSocket |
| E4: 类型与Schema | 🔵 Todo | fe-dev-e | 与后端对齐 |
| E5: 基础组件 | 🔵 Todo | fe-dev-e | Header, ConnectButton, LoginModal |

**今日目标**: 启动 E1, E2

---

### 泳道F - 交易核心 (fe-dev-f)

**状态**: ⏸️ 等待中
**进度**: 0%
**优先级**: P1
**预计完成**: 2026-03-19
**前置依赖**: 泳道E完成

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| F1: K线图区域 | ⏸️ 等待 | fe-dev-f | TradingView Lightweight Charts |
| F2: 订单表单 | ⏸️ 等待 | fe-dev-f | 含实时计算 |
| F3: 订单确认弹窗 | ⏸️ 等待 | fe-dev-f | - |
| F4: 交易 Hook | ⏸️ 等待 | fe-dev-f | useMarket, useTrade |

**解锁条件**: 泳道E完成

---

### 泳道G - 仓位管理 (fe-dev-g)

**状态**: ⏸️ 等待中
**进度**: 0%
**优先级**: P1
**预计完成**: 2026-03-18
**前置依赖**: 泳道E完成

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| G1: 仓位列表 | ⏸️ 等待 | fe-dev-g | PositionTable 组件 |
| G2: 平仓确认弹窗 | ⏸️ 等待 | fe-dev-g | - |
| G3: 仓位相关 Hook | ⏸️ 等待 | fe-dev-g | usePositions |
| G4: WebSocket 集成 | ⏸️ 等待 | fe-dev-g | 实时 PnL 更新 |

**解锁条件**: 泳道E完成

---

### 泳道H - 资产页面 (fe-dev-h)

**状态**: ⏸️ 等待中
**进度**: 0%
**优先级**: P1
**预计完成**: 2026-03-19
**前置依赖**: 泳道E完成

| 任务 | 状态 | 负责人 | 备注 |
|------|------|--------|------|
| H1: 余额卡片 | ⏸️ 等待 | fe-dev-h | BalanceCard |
| H2: 充值弹窗 | ⏸️ 等待 | fe-dev-h | 含 approve + deposit |
| H3: 提现弹窗 | ⏸️ 等待 | fe-dev-h | - |
| H4: 资产页面 | ⏸️ 等待 | fe-dev-h | 余额 + 历史 |
| H5: 资产相关 Hook | ⏸️ 等待 | fe-dev-h | useBalance, useDeposit |

**解锁条件**: 泳道E完成

---

## 3. 阻塞项跟踪

| 阻塞项 | 影响泳道 | 状态 | 预计解决 |
|--------|----------|------|----------|
| 泳道E未完成 | F, G, H | 🔴 活跃 | 2026-03-15 |

---

## 4. 接口对齐状态

| 接口 | 状态 | 对齐人 | 备注 |
|------|------|--------|------|
| `GET /api/auth/challenge` | 🟡 待确认 | fe-dev-e | 需与后端确认参数 |
| `POST /api/auth/verify` | 🟡 待确认 | fe-dev-e | 需与后端确认 payload |
| `GET /api/user/balance` | 🟡 待确认 | fe-dev-e | 需与后端确认响应格式 |
| `GET /api/user/positions` | 🟡 待确认 | fe-dev-e | 需与后端确认响应格式 |
| `POST /api/trade/order` | 🟡 待确认 | fe-dev-e | 需与后端确认 payload |
| `POST /api/trade/positions/:id/close` | 🟡 待确认 | fe-dev-e | 需与后端确认接口 |

---

## 5. 每日站会记录

### 2026-03-12 (Sprint 启动日)

**昨日完成**: N/A（Sprint 启动）

**今日计划**:
- fe-dev-e: 启动泳道E，完成依赖安装和目录结构
- fe-dev-f/g/h: 熟悉设计文档，准备开发环境

**阻塞项**:
- 无

**风险提醒**:
- 泳道E是阻塞级任务，需优先保证进度

---

## 6. 下一步行动

1. **fe-dev-e**: 立即开始 E1, E2 任务
2. **fe-dev-f/g/h**: 阅读设计文档，准备开发环境
3. **Leader**: 每日检查泳道E进度，准备解锁 F/G/H

---

**图例说明**:
- 🔵 Todo - 待开始
- 🟡 In Progress - 进行中
- 🟠 In Review - 审核中
- 🟢 Done - 已完成
- ⏸️ 等待 - 被依赖阻塞
- 🔴 阻塞 - 有阻塞问题
