# PerpDex MVP 部署指南

本文档介绍 PerpDex MVP 项目的本地开发环境搭建和 Testnet 部署流程。

## 目录

- [环境要求](#环境要求)
- [本地开发环境](#本地开发环境)
- [数据库初始化](#数据库初始化)
- [智能合约部署](#智能合约部署)
- [API 服务部署](#api-服务部署)
- [前端部署](#前端部署)
- [环境变量说明](#环境变量说明)
- [常见问题排查](#常见问题排查)

---

## 环境要求

### 必需软件

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | 20+ | 运行时环境 |
| pnpm | 10.32.0+ | 包管理器 |
| PostgreSQL | 14+ | 数据库 |
| Redis | 6+ | 缓存和队列 |
| Docker | 20+ | 容器化（可选） |

### 安装命令

```bash
# macOS (使用 Homebrew)
brew install node@20 postgresql@14 redis docker

# 验证安装
node --version  # 应显示 v20.x.x
pnpm --version  # 应显示 10.x.x
psql --version  # 应显示 14.x 或更高
redis-cli --version  # 应显示 6.x 或更高
```

---

## 本地开发环境

### 1. 克隆仓库

```bash
git clone <repository-url>
cd perp-dex-mvp
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
# API 服务配置
cp apps/api/.env.example apps/api/.env

# 智能合约配置
cp apps/contracts/.env.example apps/contracts/.env
```

编辑 `.env` 文件，填入实际配置值。

### 4. 启动基础设施服务

```bash
# 启动 PostgreSQL
brew services start postgresql@14

# 启动 Redis
brew services start redis
```

或使用 Docker：

```bash
docker-compose up -d postgres redis
```

### 5. 初始化数据库

详见 [数据库初始化](#数据库初始化) 章节。

### 6. 启动开发服务器

```bash
# 启动所有服务 (API + Frontend)
pnpm dev

# 或单独启动
pnpm --filter @perpdex/api dev     # 仅 API
pnpm --filter @perpdex/web dev     # 仅 Frontend
```

服务地址：
- API: http://localhost:3001
- Frontend: http://localhost:3000

---

## 数据库初始化

### 创建数据库

```bash
# 连接 PostgreSQL
psql postgres

# 创建数据库和用户
CREATE DATABASE perpdex;
CREATE USER perpdex_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE perpdex TO perpdex_user;
\q
```

### 运行数据库迁移

```bash
# 生成 Prisma Client
pnpm db:generate

# 运行迁移
pnpm db:migrate
```

### 验证数据库连接

```bash
# 启动 API 服务
pnpm --filter @perpdex/api dev

# 检查健康状态
curl http://localhost:3001/health
```

---

## 智能合约部署

### 前置要求

1. 确保 `apps/contracts/.env` 已正确配置
2. 部署者钱包需要有足够的测试 ETH

### 获取测试 ETH

Arbitrum Sepolia Faucet: https://sepolia-faucet.arbitrum.io/

### 部署 Vault 合约

```bash
cd apps/contracts

# 加载环境变量
source .env

# 部署合约
forge script script/DeployVault.s.sol:DeployVault \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvvv
```

### 更新 API 配置

部署成功后，将合约地址更新到 `apps/api/.env`:

```bash
VAULT_CONTRACT_ADDRESS=0x<deployed-contract-address>
```

---

## API 服务部署

### 环境变量配置

确保 `apps/api/.env` 包含以下关键配置：

```bash
# 生产环境配置
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# 数据库
DATABASE_URL=postgresql://user:password@host:5432/perpdex

# Redis
REDIS_URL=redis://host:6379

# JWT 密钥（生产环境必须使用强密钥）
JWT_SECRET=<strong-random-secret>

# 外部服务
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz  # 主网
RPC_URL=https://arb1.arbitrum.io/rpc             # 主网
VAULT_CONTRACT_ADDRESS=<deployed-address>

# 对冲私钥（生产环境必须配置）
HEDGE_PRIVATE_KEY=<private-key>
```

### 构建和启动

```bash
cd apps/api

# 构建项目
pnpm build

# 启动服务（使用 PM2 或其他进程管理器）
pm2 start dist/index.js --name perpdex-api
```

---

## 前端部署

### 构建

```bash
cd apps/web

# 构建生产版本
pnpm build
```

### 部署选项

1. **Vercel** (推荐)
   ```bash
   vercel deploy --prod
   ```

2. **Netlify**
   ```bash
   netlify deploy --prod
   ```

3. **Docker**
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY . .
   RUN pnpm install --frozen-lockfile
   RUN pnpm build
   CMD ["pnpm", "start"]
   ```

---

## 环境变量说明

### API 服务环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 否 | 3001 | API 服务端口 |
| `NODE_ENV` | 否 | development | 运行环境 |
| `DATABASE_URL` | 是 | - | PostgreSQL 连接字符串 |
| `REDIS_URL` | 是 | - | Redis 连接字符串 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥 |
| `SIWE_CHAIN_ID` | 否 | 421614 | 以太坊链 ID |
| `HYPERLIQUID_API_URL` | 否 | https://api.hyperliquid-testnet.xyz | Hyperliquid API |
| `RPC_URL` | 是 | - | RPC 节点地址 |
| `VAULT_CONTRACT_ADDRESS` | 是 | - | Vault 合约地址 |
| `HEDGE_PRIVATE_KEY` | 生产 | - | 对冲操作私钥 |

### 合约环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `PRIVATE_KEY` | 是 | - | 部署者私钥 |
| `RPC_URL` | 是 | - | RPC 节点地址 |
| `USDC_ADDRESS` | 是 | - | USDC 代币地址 |
| `ETHERSCAN_API_KEY` | 否 | - | Etherscan API 密钥 |

---

## 常见问题排查

### 数据库连接失败

**错误**: `Connection refused at localhost:5432`

**解决方案**:
```bash
# 检查 PostgreSQL 是否运行
brew services list

# 启动 PostgreSQL
brew services start postgresql@14
```

### Redis 连接失败

**错误**: `Error: Redis connection to localhost:6379 failed`

**解决方案**:
```bash
# 检查 Redis 是否运行
redis-cli ping

# 启动 Redis
brew services start redis
```

### Prisma 迁移失败

**错误**: `P3006 | Migration failed`

**解决方案**:
```bash
# 重置数据库（谨慎操作）
pnpm --filter @perpdex/api db:reset

# 或手动删除表后重新迁移
psql postgres -c "DROP DATABASE perpdex;"
psql postgres -c "CREATE DATABASE perpdex;"
pnpm db:migrate
```

### 合约部署失败

**错误**: `Sender doesn't have enough funds`

**解决方案**:
1. 从水龙头获取测试 ETH
2. 确认钱包地址正确: `cast balance <address> --rpc-url $RPC_URL`

### Socket.IO 连接失败

**错误**: `WebSocket connection failed`

**解决方案**:
1. 检查 `SOCKET_CORS_ORIGIN` 配置
2. 确认前端和 API 端口正确
3. 检查防火墙设置

### 智能合约调用失败

**错误**: `Transaction reverted`

**解决方案**:
1. 使用 `forge test -vvv` 调试
2. 检查合约地址是否正确
3. 确认调用者有足够权限

---

## 安全提示

1. **永远不要提交私钥到代码仓库**
2. 生产环境必须使用强 JWT 密钥
3. 使用环境变量管理敏感配置
4. 定期轮换密钥和访问令牌
5. 限制 API 访问速率
6. 启用 HTTPS

---

## 相关文档

- [架构文档](/docs/ARCHITECTURE.md)
- [PRD 文档](/docs/PerpDex-PRD.md)
- [前端技术栈](/docs/frontend-tech-stack.md)
- [工程规范](/docs/ENGINEERING-CONVENTIONS.md)
