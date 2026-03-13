# PerpDex MVP

基于 EVM 的永续合约去中心化交易所最小可行产品。

## 核心功能

- **钱包登录**: SIWE (Sign-In with Ethereum) 标准认证
- **资金托管**: 链上 Vault 合约管理 USDC 充值/提现
- **永续交易**: BTC 市价开多/开空、平仓
- **自动对冲**: 成交后在 Hyperliquid Testnet 自动对冲风险
- **仓位管理**: 实时盈亏计算、清算价格追踪

## 快速启动

### 环境要求

- Node.js 20+
- pnpm 10.32.0+
- PostgreSQL 15+
- Redis 7+
- Foundry (智能合约开发)

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动本地区块链

```bash
./scripts/local-chain.sh start
```

该命令会：
- 启动 Anvil 本地链 (Chain ID: 31337)
- 部署 MockUSDC 和 Vault 合约
- 生成 `.env.local` 环境变量文件

### 3. 启动基础设施

```bash
# 使用 Docker
docker-compose up -d postgres redis

# 或本地启动
brew services start postgresql@15
brew services start redis
```

### 4. 初始化数据库

```bash
# 创建数据库（首次）
psql postgres -c "CREATE DATABASE perpdex;"

# 运行迁移
pnpm db:generate
pnpm db:migrate
```

### 5. 启动开发服务

```bash
# 同时启动 API 和 Frontend
pnpm dev
```

服务地址：
- 前端: http://localhost:3000
- API: http://localhost:3001

### 6. 配置钱包

在 MetaMask 中：
1. 导入测试账户私钥：`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
2. 添加自定义网络：
   - RPC URL: `http://localhost:8545`
   - Chain ID: `31337`

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐ │
│  │   Frontend  │    │  Next.js 15 / Reown AppKit / Wagmi      │ │
│  │  (Next.js)  │◄──►│  Socket.IO Client / Tailwind CSS        │ │
│  └──────┬──────┘    └─────────────────────────────────────────┘ │
└─────────┼───────────────────────────────────────────────────────┘
          │ REST / WebSocket
┌─────────▼───────────────────────────────────────────────────────┐
│                         API Layer                               │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐ │
│  │   Backend   │    │  Fastify / TypeScript / Socket.IO       │ │
│  │    API      │◄──►│  JWT Auth / Rate Limit / Zod Validation │ │
│  └──────┬──────┘    └─────────────────────────────────────────┘ │
└─────────┼───────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────┐
│                      Core Services                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │Trade Engine │  │   Indexer   │  │   BullMQ Job Queue      │  │
│  │(市价单执行)  │  │(链上事件监听) │  │  (对冲/清算任务持久化)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────┬───────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌─────────────────┐  ┌─────────────────────────────────────────┐│
│  │   PostgreSQL    │  │              Redis                      ││
│  │  (用户/订单/仓位) │  │  (缓存 + Session + BullMQ 队列存储)      ││
│  │   Prisma ORM    │  │                                         ││
│  └─────────────────┘  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌─────────────────┐   ┌─────────────────┐
│  EVM Chain    │    │ Hyperliquid API │   │  Vault Contract │
│(Anvil/Testnet)│    │   (Testnet)     │   │  (Solidity)     │
└───────────────┘    └─────────────────┘   └─────────────────┘
```

## 关键设计决策

### 1. 单用户单标的多仓并存模式
- MVP 阶段仅支持 BTC，但会为每次开仓创建独立仓位记录
- 同一用户在同一标的下可以同时持有多笔仓位，也可以同时持有多仓和空仓
- 当前不做同向仓位合并、净额持仓或组合保证金

### 2. 链上 Vault + 内部账本
- 用户资金托管在链上 Vault 合约，保证资产安全
- 交易使用内部账本，避免每笔交易都需链上确认
- Indexer 监听链上事件同步余额，保证数据一致性

### 3. BullMQ 持久化任务队列
- 对冲/清算任务必须持久化，进程重启不丢失
- 内置指数退避重试（最多3次）和死信队列
- 清算任务优先级高于普通对冲任务

### 4. 技术栈选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 前端 | Next.js 15 + Reown AppKit | App Router、500+钱包支持、社交登录 |
| 后端 | Fastify | 高性能、TypeScript 原生、轻量级 |
| 区块链 | viem | 包体积小、类型安全、函数式 API |
| 合约 | Foundry | 编译快、Solidity 测试、内置 fuzzing |
| 数据库 | PostgreSQL + Prisma | ACID 事务、迁移管理、金融级一致性 |
| 队列 | BullMQ + Redis | 持久化、重试机制、监控完善 |
| 实时通信 | Socket.IO | 自动重连、房间管理、HTTP 降级 |

## 项目结构

```
perp-dex-mvp/
├── apps/
│   ├── api/                    # Fastify 后端服务
│   │   ├── src/
│   │   │   ├── routes/         # API 路由
│   │   │   ├── services/       # 业务逻辑
│   │   │   ├── engines/        # 交易/清算引擎
│   │   │   ├── indexer/        # 链上事件监听
│   │   │   ├── queue/          # BullMQ 队列定义
│   │   │   ├── workers/        # 对冲/清算 Worker
│   │   │   └── jobs/           # 定时任务 (node-cron)
│   │   └── prisma/
│   │       └── schema.prisma   # 数据库 Schema
│   │
│   ├── web/                    # Next.js 前端应用
│   │   ├── app/                # App Router
│   │   ├── components/         # React 组件
│   │   ├── hooks/              # 自定义 Hooks
│   │   └── stores/             # Zustand 状态管理
│   │
│   └── contracts/              # Foundry 智能合约
│       ├── src/Vault.sol       # Vault 主合约
│       ├── test/               # 合约测试
│       └── script/             # 部署脚本
│
├── packages/
│   ├── shared/                 # 共享类型和工具
│   └── contracts/              # 合约 ABI 和常量
│
├── docs/                       # 项目文档
├── scripts/
│   └── local-chain.sh          # 本地链启动脚本
└── docker-compose.yml          # 基础设施编排
```

## 核心业务流程

### 充值流程
```
用户 -> approve USDC -> deposit to Vault -> 链上事件
                                              ↓
Indexer 监听 -> 幂等检查 -> 更新数据库余额 -> 前端显示
```

### 开仓流程
```
用户下单 -> 余额检查 -> 创建订单/仓位记录
                              ↓
                    创建 BullMQ 对冲任务 (异步)
                              ↓
                    Hedge Worker -> Hyperliquid 下单
```

### 平仓流程
```
用户平仓 -> 盈亏计算 -> 更新余额/仓位状态
                              ↓
                    创建反向对冲任务 -> 完成对冲
```

## 已知限制

1. **交易限制**
   - 仅支持 BTC 单标的
   - 仅支持市价单，不支持限价单/止盈止损
   - 每次开仓都会创建独立仓位，暂不支持同向仓位合并或净头寸模式
   - 无订单簿深度，当前以内部账本记账 + 外部对冲为主

2. **风控限制**
   - 清算检查每 5 分钟轮询一次（非实时）
   - 无资金费率机制
   - 无保险基金和自动减仓 (ADL)

3. **基础设施限制**
   - MVP 阶段单机部署，无集群支持
   - 对冲依赖 Hyperliquid Testnet，有 API 限流
   - 无完整监控告警体系（仅基础日志）

4. **安全限制**
   - Vault 目前仍为 `Owner` 单签控制，尚未接入多签治理
   - 已支持提现暂停 (`pause/unpause`)，但缺少更完整的应急响应与治理流程
   - 无冷钱包/热钱包分离

## 常用命令

```bash
# 开发
pnpm dev                      # 启动所有服务
pnpm --filter @perpdex/api dev    # 仅启动 API
pnpm --filter @perpdex/web dev    # 仅启动 Frontend

# 数据库
pnpm db:generate              # 生成 Prisma Client
pnpm db:migrate               # 运行数据库迁移

# 代码质量
pnpm lint                     # 代码检查
pnpm typecheck                # TypeScript 类型检查
pnpm test                     # 运行测试

# 本地链
./scripts/local-chain.sh start   # 启动本地链并部署合约
./scripts/local-chain.sh stop    # 停止本地链
./scripts/local-chain.sh status  # 查看状态

# Docker
docker-compose up -d          # 启动基础设施
docker-compose down           # 停止基础设施
```

## 相关文档

- [架构设计](./docs/ARCHITECTURE.md) - 详细系统架构和数据流
- [部署指南](./docs/DEPLOYMENT.md) - 环境搭建和部署流程
- [产品需求](./docs/PerpDex-PRD.md) - 产品需求和用户故事
- [工程规范](./docs/ENGINEERING-CONVENTIONS.md) - 代码规范和 Git 工作流

## 技术栈版本

- **前端**: Next.js 15, React 19, TypeScript 5, Tailwind CSS 3, Reown AppKit
- **后端**: Fastify 5, Socket.IO 4, Prisma 6, BullMQ 5
- **区块链**: viem 2, wagmi 3, Foundry
- **测试**: Vitest, Playwright, Supertest
- **基础设施**: PostgreSQL 15, Redis 7, Docker
