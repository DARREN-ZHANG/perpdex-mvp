# Sprint 0 工程基础与规约

本文件冻结 `T01-T06` 的工程基础决策，作为后续并行开发的统一基线。

## 1. Monorepo 结构

```
perp-dex-mvp/
├── apps/
│   ├── api
│   └── web
├── packages/
│   ├── contracts
│   └── shared
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json
```

## 2. 包命名与职责

- `@perpdex/api`
  - Fastify API 入口
  - Prisma schema 与迁移
  - 鉴权、账户、交易、indexer、worker 编排
- `@perpdex/web`
  - Next.js 15 前端
  - 钱包连接、交易页面、资产页面、BFF 代理
- `@perpdex/shared`
  - 共享 DTO、Zod schema、错误模型、链上事件/队列契约、mock adapters
- `@perpdex/contracts`
  - Vault ABI、链常量、事件名导出
  - Foundry 产物在后续 `T22` 接入到该包

## 3. 命名与代码约定

- workspace 包统一使用 `@perpdex/*`
- TypeScript 默认开启 `strict`
- API 请求/响应层统一使用 `camelCase`
- Prisma 模型使用 `PascalCase`，字段使用 `camelCase`
- 数据库枚举使用 `UPPER_SNAKE_CASE` 风格值
- 用户可见状态值与 API DTO 使用小写字符串枚举

## 4. 命令约定

- 根命令统一通过 `pnpm` 调度
- `pnpm dev`: 启动 workspace 开发任务
- `pnpm build`: 构建全部包
- `pnpm lint`: 执行全部包 lint
- `pnpm test`: 执行全部包测试
- `pnpm typecheck`: 执行全部包类型检查
- `pnpm db:generate`: 仅针对 `@perpdex/api` 生成 Prisma Client
- `pnpm db:migrate`: 仅针对 `@perpdex/api` 执行迁移

## 5. 数据精度约定

- USDC 账务金额使用 `BigInt`，单位为最小精度 `1e-6`
- 价格、数量、PnL 使用 `Decimal(36,18)`
- API 传输层金额与价格统一使用字符串，避免前端数值精度丢失

## 6. 契约边界

- 数据模型由 `apps/api/prisma/schema.prisma` 冻结
- API contract、DTO、error shape 由 `packages/shared` 冻结
- 链上事件入库幂等规则由 `txHash + logIndex + eventName` 唯一定位
- hedge queue 状态机固定为 `pending -> submitted -> filled | failed`

## 7. Mock 策略

- `@perpdex/shared` 提供 mock price provider
- `@perpdex/shared` 提供 mock Hyperliquid client
- `@perpdex/shared` 提供 mock auth session manager
- 前端和交易核心在接入真实外部服务前默认依赖这些 mock
