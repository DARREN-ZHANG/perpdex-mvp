# PerpDex MVP 开发任务看板

> 适用范围：MVP 第一阶段
> 基线文档：[ARCHITECTURE.md](./ARCHITECTURE.md) / [PerpDex-PRD.md](./PerpDex-PRD.md)
> 目标闭环：`Wallet Login -> Deposit -> Trade -> Position -> Hedge -> Withdraw`

---

## 1. 使用方式

本看板不是模块罗列，而是按 `并行开发最大化` 的原则拆分。

- 每个任务都可以直接转成一个 issue
- `前置依赖` 为空的任务应立即启动
- `阻塞级` 任务优先级最高，必须先冻结契约再让多人并行
- 推荐至少 4 条泳道并行推进：`合约`、`后端基础`、`交易核心`、`前端`

建议状态流转：

- `Todo`
- `In Progress`
- `Blocked`
- `In Review`
- `Done`

---

## 2. 里程碑

### M0: 并行开发解耦完成

完成标准：

- 数据模型冻结
- API 契约冻结
- 链上事件字段冻结
- 队列 payload 冻结
- mock 依赖可用

### M1: 本地闭环可跑通

完成标准：

- 可以本地完成登录、充值入账、下单、平仓、提现流程
- 对冲任务可创建、消费、重试
- 前端可以在 mock 或 testnet 环境中完整联调

### M2: Testnet Demo 可演示

完成标准：

- Vault 部署到 Arbitrum Sepolia
- Hyperliquid Testnet 对冲可执行
- 关键异常流可观察
- 基础监控和健康检查可用

---

## 3. 关键依赖图

核心关键路径：

`T01/T02/T03 -> T10/T11/T12/T13 -> T20/T21/T22/T30 -> T40/T41/T42 -> T50`

说明：

- `T01-T03` 是所有并行工作的解耦基础
- 合约线可与 `T10` 之后的后端工作并行
- 前端在 `T02` 完成后即可基于 mock 独立推进
- `T50` 端到端联调只能放在最后，但不应阻塞前面各线开发

---

## 4. 任务看板

字段说明：

- `ID`：任务编号
- `泳道`：建议负责人方向
- `阻塞级`：`P0` 表示高阻塞
- `前置依赖`：需先完成的任务
- `验收标准`：任务关闭条件

| ID | 任务 | 泳道 | 阻塞级 | 前置依赖 |
|---|---|---|---|---|
| T01 | 定义 monorepo 包结构与命名约定 | 平台/后端 | P0 | - |
| T02 | 冻结 Prisma schema 与枚举定义 | 后端 | P0 | - |
| T03 | 冻结 API contract 与共享 DTO/schema | 后端 | P0 | - |
| T04 | 冻结链上事件入库模型与幂等键 | 后端/链 | P0 | T02 |
| T05 | 冻结 hedge queue payload 与状态机 | 后端/Worker | P0 | T02 |
| T06 | 提供 price provider / Hyperliquid / auth mock | 平台 | P0 | T03 |
| T10 | 初始化 Fastify API 工程 | 后端 | P1 | T01 |
| T11 | 初始化 Prisma/数据库迁移流程 | 后端 | P1 | T01,T02 |
| T12 | 实现 JWT/SIWE 鉴权骨架 | 后端 | P1 | T03,T10,T11 |
| T13 | 建立统一日志、错误模型、配置加载 | 后端 | P1 | T10 |
| T14 | 建立 Socket.IO 服务骨架 | 后端 | P2 | T10 |
| T20 | 完成 Vault 合约实现 | 合约 | P1 | T01 |
| T21 | 完成 Foundry 测试与事件断言 | 合约 | P1 | T20 |
| T22 | 完成部署脚本与 ABI 产物导出 | 合约 | P1 | T20 |
| T23 | 定义 Sepolia 部署参数和环境变量模板 | 合约/平台 | P2 | T22 |
| T30 | 实现账户余额查询与历史接口 | 后端 | P1 | T11,T12,T13 |
| T31 | 实现 indexer 骨架与区块游标管理 | 后端/链 | P1 | T04,T11,T20 |
| T32 | 实现 Deposit/Withdraw 事件入账 | 后端/链 | P1 | T31 |
| T33 | 实现提现请求校验与链上发起骨架 | 后端/链 | P2 | T12,T30,T22 |
| T40 | 实现 trade engine 下单/平仓核心逻辑 | 交易核心 | P1 | T02,T03,T11,T30,T06 |
| T41 | 实现 PnL、保证金、清算价计算模块 | 交易核心 | P1 | T02 |
| T42 | 实现清算巡检任务 | 交易核心 | P2 | T40,T41,T05 |
| T43 | 实现 BullMQ 队列与 DLQ 配置 | Worker | P1 | T05,T10 |
| T44 | 实现 hedge worker 与重试策略 | Worker | P1 | T43,T40,T06 |
| T45 | 实现净头寸对账任务 | Worker | P2 | T44 |
| T50 | 初始化 Next.js 15 前端工程 | 前端 | P1 | T01 |
| T51 | 实现钱包连接与 SIWE 登录流程 | 前端 | P1 | T03,T50,T12 |
| T52 | 实现余额页、充值页、提现页 | 前端 | P1 | T03,T50,T30,T32,T33 |
| T53 | 实现交易面板与仓位列表 | 前端 | P1 | T03,T50,T40,T41 |
| T54 | 接入 Socket.IO 行情与仓位推送 | 前端 | P2 | T14,T53 |
| T55 | 接入合约 ABI 与 deposit/approve 流程 | 前端 | P1 | T22,T50 |
| T60 | 建立 API 集成测试 | 测试/后端 | P2 | T12,T30,T40 |
| T61 | 建立 trade engine 单元测试 | 测试/交易核心 | P1 | T40,T41 |
| T62 | 建立合约测试覆盖率基线 | 测试/合约 | P2 | T21 |
| T63 | 建立端到端 Demo checklist | 测试/产品 | P1 | T32,T44,T52,T53,T55 |
| T70 | 健康检查、运行文档、env 示例 | 平台 | P2 | T10,T50,T22 |
| T71 | Demo 部署与演示脚本 | 平台 | P2 | T63,T70 |

---

## 5. 任务详情

### Sprint 0: 解耦与脚手架

#### T01 定义 monorepo 包结构与命名约定

- 建议结构：
  - `apps/web`
  - `apps/api`
  - `packages/shared`
  - `packages/contracts`
- 验收标准：
  - package manager、workspace、lint/test 命令约定明确
  - 各包职责文档化

#### T02 冻结 Prisma schema 与枚举定义

- 范围：
  - `User`
  - `Account`
  - `Order`
  - `Position`
  - `Transaction`
  - `HedgeOrder`
- 关键决策：
  - USDC 使用 `BigInt` 6 位精度
  - 价格与数量使用高精度 decimal
  - 状态枚举统一
- 验收标准：
  - schema 可生成迁移
  - 状态机字段能覆盖 PRD 中全部流程

#### T03 冻结 API contract 与共享 DTO/schema

- 范围：
  - 鉴权接口
  - 用户余额/仓位/历史接口
  - 下单/平仓/补保证金接口
  - 行情与系统接口
- 验收标准：
  - 每个接口定义 request/response/error shape
  - 前后端可以共享 schema

#### T04 冻结链上事件入库模型与幂等键

- 必须明确：
  - `tx_hash`
  - `log_index`
  - `event_name`
  - `user`
  - `amount`
  - `status`
- 验收标准：
  - 重复扫块不会重复记账
  - 可以从事件唯一定位到账务变更

#### T05 冻结 hedge queue payload 与状态机

- 必须明确：
  - `hedge task` 输入字段
  - 任务优先级
  - 重试计数
  - `pending -> submitted -> filled/failed`
- 验收标准：
  - worker 与 trade engine 可并行开发

#### T06 提供 mock adapters

- 范围：
  - mock price feed
  - mock Hyperliquid client
  - mock auth session
- 验收标准：
  - 前端和交易核心不依赖真实外部服务即可开发

### Sprint 1: 后端与合约并行

#### T10-T14 后端基础能力

- 目标：
  - Fastify 服务可启动
  - Prisma 可迁移
  - 配置、日志、错误处理中间件可用
  - Socket.IO 服务骨架可连接
- 关闭条件：
  - 本地 `api` 服务能返回 `health`
  - 数据库连接稳定

#### T20-T23 合约线

- 目标：
  - Vault 合约支持 `deposit` / `withdraw`
  - 事件与权限模型确定
  - Foundry 测试通过
  - 部署脚本可产出 ABI
- 关闭条件：
  - ABI 可直接被前端与后端消费

### Sprint 2: 账户、交易、Indexer、Worker 并行

#### T30-T33 账户与链上同步

- 目标：
  - 余额接口可读
  - Deposit/Withdraw 事件可入账
  - 提现流程具备最小骨架
- 关闭条件：
  - 充值成功后 `available_balance` 更新
  - 提现状态可以追踪

#### T40-T45 交易与对冲

- 目标：
  - 下单时锁定保证金
  - 平仓时释放保证金并计算已实现盈亏
  - 对冲任务可异步执行
  - 失败后可重试并保留风险状态
- 关闭条件：
  - 用户成交不依赖对冲成功
  - 对冲状态可查询

### Sprint 3: 前端联调与 Demo

#### T50-T55 前端主链路

- 页面范围：
  - 钱包登录
  - 资产页
  - 充值/提现弹窗
  - 交易面板
  - 仓位列表
- 关闭条件：
  - 可以从前端走完整条用户闭环
  - 错误、pending、confirmed 状态可见

#### T60-T71 测试、运维、演示

- 范围：
  - API 集成测试
  - 交易逻辑单元测试
  - 合约测试
  - 演示环境和 runbook
- 关闭条件：
  - 新成员可按文档启动项目
  - Demo 过程不依赖口头说明

---

## 6. 推荐泳道分工

### 4 人配置

- A：合约线
  - `T20-T23`
- B：后端基础 + 鉴权 + 账户
  - `T01-T05`
  - `T10-T14`
  - `T30-T33`
- C：交易核心 + Worker
  - `T40-T45`
- D：前端
  - `T50-T55`

### 6 人配置

- A：合约
- B：后端基础/鉴权
- C：账户/Indexer
- D：交易核心
- E：Worker/对冲
- F：前端

---

## 7. 每日推进顺序建议

每日站会只看三类问题：

- 哪些 `P0` 任务尚未冻结
- 哪些任务被上游契约阻塞
- 哪些任务可以切到 mock 继续推进

推荐节奏：

1. 先清空 `T01-T06`
2. 再并行推进 `T10/T20/T50`
3. 然后并行推进 `T30/T40/T43`
4. 最后集中到 `T52-T55/T60-T71`

---

## 8. Issue 模板建议

每个 issue 建议固定包含以下字段：

- 背景
- 目标
- 输入输出
- 前置依赖
- 非目标范围
- 验收标准
- 测试要求

示例标题：

- `[P0][Backend] T02 冻结 Prisma schema 与枚举定义`
- `[P1][Contract] T20 完成 Vault 合约实现`
- `[P1][Frontend] T53 实现交易面板与仓位列表`

---

## 9. 第一批必须立即创建的 issue

如果只创建 10 个初始 issue，建议是：

1. `T01` 定义 monorepo 包结构与命名约定
2. `T02` 冻结 Prisma schema 与枚举定义
3. `T03` 冻结 API contract 与共享 DTO/schema
4. `T04` 冻结链上事件入库模型与幂等键
5. `T05` 冻结 hedge queue payload 与状态机
6. `T06` 提供 mock adapters
7. `T10` 初始化 Fastify API 工程
8. `T20` 完成 Vault 合约实现
9. `T40` 实现 trade engine 下单/平仓核心逻辑
10. `T50` 初始化 Next.js 15 前端工程

---

## 10. 风险提示

- 如果 `T02/T03/T05` 没冻结就同时开工，后续返工概率很高
- 如果前端等待真实链路才开始，整体节奏会明显变慢
- 如果交易引擎和对冲 worker 没有共享状态模型，联调会卡住
- 如果 indexer 不先定义幂等键，账务问题会最难排查
