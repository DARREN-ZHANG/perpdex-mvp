# PerpDex MVP 项目架构设计文档

> 文档版本：1.3
> 更新日期：2026-03-11
> 作者：技术团队
> 状态：✅ 已确认

---

## 1. 项目概述

### 1.1 项目目标

构建一个最小可运行的永续合约交易系统，完成以下闭环：

```
Wallet Login -> Deposit -> Trade -> Position -> Hedge -> Withdraw
```

**核心价值：**

- 用户可以用钱包直接登录并交易
- 用户资金通过链上 Vault 托管
- 平台内部维护保证金与仓位账本
- 用户成交后，系统自动在 Hyperliquid Testnet 对冲风险

### 1.2 核心业务流程

```mermaid
graph LR
    A[钱包登录] --> B[充值 USDC]
    B --> C[市价开仓]
    C --> D[仓位管理]
    D --> E[平仓结算]
    E --> F[提现]
    C --> G[自动对冲]
    E --> G
```

---

## 2. 系统架构图

```mermaid
graph TB
    subgraph "Client Layer"
        FE[Frontend<br/>Next.js 15]
        WALLET[Wallet<br/>MetaMask]
    end

    subgraph "API Layer"
        API[Backend API<br/>Fastify]
        WS[Socket.IO Server<br/>Real-time]
    end

    subgraph "Core Services"
        TRADE[Trade Engine<br/>交易引擎]
        INDEXER[Blockchain Indexer<br/>链上事件监听]
        LIQUIDATION[Liquidation Service<br/>清算服务]
    end

    subgraph "Job Queue Layer"
        QUEUE[BullMQ<br/>持久化任务队列]
        HEDGE_WORKER[Hedge Worker<br/>对冲执行器]
    end

    subgraph "External Services"
        HYPER[Hyperliquid API<br/>Testnet]
        CHAIN[EVM Chain<br/>Arbitrum Sepolia]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL<br/>Prisma)]
        REDIS[(Redis<br/>Cache + Queue)]
    end

    subgraph "Smart Contracts"
        VAULT[Vault Contract<br/>Foundry]
        USDC[USDC Token]
    end

    FE -->|REST/Socket.IO| API
    FE -->|Wallet Connect| WALLET
    WALLET -->|Sign/Verify| API
    WALLET -->|deposit/withdraw| VAULT
    WALLET -->|approve| USDC

    API --> DB
    API --> REDIS
    API --> TRADE
    API --> WS

    TRADE --> DB
    TRADE -->|创建对冲任务| QUEUE

    INDEXER -->|Watch Events| VAULT
    INDEXER -->|Update Balance| DB

    QUEUE -->|Redis| REDIS
    HEDGE_WORKER -->|消费任务| QUEUE
    HEDGE_WORKER -->|Submit Orders| HYPER
    HEDGE_WORKER -->|更新状态| DB

    LIQUIDATION -->|Check Positions| DB
    LIQUIDATION --> TRADE
    LIQUIDATION -->|创建清算对冲| QUEUE

    API -->|viem| CHAIN
    VAULT --> CHAIN
```

---

## 3. 模块职责说明

### 3.1 Frontend（前端）

**技术栈：** Next.js 15 / TypeScript / Zustand / Reown AppKit / Wagmi v2 / shadcn/ui / Tailwind CSS / Socket.IO Client

**职责：**

| 职责 | 说明 |
|------|------|
| 钱包连接 | MetaMask 等 EVM 钱包连接，SIWE 登录流程 |
| 行情展示 | K 线图表、实时价格、深度数据（通过 WebSocket） |
| 交易界面 | 开多/开空表单、杠杆/保证金输入、订单确认 |
| 仓位管理 | 仓位列表、PnL 展示、平仓操作 |
| 资产管理 | 余额展示、充值/提现操作、历史记录 |

### 3.2 Backend API（后端 API）

**技术栈：** Fastify / Node.js 20 LTS / TypeScript / Prisma / Redis / Zod / Pino

**职责：**

| 职责 | 说明 |
|------|------|
| 鉴权服务 | SIWE challenge 生成、签名验证、JWT 颁发 |
| 用户数据 | 余额查询、仓位查询、历史记录 |
| 交易接口 | 开仓、平仓、保证金调整 |
| 行情服务 | 价格数据聚合、WebSocket 推送 |
| 业务校验 | 余额检查、风险检查、参数验证 |

### 3.3 Trade Engine（交易引擎）

**技术栈：** TypeScript / 定时任务

**职责：**

| 职责 | 说明 |
|------|------|
| 订单执行 | 市价单撮合、价格确定 |
| 仓位维护 | 仓位创建、更新、平仓 |
| 盈亏计算 | 未实现盈亏、已实现盈亏 |
| 保证金管理 | 锁定、释放、追加 |
| 清算触发 | 风险检测、强平执行 |

### 3.4 Vault Smart Contract（智能合约）

**技术栈：** Solidity / Foundry

**职责：**

| 职责 | 说明 |
|------|------|
| 资金托管 | USDC 存入与提取 |
| 事件发射 | Deposit/Withdraw 事件 |
| 权限控制 | Owner 权限、Pausable |
| 安全防护 | ReentrancyGuard |

### 3.5 Blockchain Indexer（链上事件监听）

**技术栈：** viem / Node.js

**职责：**

| 职责 | 说明 |
|------|------|
| 事件监听 | 监听 Vault 合约 Deposit/Withdraw 事件 |
| 余额同步 | 根据链上事件更新数据库余额 |
| 幂等处理 | 防止重复处理同一事件 |
| 状态追踪 | 充值/提现状态更新 |

### 3.6 Job Queue（持久化任务队列）

**技术栈：** BullMQ / Redis

**职责：**

| 职责 | 说明 |
|------|------|
| 任务持久化 | 对冲任务、清算任务持久化存储，进程重启不丢失 |
| 重试机制 | 内置指数退避重试，失败任务自动重试 |
| 死信队列 | 永久失败的任务进入 DLQ，便于人工处理 |
| 任务优先级 | 清算任务优先级高于普通对冲任务 |
| 状态追踪 | 任务状态：pending → processing → completed/failed |

### 3.7 Hedge Worker（对冲执行器）

**技术栈：** TypeScript / BullMQ Worker / Hyperliquid API

**职责：**

| 职责 | 说明 |
|------|------|
| 对冲执行 | 消费队列任务，向 Hyperliquid 提交反向订单 |
| 状态更新 | 更新数据库中对冲任务的状态和结果 |
| 错误处理 | 区分可重试错误（网络超时）和不可重试错误（参数错误） |
| 结果记录 | 记录外部订单 ID、执行价格、失败原因 |

### 3.8 Database（数据库）

**技术栈：** PostgreSQL / Prisma ORM

**职责：**

| 职责 | 说明 |
|------|------|
| 用户数据 | 用户信息、nonce、session |
| 账户余额 | available_balance、locked_balance、equity |
| 订单记录 | 订单历史、执行价格、状态 |
| 仓位数据 | position_size、entry_price、PnL |
| 对冲记录 | 对冲任务、外部订单 ID、重试状态 |

### 3.9 Redis Cache + Queue（缓存与队列）

**技术栈：** Redis

**职责：**

| 职责 | 说明 |
|------|------|
| Session 存储 | JWT 黑名单、session 缓存 |
| 价格缓存 | 实时价格、K 线数据 |
| 限流 | API 请求限流 |
| 分布式锁 | 并发控制 |
| **任务队列** | BullMQ 任务队列存储，持久化任务数据 |
| **队列状态** | 任务执行状态、重试计数、死信队列 |

---

## 4. 模块间通信方式

### 4.1 前端 ↔ 后端 API

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as Backend API

    Note over FE,API: REST API
    FE->>API: GET /api/auth/challenge
    API-->>FE: { nonce, message }
    FE->>API: POST /api/auth/verify
    API-->>FE: { token, user }

    FE->>API: GET /api/user/balance (Authorization: Bearer token)
    API-->>FE: { available, locked, equity }

    FE->>API: POST /api/trade/order
    API-->>FE: { order, position }

    Note over FE,API: Socket.IO
    FE->>API: connect + auth token
    API-->>FE: connected
    FE->>API: emit subscribe:market { symbol: BTC }
    API-->>FE: emit market:BTC:update { price, timestamp }
    FE->>API: emit subscribe:position { userId }
    API-->>FE: emit position:{userId}:update { pnl }
```

### 4.2 后端 ↔ 数据库

```mermaid
flowchart LR
    subgraph Backend
        API[API Server]
        TRADE[Trade Engine]
        INDEXER[Indexer]
    end

    subgraph Database
        PRISMA[Prisma ORM]
        PG[(PostgreSQL)]
    end

    API -->|Query/Mutation| PRISMA
    TRADE -->|Transaction| PRISMA
    INDEXER -->|Upsert| PRISMA
    PRISMA --> PG
```

**关键操作：**

- 余额更新：事务操作，保证原子性
- 仓位创建：事务内完成余额锁定 + 仓位写入
- 事件处理：幂等 upsert，防止重复记账

### 4.3 后端 ↔ 区块链

```mermaid
sequenceDiagram
    participant API as Backend
    participant VIEM as viem
    participant CHAIN as EVM Chain
    participant VAULT as Vault Contract

    Note over API,VAULT: 读取链上数据
    API->>VIEM: getContractEvents
    VIEM->>CHAIN: eth_getLogs
    CHAIN-->>VIEM: [Deposit, Withdraw]
    VIEM-->>API: parsed events

    Note over API,VAULT: 提现执行
    API->>VIEM: writeContract(withdraw)
    VIEM->>VAULT: withdraw(user, amount)
    VAULT-->>CHAIN: emit Withdraw
```

### 4.4 后端 ↔ Hyperliquid

```mermaid
sequenceDiagram
    participant TRADE as Trade Engine
    participant HEDGE as Hedging Bot
    participant API as Hyperliquid API

    TRADE->>HEDGE: 创建对冲任务
    HEDGE->>API: POST /order (market order)
    API-->>HEDGE: { orderId, status }

    loop 轮询状态
        HEDGE->>API: GET /order/{orderId}
        API-->>HEDGE: { status: filled }
    end

    HEDGE->>TRADE: 更新对冲状态
```

### 4.5 Indexer 处理流程

```mermaid
flowchart TB
    START[启动 Indexer] --> INIT[初始化 viem Client]
    INIT --> GET[获取起始 Block]
    GET --> FILTER[创建 Event Filter]

    FILTER --> LOOP{循环监听}
    LOOP --> |new events| PARSE[解析事件]
    PARSE --> |Deposit| DEPOSIT[处理充值]
    PARSE --> |Withdraw| WITHDRAW[处理提现]

    DEPOSIT --> IDEMPOTENT{幂等检查}
    WITHDRAW --> IDEMPOTENT

    IDEMPOTENT --> |已处理| SKIP[跳过]
    IDEMPOTENT --> |未处理| DB[更新数据库]
    DB --> LOG[记录日志]

    SKIP --> LOOP
    LOG --> LOOP
```

---

## 5. 技术栈清单

### 5.1 前端技术栈

| 类别 | 技术选型 | 版本 |
|------|---------|------|
| 框架 | Next.js (App Router) | 15 |
| 语言 | TypeScript | 5+ |
| 状态管理 | Zustand | ^4.x |
| 钱包连接 | Reown AppKit + Wagmi | v2 |
| UI 组件 | shadcn/ui | latest |
| 样式 | Tailwind CSS | ^3.x |
| 图表 | TradingView Lightweight Charts | ^4.x |
| 表单 | React Hook Form + Zod | latest |
| 实时通信 | Socket.IO Client | ^4.x |
| HTTP 客户端 | fetch / ky | - |

### 5.2 后端技术栈

| 类别 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| 运行时 | Node.js | 20 LTS | - |
| 框架 | Fastify | ^4.x | - |
| 语言 | TypeScript | 5+ | - |
| ORM | Prisma | ^5.x | - |
| 数据库 | PostgreSQL | 15+ | - |
| 缓存 | Redis | 7+ | 缓存 + 队列存储 |
| WebSocket | Socket.IO | ^4.x | 实时推送 |
| 区块链交互 | viem | ^2.x | - |
| 验证 | Zod | ^3.x | - |
| 日志 | Pino | ^8.x | - |
| **持久化队列** | **BullMQ** | **^5.x** | **对冲/清算任务队列** |
| 巡检调度 | node-cron | ^3.x | 清算检查、对账任务 |

### 5.3 测试技术栈

| 类别 | 技术选型 | 用途 |
|------|---------|------|
| 单元测试 | Vitest | 后端逻辑、工具函数、PnL 计算 |
| 集成测试 | Supertest + Vitest | API 接口、数据库操作 |
| 合约测试 | Foundry | Vault 合约测试（Fuzz + 单元） |
| API Mock | MSW | 前端开发 Mock、Hyperliquid API Mock |
| 覆盖率 | Vitest v8 | 代码覆盖率统计 |

### 5.4 智能合约技术栈

| 类别 | 技术选型 |
|------|---------|
| 语言 | Solidity ^0.8.x |
| 开发框架 | Foundry |
| 测试框架 | Forge |
| 部署脚本 | Forge Script |

### 5.5 基础设施

| 类别 | MVP 阶段方案 |
|------|-------------|
| 托管 | 单机部署 / Railway / Render |
| 数据库 | Managed PostgreSQL |
| 缓存 | Redis Cloud / 自建 |
| 区块链网络 | Arbitrum Sepolia |
| 外部 API | Hyperliquid Testnet API |
| 监控 | 基础日志 + 健康检查 |

---

## 6. 数据流图

### 6.1 登录流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Frontend
    participant API as Backend
    participant WALLET as MetaMask
    participant DB as Database

    U->>FE: 点击连接钱包
    FE->>WALLET: request accounts
    WALLET-->>FE: address

    FE->>API: GET /api/auth/challenge?address=0x...
    API->>DB: 生成 nonce，记录过期时间
    API-->>FE: { message: "Sign in with Ethereum..." }

    FE->>WALLET: signMessage(message)
    WALLET-->>FE: signature

    FE->>API: POST /api/auth/verify { message, signature }
    API->>API: 验证签名、nonce、时效
    API->>DB: 更新 nonce 状态
    API-->>FE: { token, user }

    FE->>FE: 存储 token
```

### 6.2 充值流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Frontend
    participant WALLET as MetaMask
    participant USDC as USDC Contract
    participant VAULT as Vault Contract
    participant INDEXER as Indexer
    participant DB as Database

    U->>FE: 输入充值金额
    FE->>FE: 验证金额 >= 1 USDC

    FE->>WALLET: approve(USDC, Vault, amount)
    WALLET->>USDC: approve
    USDC-->>WALLET: tx hash
    FE->>FE: 等待 approve 确认

    FE->>WALLET: deposit(Vault, amount)
    WALLET->>VAULT: deposit(amount)
    VAULT->>VAULT: 转入 USDC
    VAULT->>VAULT: emit Deposit(user, amount)
    VAULT-->>WALLET: tx hash

    FE->>FE: 显示 pending 状态

    loop Indexer 监听
        INDEXER->>VAULT: getLogs(Deposit)
        VAULT-->>INDEXER: [event]
        INDEXER->>DB: 检查幂等性
        INDEXER->>DB: UPDATE available_balance
    end

    FE->>FE: 轮询或 WebSocket 获取余额更新
    FE->>FE: 显示 confirmed 状态
```

### 6.3 开仓流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Frontend
    participant API as Backend
    participant TRADE as Trade Engine
    participant HEDGE as Hedging Bot
    participant HYPER as Hyperliquid
    participant DB as Database

    U->>FE: 选择 BTC，输入保证金、杠杆
    FE->>FE: Zod 表单验证

    FE->>API: POST /api/trade/order
    Note over FE,API: { symbol: BTC, side: long, margin: 10, leverage: 10x }

    API->>DB: 查询 available_balance
    DB-->>API: { available: 100 }

    API->>API: 校验余额充足

    API->>TRADE: 执行市价单

    TRADE->>TRADE: 获取标记价格 (from Hyperliquid)
    TRADE->>DB: BEGIN TRANSACTION
    TRADE->>DB: 锁定保证金 (available -> locked)
    TRADE->>DB: 创建订单记录 (status: filled)
    TRADE->>DB: 创建仓位记录
    TRADE->>DB: COMMIT

    TRADE->>HEDGE: 创建对冲任务 (async)

    API-->>FE: { order, position }

    FE->>FE: 显示成功 Toast

    par 异步对冲
        HEDGE->>HYPER: POST /order (short BTC)
        HYPER-->>HEDGE: { orderId }
        HEDGE->>DB: 更新对冲状态
    end
```

### 6.4 平仓流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Frontend
    participant API as Backend
    participant TRADE as Trade Engine
    participant QUEUE as BullMQ Queue
    participant DB as Database

    U->>FE: 点击平仓
    FE->>API: DELETE /api/trade/positions/:id

    API->>DB: 查询仓位
    DB-->>API: { position }

    API->>TRADE: 执行平仓

    TRADE->>TRADE: 获取当前标记价格
    TRADE->>TRADE: 计算已实现盈亏 = size * (mark - entry)
    TRADE->>TRADE: 计算保证金返还 = margin + realized_pnl

    TRADE->>DB: BEGIN TRANSACTION
    TRADE->>DB: 释放保证金 + 盈亏结算
    TRADE->>DB: 更新订单状态
    TRADE->>DB: 更新仓位状态 (closed)
    TRADE->>DB: COMMIT

    TRADE->>QUEUE: 添加对冲任务 (持久化)
    Note over QUEUE: 任务持久化到 Redis<br/>进程重启不丢失

    API-->>FE: { realized_pnl, new_balance }

    FE->>FE: 显示平仓结果
```

### 6.6 对冲执行流程（持久化队列）

```mermaid
sequenceDiagram
    participant QUEUE as BullMQ Queue
    participant WORKER as Hedge Worker
    participant HYPER as Hyperliquid API
    participant DB as Database

    Note over QUEUE,WORKER: 任务持久化，支持重试

    QUEUE->>WORKER: 消费对冲任务
    WORKER->>DB: 查询任务详情
    DB-->>WORKER: { position_id, side, size }

    WORKER->>WORKER: 构建反向订单
    WORKER->>HYPER: POST /order (market order)

    alt 成功
        HYPER-->>WORKER: { orderId, status: filled }
        WORKER->>DB: 更新任务状态 = completed
        WORKER->>QUEUE: ACK 确认
    else 网络错误 (可重试)
        HYPER-->>WORKER: Error: timeout
        WORKER->>QUEUE: NACK + 重试
        Note over QUEUE: 指数退避重试<br/>最多 3 次
    else 参数错误 (不可重试)
        HYPER-->>WORKER: Error: invalid params
        WORKER->>DB: 更新任务状态 = failed
        WORKER->>QUEUE: 移至死信队列
    end
```

### 6.5 提现流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as Frontend
    participant API as Backend
    participant VIEM as viem
    participant VAULT as Vault Contract
    participant INDEXER as Indexer
    participant DB as Database

    U->>FE: 输入提现金额
    FE->>API: POST /api/user/withdraw { amount }

    API->>DB: 查询 available_balance
    DB-->>API: { available: 50 }

    API->>API: 校验 available >= amount
    API->>DB: 预扣 available_balance

    API->>VIEM: writeContract(withdraw)
    VIEM->>VAULT: withdraw(user, amount)
    VAULT->>VAULT: 转出 USDC
    VAULT->>VAULT: emit Withdraw(user, amount)

    VAULT-->>VIEM: tx hash
    VIEM-->>API: tx hash

    API-->>FE: { tx_hash, status: pending }

    loop Indexer 监听
        INDEXER->>VAULT: getLogs(Withdraw)
        VAULT-->>INDEXER: [event]
        INDEXER->>DB: 确认提现，更新余额
    end

    FE->>FE: 轮询状态，显示 confirmed
```

---

## 7. 项目目录结构

### 7.1 Monorepo 结构

```
perp-dex-mvp/
├── apps/
│   ├── web/                    # Next.js 前端应用
│   ├── api/                    # Fastify 后端应用
│   └── contracts/              # Foundry 智能合约
├── packages/
│   ├── types/                  # 共享类型定义
│   ├── utils/                  # 共享工具函数
│   └── config/                 # 共享配置
├── docs/                       # 项目文档
├── scripts/                    # 部署/运维脚本
├── docker/                     # Docker 配置
├── package.json                # Monorepo 根配置
├── turbo.json                  # Turborepo 配置
└── pnpm-workspace.yaml         # pnpm workspace 配置
```

### 7.2 前端目录结构

```
apps/web/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (trading)/
│   │   ├── layout.tsx          # 交易页面布局
│   │   ├── page.tsx            # 首页/交易页
│   │   └── history/
│   │       └── page.tsx
│   ├── api/                    # API Routes (BFF)
│   │   ├── auth/
│   │   └── proxy/
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn/ui 组件
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── trading/                # 交易组件
│   │   ├── order-form.tsx
│   │   ├── position-table.tsx
│   │   ├── price-chart.tsx
│   │   └── order-book.tsx
│   ├── wallet/                 # 钱包组件
│   │   └── connect-button.tsx
│   └── layout/
│       ├── header.tsx
│       └── sidebar.tsx
├── hooks/
│   ├── use-auth.ts
│   ├── use-balance.ts
│   ├── use-market.ts
│   └── use-positions.ts
├── stores/
│   ├── trading-store.ts
│   └── settings-store.ts
├── lib/
│   ├── api.ts                  # API 客户端
│   ├── socket.ts               # Socket.IO 封装
│   └── utils.ts
├── config/
│   ├── wagmi.ts                # Wagmi 配置
│   └── constants.ts
├── types/
│   ├── api.ts
│   └── trading.ts
├── schemas/
│   ├── order.ts                # Zod schemas
│   └── auth.ts
├── public/
│   └── ...
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 7.3 后端目录结构

```
apps/api/
├── src/
│   ├── index.ts                # 入口文件
│   ├── app.ts                  # Fastify 应用配置
│   ├── routes/                 # 路由定义
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── trade.ts
│   │   ├── markets.ts
│   │   └── health.ts
│   ├── services/               # 业务逻辑
│   │   ├── auth.service.ts
│   │   ├── balance.service.ts
│   │   ├── trade.service.ts
│   │   └── position.service.ts
│   ├── engines/                # 核心引擎
│   │   ├── trade-engine.ts
│   │   ├── liquidation-engine.ts
│   │   └── price-engine.ts
│   ├── indexer/                # 链上事件监听
│   │   ├── index.ts
│   │   ├── vault-indexer.ts
│   │   └── event-handler.ts
│   ├── queue/                  # BullMQ 持久化队列
│   │   ├── index.ts            # 队列初始化
│   │   ├── queue.ts            # 队列定义 (hedge, liquidation)
│   │   └── types.ts            # 任务类型定义
│   ├── workers/                # Worker 进程
│   │   ├── hedge.worker.ts     # 对冲任务执行器
│   │   └── liquidation.worker.ts # 清算任务执行器
│   ├── jobs/                   # 定时任务 (node-cron)
│   │   ├── scheduler.ts        # 调度器
│   │   ├── liquidation-check.ts # 清算巡检
│   │   ├── reconciliation.ts   # 对账任务
│   │   └── price-update.ts     # 价格刷新
│   ├── clients/                # 外部服务客户端
│   │   ├── hyperliquid.ts      # Hyperliquid API
│   │   └── blockchain.ts       # viem client
│   ├── ws/                     # Socket.IO 服务
│   │   ├── index.ts
│   │   ├── market-socket.ts
│   │   └── position-socket.ts
│   ├── db/                     # 数据库
│   │   ├── client.ts           # Prisma client
│   │   └── migrations/
│   ├── middleware/             # 中间件
│   │   ├── auth.ts
│   │   ├── rate-limit.ts
│   │   └── error-handler.ts
│   ├── utils/                  # 工具函数
│   │   ├── siwe.ts
│   │   ├── validation.ts
│   │   └── logger.ts
│   └── types/                  # 类型定义
│       └── index.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── tsconfig.json
└── package.json
```

### 7.4 智能合约目录结构

```
apps/contracts/
├── src/
│   ├── Vault.sol               # Vault 主合约
│   └── interfaces/
│       └── IERC20.sol
├── test/
│   ├── Vault.t.sol             # Foundry 测试
│   └── mocks/
│       └── MockUSDC.sol
├── script/
│   └── Deploy.s.sol            # 部署脚本
├── foundry.toml
├── remappings.txt
└── .env.example
```

---

## 8. 关键技术决策记录（ADR）

### ADR-001: 选择 Fastify 而非 NestJS

**决策：** 使用 Fastify 作为后端框架

**背景：**
MVP 阶段需要快速迭代，团队熟悉度和开发效率是关键考量。

**考量因素：**

| 因素 | Fastify | NestJS |
|------|---------|--------|
| 学习曲线 | 低，原生 Node.js 风格 | 高，需要理解装饰器、DI |
| 性能 | 更优，内置 JSON Schema 优化 | 较慢，抽象层多 |
| 代码量 | 少，函数式风格 | 多，装饰器 + 类 |
| 灵活性 | 高，可自由组织代码结构 | 中，强制模块化结构 |
| MVP 适用性 | 高，快速开发 | 中，适合大型项目 |

**决策理由：**
1. MVP 阶段优先开发速度，Fastify 更轻量
2. 团队熟悉函数式编程风格
3. 性能优势明显（尤其在 JSON 处理）
4. 可以按需添加功能，避免过度设计

**替代方案：** 若项目后期规模扩大，可考虑迁移到 NestJS

---

### ADR-002: 选择 viem 而非 ethers.js

**决策：** 使用 viem 作为区块链交互库

**背景：**
需要与 EVM 链交互，包括事件监听、合约调用等。

**考量因素：**

| 因素 | viem | ethers.js |
|------|------|-----------|
| 包体积 | ~35KB | ~100KB+ |
| TypeScript 支持 | 原生，类型推断完善 | 需要 v6+ |
| 性能 | 更优，Tree-shakable | 较慢 |
| API 风格 | 函数式，组合式 | 面向对象 |
| 社区生态 | 快速增长 | 成熟稳定 |

**决策理由：**
1. viem 更轻量，减少包体积
2. TypeScript 支持更好，减少运行时错误
3. 函数式 API 更适合我们的代码风格
4. 性能优势明显

**替代方案：** ethers.js v6 也可接受，但团队倾向 viem

---

### ADR-003: 选择 Foundry 而非 Hardhat

**决策：** 使用 Foundry 作为智能合约开发框架

**背景：**
需要开发 Vault 合约，包括编译、测试、部署。

**考量因素：**

| 因素 | Foundry | Hardhat |
|------|---------|---------|
| 编译速度 | 极快（Rust 编写） | 较慢 |
| 测试语言 | Solidity | JavaScript/TypeScript |
| 测试速度 | 极快 | 较慢 |
| 调试体验 | 内置 forge test -vvvv | 需要 console.log |
| 工具链 | 一体化 | 插件化 |

**决策理由：**
1. 编译和测试速度极快，提升开发效率
2. 使用 Solidity 写测试，无需切换语言
3. 内置 fuzzing 测试能力
4. 工具链一体化，减少配置

**替代方案：** 若团队对 JS 测试更熟悉，Hardhat 也是好选择

---

### ADR-004: 选择 Zustand 而非 Redux Toolkit

**决策：** 使用 Zustand 作为前端状态管理

**背景：**
前端需要管理用户状态、交易状态、行情数据等。

**考量因素：**

| 因素 | Zustand | Redux Toolkit |
|------|---------|--------------|
| 包体积 | ~1KB | ~10KB+ |
| Boilerplate | 几乎没有 | 较多（slices, actions） |
| 学习曲线 | 低 | 中 |
| DevTools | 支持 | 内置完善 |
| 中间件 | 简单 | 完善 |

**决策理由：**
1. MVP 阶段状态管理需求简单
2. 极小的包体积
3. 无需复杂的 actions/reducers
4. 与 React 18+ Concurrent 模式兼容

---

### ADR-005: 选择 PostgreSQL + Prisma 而非 MongoDB

**决策：** 使用 PostgreSQL + Prisma 作为数据存储方案

**背景：**
交易系统需要存储用户、余额、订单、仓位等数据，数据一致性至关重要。

**考量因素：**

| 因素 | PostgreSQL + Prisma | MongoDB + Mongoose |
|------|---------------------|-------------------|
| 数据一致性 | 强一致（ACID） | 最终一致 |
| 事务支持 | 完善 | 有限 |
| 关系查询 | 原生支持 | 需要 $lookup |
| Schema | 强类型，迁移管理 | 灵活，但易出错 |
| 金融场景适用性 | 高 | 低 |

**决策理由：**
1. 交易系统必须保证数据一致性
2. 余额操作需要事务支持
3. Prisma 提供 TypeScript 友好的 ORM
4. 迁移管理更规范

---

### ADR-006: 单用户单标的单向单仓模式

**决策：** MVP 阶段采用单用户单标的单向单仓模式

**背景：**
需要确定仓位模式，影响交易逻辑和数据模型。

**模式说明：**
- 单标的：仅支持 BTC
- 单向：不能同时持有多空仓位
- 单仓：同一标的只能有一个仓位

**决策理由：**
1. 简化 MVP 开发复杂度
2. 降低清算逻辑复杂度
3. 减少状态管理难度
4. 后期可扩展为双向持仓

---

### ADR-007: 选择 Socket.IO 而非原生 WebSocket

**决策：** 使用 Socket.IO 作为前后端实时通信方案

**背景：**
交易系统需要实时推送行情数据和仓位更新，需要可靠的双向通信机制。

**考量因素：**

| 因素 | Socket.IO | 原生 WebSocket (ws) |
|------|-----------|---------------------|
| 自动重连 | ✅ 内置指数退避 | ❌ 需手动实现 |
| 房间管理 | ✅ 内置 rooms/namespaces | ❌ 需手动实现 |
| HTTP 降级 | ✅ 自动降级 long-polling | ❌ 无 |
| 心跳检测 | ✅ 内置 | ❌ 需手动实现 |
| 消息确认 | ✅ ACK 机制 | ❌ 无 |
| 性能 | 中等 (~5K conn/s) | 高 (~10K conn/s) |
| 社区成熟度 | 高，~10M 周下载 | 高，~80M 周下载 |

**决策理由：**
1. **可靠性优先**：交易系统需要稳定的连接，自动重连和 HTTP 降级保证移动端/防火墙场景可用
2. **房间功能**：按交易对/用户推送，无需手动管理订阅关系
3. **开发效率**：减少手动实现重连、心跳、消息确认的工作量
4. **生产实践**：Socket.IO 在生产环境有丰富的最佳实践参考

**替代方案：** 若后期并发量超过 10K 连接，可考虑迁移到 uWebSockets.js

---

### ADR-008: 选择 Reown AppKit 而非 RainbowKit

**决策：** 使用 Reown AppKit 作为钱包连接方案

**背景：**
DApp 需要支持多种钱包连接方式，包括浏览器扩展钱包、移动端钱包和社交登录。

**考量因素：**

| 因素 | Reown AppKit | RainbowKit |
|------|--------------|------------|
| 钱包支持 | 500+ (WalletConnect) | 中等 |
| 社交登录 | ✅ 内置 Email/Google/Apple | ❌ 需自定义 |
| 智能账户 | ✅ Account Abstraction | ❌ 手动配置 |
| 多链支持 | EVM + Solana | 仅 EVM |
| 包体积 | 较大 | 较小 |
| 注册要求 | 需要 projectId | 无需注册 |

**决策理由：**
1. **钱包覆盖**：500+ 钱包通过 WalletConnect 协议支持，用户选择更灵活
2. **社交登录**：内置社交登录降低 Web3 新用户门槛
3. **扩展性**：支持多链和智能账户，为后续功能扩展预留空间
4. **移动端**：支持 React Native，与 Web 共享配置

---

### ADR-009: 选择 BullMQ 持久化队列而非内存队列

**决策：** 使用 BullMQ 作为持久化任务队列，node-cron 仅用于巡检类任务

**背景：**
PRD 明确要求：
- 对冲失败必须保留待处理状态
- 支持重试（最多 3 次）
- 网络拥堵时任务进入队列重试

原架构使用内存队列 + node-cron，存在以下风险：
- 进程重启时内存任务丢失
- 实例切换时任务无法恢复
- 无法追踪任务执行历史

**考量因素：**

| 因素 | BullMQ (Redis) | pg-boss (PostgreSQL) | 内存队列 |
|------|----------------|---------------------|---------|
| **持久化** | ✅ Redis AOF | ✅ PostgreSQL | ❌ 内存 |
| **进程重启恢复** | ✅ 自动恢复 | ✅ 自动恢复 | ❌ 丢失 |
| **重试机制** | ✅ 内置指数退避 | ✅ 内置 | ❌ 需手动 |
| **死信队列** | ✅ 内置 DLQ | ✅ 内置 | ❌ 无 |
| **任务优先级** | ✅ 支持 | ✅ 支持 | ❌ 无 |
| **监控 UI** | ✅ Bull Board | ⚠️ 有限 | ❌ 无 |
| **基础设施** | 复用现有 Redis | 复用现有 Postgres | 无依赖 |
| **性能** | 高（内存 + 持久化） | 中（磁盘 I/O） | 最高 |
| **社区生态** | 大，成熟 | 小 | - |

**决策理由：**

1. **任务可靠性**：BullMQ 基于 Redis，任务持久化保证进程重启不丢失
2. **复用基础设施**：项目已有 Redis（缓存 + Socket.IO），无需新增依赖
3. **功能完善**：
   - 内置 [指数退避重试](https://docs.bullmq.io/guide/retrying-failing-jobs)
   - [死信队列 (DLQ)](https://oneuptime.com/blog/post/2026-01-21-bullmq-dead-letter-queue/view) 处理永久失败任务
   - 任务优先级（清算 > 普通对冲）
4. **可观测性**：Bull Board 提供任务监控 UI，便于排查对冲失败
5. **生产验证**：[PkgPulse 2026 报告](https://www.pkgpulse.com/blog/best-nodejs-background-job-libraries-2026) 推荐用于生产环境

**任务分层设计：**

| 任务类型 | 执行方式 | 持久化 | 说明 |
|---------|---------|--------|------|
| **清算检查** | node-cron (2s) | ❌ | 巡检任务，每次全量扫描持仓 |
| **对账任务** | node-cron (2s) | ❌ | 巡检任务，核对净头寸 |
| **价格刷新** | node-cron (2s) | ❌ | 巡检任务，更新缓存 |
| **对冲执行** | BullMQ | ✅ | 业务任务，必须持久化 |
| **清算执行** | BullMQ (高优先级) | ✅ | 业务任务，必须持久化 |

**替代方案：** 若团队更看重审计跟踪且不想依赖 Redis，可考虑 pg-boss

---

## 9. 部署架构

### 9.1 MVP 阶段部署方案

```mermaid
graph TB
    subgraph "Cloud Provider"
        subgraph "Application Server"
            API[Fastify API<br/>:3001]
            WS[Socket.IO<br/>:3002]
            INDEXER[Indexer Service]
            SCHEDULER[Job Scheduler<br/>node-cron]
        end

        subgraph "Worker Processes"
            HEDGE_WORKER[Hedge Worker<br/>BullMQ]
            LIQ_WORKER[Liquidation Worker<br/>BullMQ]
        end

        subgraph "Data Services"
            PG[(PostgreSQL<br/>Managed)]
            REDIS[(Redis<br/>Cache + Queue)]
        end
    end

    subgraph "External"
        CHAIN[Arbitrum Sepolia]
        HYPER[Hyperliquid Testnet]
    end

    subgraph "Frontend"
        VERCEL[Vercel<br/>Next.js 15]
    end

    VERCEL -->|REST/Socket.IO| API

    API --> PG
    API --> REDIS
    API -->|创建任务| REDIS

    WS --> REDIS

    INDEXER -->|viem| CHAIN
    INDEXER --> PG

    SCHEDULER -->|清算检查| PG
    SCHEDULER -->|创建清算任务| REDIS

    REDIS -->|消费任务| HEDGE_WORKER
    REDIS -->|消费任务| LIQ_WORKER

    HEDGE_WORKER -->|HTTP| HYPER
    HEDGE_WORKER --> PG

    LIQ_WORKER --> PG

    API -->|viem| CHAIN
```

### 9.2 环境变量

```bash
# 后端 .env
DATABASE_URL="postgresql://user:pass@host:5432/perpdex"
REDIS_URL="redis://host:6379"
JWT_SECRET="your-jwt-secret"
HYPERLIQUID_API_URL="https://api.hyperliquid-testnet.xyz"
HYPERLIQUID_PRIVATE_KEY="your-hedge-wallet-private-key"
VAULT_CONTRACT_ADDRESS="0x..."
RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
SOCKET_IO_CORS_ORIGIN="https://app.perpdex.com"

# BullMQ 配置
BULLMQ_REDIS_URL="redis://host:6379"
HEDGE_WORKER_CONCURRENCY="5"
HEDGE_MAX_RETRIES="3"

# 前端 .env
NEXT_PUBLIC_API_URL="https://api.perpdex.com"
NEXT_PUBLIC_WS_URL="wss://api.perpdex.com"
NEXT_PUBLIC_VAULT_ADDRESS="0x..."
NEXT_PUBLIC_CHAIN_ID="421614"
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="your-reown-project-id"
```

### 9.3 部署检查清单

- [ ] 数据库迁移已执行
- [ ] Redis 连接正常
- [ ] 合约已部署到测试网
- [ ] Indexer 启动正常
- [ ] Job Scheduler 启动正常
- [ ] Hedge Worker 启动正常（消费队列任务）
- [ ] API 健康检查通过
- [ ] 前端构建成功
- [ ] Socket.IO 连接正常（CORS 配置）
- [ ] Reown AppKit projectId 配置正确
- [ ] BullMQ 队列状态正常

---

## 10. 开发规范

### 10.1 代码规范

**TypeScript/JavaScript：**
- 使用 ESLint + Prettier
- 遵循 Airbnb 风格指南（部分调整）
- 严格模式：`strict: true`
- 禁止 `any` 类型（特殊情况除外）

**Solidity：**
- 使用 Foundry 内置 formatter
- 遵循 Solidity Style Guide
- 必须编写 NatSpec 注释

**命名规范：**
| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `trade-engine.ts` |
| 变量/函数 | camelCase | `getUserBalance` |
| 类/接口 | PascalCase | `TradeEngine` |
| 常量 | UPPER_SNAKE_CASE | `MAX_LEVERAGE` |
| 数据库表 | snake_case | `hedge_orders` |

### 10.2 Git 工作流

**分支策略：**
```
main          # 生产分支，保护
├── develop   # 开发分支
│   ├── feature/auth        # 功能分支
│   ├── feature/trade       # 功能分支
│   └── fix/balance-bug     # 修复分支
```

**提交规范：**
```
<type>: <description>

类型：feat | fix | refactor | docs | test | chore | perf | ci
```

**Pull Request 流程：**
1. 从 `develop` 创建功能分支
2. 完成开发 + 自测
3. 创建 PR，关联 Issue
4. Code Review 通过
5. 合并到 `develop`
6. 测试通过后合并到 `main`

### 10.3 测试覆盖率要求

| 类型 | 覆盖率要求 | 说明 |
|------|-----------|------|
| 单元测试 | 80%+ | 核心业务逻辑（PnL 计算、清算价格、余额计算） |
| 集成测试 | 70%+ | API 接口、数据库操作、Indexer 事件处理 |
| 合约测试 | 90%+ | Vault 合约（含 Fuzz 测试） |

> **注意**：MVP 阶段不实现 E2E 测试，优先保证核心逻辑的单元测试和集成测试覆盖率。

**必须测试的场景：**
- SIWE 登录签名验证
- 充值/提现事件处理（含幂等性测试）
- 开仓/平仓余额计算
- 保证金不足拒绝下单
- 清算触发条件
- 对冲任务重试逻辑
- BullMQ 任务失败处理

---

## 附录

### A. API 接口清单

详见 `/docs/API.md`（待创建）

### B. 数据库 Schema

详见 `/apps/api/prisma/schema.prisma`

### C. 合约 ABI

详见 `/apps/contracts/out/Vault.sol/Vault.json`

### D. 监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| API 响应时间 | p95 延迟 | > 500ms |
| 错误率 | 5xx 比例 | > 1% |
| Indexer 延迟 | 事件处理延迟 | > 10 blocks |
| 对冲成功率 | Hyperliquid 订单成功率 | < 95% |
| 数据库连接数 | 活跃连接 | > 80% |

---

**文档变更记录：**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|---------|
| 1.0 | 2026-03-11 | 技术团队 | 初始版本 |
| 1.1 | 2026-03-11 | 技术团队 | 升级 Next.js 15；替换 RainbowKit 为 Reown AppKit；替换原生 WebSocket 为 Socket.IO |
| 1.2 | 2026-03-11 | 技术团队 | 添加持久化任务队列层 (BullMQ)；重构 Hedging Bot 为 Queue + Worker 架构；分离巡检任务与业务任务 |
| 1.3 | 2026-03-11 | 技术团队 | 移除 E2E 测试（MVP 不需要）；明确前端只实现 CFD 市价单，不实现订单簿 |
