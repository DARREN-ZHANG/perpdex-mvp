# PerpDex MVP 产品需求文档

## 1. 文档定位

- 文档名称：PerpDex MVP PRD
- 文档目的：基于原始技术要求、产品版 PRD 与工程版 PRD 融合形成一份更适合技术执行的版本
- 适用阶段：MVP / Demo / 技术验证
- 目标读者：产品、前端、后端、合约、测试

本文将需求分为三类：

- `必须项`：当前版本必须实现
- `建议项`：强烈建议实现，提升工程可执行性
- `默认方案`：如无进一步确认，研发可直接采用

---

## 2. 项目目标

构建一个最小可运行的永续合约交易系统，完成以下闭环：

`Wallet Login -> Deposit -> Trade -> Position -> Hedge -> Withdraw`

系统需覆盖以下模块：

- Frontend
- Backend API
- Trade Engine
- Vault Smart Contract
- Blockchain Indexer
- Hedging Bot
- Database

核心价值：

- 用户可以用钱包直接登录并交易
- 用户资金通过链上 Vault 托管
- 平台内部维护保证金与仓位账本
- 用户成交后，系统自动在 Hyperliquid Testnet 对冲风险

---

## 3. 产品范围

### 3.1 必须项

- 支持 MetaMask 登录，兼容 EVM 钱包
- 支持 USDC 充值与提现
- 支持 Vault 合约 `deposit` / `withdraw`
- 支持监听 `Deposit` / `Withdraw` 事件并同步余额
- 支持 `BTC` 永续合约交易
- 支持市价开多、市价开空、平仓
- 支持仓位维护：`position_size`、`entry_price`、`unrealized_pnl`、`liquidate_price`
- 支持基础清算能力
- 支持 Hyperliquid Testnet 自动对冲
- 支持查看余额、仓位、历史记录

### 3.2 暂不纳入本期

- 限价单、止盈止损、条件单
- 多资产抵押
- 多链支持
- 资金费率
- 完整订单簿与撮合深度
- 复杂后台和运营体系
- 生产级高并发优化

---

## 4. 用户故事

### US-1 钱包登录

作为交易用户，我希望使用 EVM 钱包登录系统，以便无需账号密码即可完成身份认证并开始交易。

验收标准：

- 支持 MetaMask 和其他 EVM 兼容钱包
- 登录采用 SIWE（Sign-In with Ethereum）标准
- nonce 一次性使用，默认 5 分钟过期
- session/JWT 默认 24 小时过期
- 非法签名、过期签名必须拒绝

### US-2 充值 USDC

作为交易用户，我希望将 USDC 充值到平台，以便获得交易保证金。

验收标准：

- 支持 `approve + deposit` 标准流程
- 仅支持 USDC
- 余额变更以链上事件为准
- 前端展示 `pending / confirmed / failed` 状态
- 事件重复处理不得导致重复记账

### US-3 市价开仓

作为交易用户，我希望对 BTC 发起市价开多或开空，以便快速建立仓位。

验收标准：

- 支持 `BTC`
- 支持 Long / Short
- 支持杠杆和保证金输入
- 可用余额不足时拒绝下单
- 下单成功后立即生成仓位与成交记录

### US-4 管理仓位

作为交易用户，我希望查看仓位的价格、盈亏与风险状态，并可执行平仓或补保证金操作。

验收标准：

- 展示 `entry price`、`mark price`、`unrealized pnl`、`liquidation price`
- 至少支持全平仓
- 建议支持加保证金
- 仓位风险应有状态标识，如 `Safe / Warning / Danger`

### US-5 提现

作为交易用户，我希望提现可用 USDC，以便将资金取回钱包。

验收标准：

- 只能提取 `available_balance`
- 有持仓时不得提取已锁定保证金
- 提现结果以链上成功和 `Withdraw` 事件为准

### US-6 自动对冲

作为平台，我希望在用户交易后自动在 Hyperliquid Testnet 对冲风险，以便尽量保持 delta-neutral。

验收标准：

- 用户成交后自动创建对冲任务
- 对冲任务支持重试，默认最多 3 次
- 对冲失败不回滚用户成交，但必须记录风险状态
- 系统应定时对账净头寸

---

## 5. 关键业务流程

### 5.1 登录流程

1. 用户连接钱包
2. 前端调用 `GET /api/auth/challenge`
3. 用户签署 SIWE 消息
4. 前端调用 `POST /api/auth/verify`
5. 后端校验签名、nonce、时效性
6. 返回 token/session

### 5.2 充值流程

1. 用户输入充值金额
2. 前端发起 USDC `approve`
3. 前端调用 Vault `deposit`
4. 合约触发 `Deposit`
5. Indexer 监听并入账
6. 更新 `available_balance`

### 5.3 开仓流程

1. 用户选择 `BTC`
2. 用户选择 `long/short`
3. 输入 `margin` 和 `leverage`
4. 后端检查余额、参数和风险
5. 交易引擎以标记价格执行市价单
6. 锁定保证金、写入仓位
7. 创建对冲任务并异步提交 Hyperliquid

### 5.4 平仓流程

1. 用户发起平仓
2. 系统按标记价格计算已实现盈亏
3. 释放保证金并更新余额
4. 触发反向对冲
5. 更新仓位状态

### 5.5 提现流程

1. 用户输入提现金额
2. 系统校验 `available_balance`
3. 发起提现执行
4. 合约触发 `Withdraw`
5. Indexer 更新提现状态和余额

---

## 6. 功能需求

## 6.1 鉴权模块

### 必须项

- 使用 SIWE 登录
- 支持 challenge -> sign -> verify 流程
- 所有交易/账户相关接口需鉴权

### 建议项

- 使用 JWT
- nonce 5 分钟过期
- session 24 小时过期

### 推荐接口

```ts
GET  /api/auth/challenge
POST /api/auth/verify
GET  /api/auth/session
POST /api/auth/logout
```

## 6.2 Vault 合约

### 必须项

- 支持 `deposit(uint256 amount)`
- 支持 `withdraw(...)`
- 发出 `Deposit(address user, uint256 amount)`
- 发出 `Withdraw(address user, uint256 amount)`

### 建议项

- 使用 `ReentrancyGuard`
- 支持 `Pausable`
- 明确 USDC 为 6 位精度

### 默认方案

- 若采用平台托管式提现，可使用 `withdraw(address user, uint256 amount) onlyOwner`
- 若采用用户自助提现，可单独定义用户可调用提现接口

说明：

- 原始需求未强制提现权限模型，因此此处保留实现弹性，不在 PRD 中锁死单一技术方案

## 6.3 账户余额模块

### 必须字段

- `available_balance`
- `locked_balance`
- `equity`

### 规则

- 充值成功增加 `available_balance`
- 开仓时从 `available_balance` 转移到 `locked_balance`
- 平仓时释放保证金并结算盈亏
- 提现时扣减 `available_balance`
- 事件处理必须幂等

## 6.4 行情与价格模块

### 必须项

- 提供 BTC 实时价格
- 提供 K 线或近似图表能力
- 所有成交、PnL、清算使用统一标记价格

### 默认方案

- 主价格源：Hyperliquid API
- 备用价格源：Binance API 或 mock price
- 更新频率：2 秒

说明：

- 若研发时间紧张，可先用 polling；若需要更好体验，可使用 WebSocket

## 6.5 交易模块

### 必须项

- 交易模式：CFD / 简化永续模型
- 订单类型：仅 Market Order
- 交易对：`BTC`
- 支持杠杆与保证金输入

### 默认参数

- 杠杆范围：`1x ~ 20x`
- 最低保证金：`1 USDC`

说明：

- 充值最小值、最大值、单仓最大 BTC 等参数在你提供的 PRD 中属于工程假设，当前保留为可配置项，不写死为强制产品规则

### 订单模型建议

```ts
interface Order {
  id: string
  user: string
  symbol: 'BTC'
  side: 'long' | 'short'
  type: 'market'
  size: string
  requestedPrice?: string
  executedPrice: string
  margin: string
  leverage: number
  status: 'pending' | 'filled' | 'failed'
  createdAt: Date
}
```

## 6.6 仓位模块

### 必须项

- 记录 `position_size`
- 记录 `entry_price`
- 记录 `mark_price`
- 记录 `unrealized_pnl`
- 记录 `liquidation_price`
- 支持 `increase/reduce/close/liquidation`

### 默认方案

- 持仓模式：单用户单标的单向单仓
- PnL 刷新：2 秒
- 风险状态：`Safe / Warning / Danger`

### 公式建议

```ts
longPnl = size * (markPrice - entryPrice)
shortPnl = size * (entryPrice - markPrice)
```

说明：

- 你提供的 PRD 中给了清算价和健康度公式，这部分适合作为实现参考，但因不同保证金口径下计算会变化，因此本版保留“公式建议”，不写死为唯一标准

## 6.7 清算模块

### 必须项

- 系统可以检测保证金风险
- 当低于阈值时触发强平
- 清算过程可追踪、可复盘

### 默认方案

- 采用固定维持保证金率
- 采用简化强平逻辑
- 前端展示清算原因

### 建议项

- 定时检查周期：2 秒

## 6.8 对冲模块

### 必须项

- 成交后创建对冲任务
- 向 Hyperliquid Testnet 提交订单
- 记录提交、成功、失败状态
- 支持失败重试

### 默认方案

- 对冲平台：Hyperliquid Testnet
- 触发时机：开仓、平仓、仓位调整
- 重试机制：指数退避，最多 3 次
- 对账周期：2 秒
- 执行模式：逐笔异步对冲

### 状态建议

- `pending`
- `submitted`
- `filled`
- `failed`

---

## 7. API 建议

所有接口统一采用 `/api/*` 前缀。

### 7.1 鉴权

```text
GET    /api/auth/challenge
POST   /api/auth/verify
GET    /api/auth/session
POST   /api/auth/logout
```

### 7.2 用户数据

```text
GET    /api/user/balance
GET    /api/user/positions
GET    /api/user/history
```

### 7.3 交易

```text
POST   /api/trade/order
GET    /api/trade/positions/:id
PATCH  /api/trade/positions/:id/margin
DELETE /api/trade/positions/:id
```

### 7.4 行情

```text
GET    /api/markets
GET    /api/markets/:symbol
WS     /api/markets/:symbol/ws
```

### 7.5 系统

```text
GET    /api/health
GET    /api/hedge/tasks
```

---

## 8. 数据模型建议

### 8.1 User

- `id`
- `wallet_address`
- `nonce`
- `nonce_expires_at`
- `created_at`
- `last_login_at`

### 8.2 Account / Balance

- `user_id`
- `available_balance`
- `locked_balance`
- `equity`
- `updated_at`

### 8.3 Order

- `id`
- `user_id`
- `symbol`
- `side`
- `type`
- `size`
- `requested_price`
- `executed_price`
- `margin`
- `leverage`
- `status`
- `created_at`

### 8.4 Position

- `id`
- `user_id`
- `symbol`
- `side`
- `position_size`
- `entry_price`
- `mark_price`
- `unrealized_pnl`
- `liquidation_price`
- `margin`
- `status`
- `created_at`
- `updated_at`

### 8.5 Transaction / Onchain Event

- `id`
- `user_id`
- `type`
- `tx_hash`
- `log_index`
- `amount`
- `status`
- `created_at`

### 8.6 HedgeOrder

- `id`
- `position_id`
- `external_order_id`
- `symbol`
- `side`
- `size`
- `status`
- `retry_count`
- `error_message`
- `created_at`
- `updated_at`

### 精度建议

- USDC 余额：`BigInt`，6 位精度
- 价格/数量：`Decimal(36,18)` 或等价高精度方案

---

## 9. 非功能需求

### 9.1 性能

- API 响应：`p95 < 200ms`（建议目标）
- 余额更新延迟：`< 2 秒`（建议目标）
- 对冲提交：`< 2 秒`（建议目标）
- 行情刷新：`2 秒`

### 9.2 安全

- 签名校验使用标准 ECDSA 恢复
- nonce 一次性使用
- 所有输入必须校验
- 提现和交易必须鉴权
- 不得在代码中硬编码测试钱包私钥

### 9.3 可靠性

- 链上事件处理必须幂等
- 对冲失败必须保留待处理状态
- 使用关系型数据库保证账本一致性

### 9.4 可观测性

- 记录登录、充值、提现、下单、平仓、清算、对冲日志
- 关键任务需支持错误追踪

---

## 10. 异常与边界场景

- `INSUFFICIENT_BALANCE`：余额不足，拒绝下单
- `INVALID_SIGNATURE`：签名无效，拒绝登录
- `NONCE_EXPIRED`：nonce 过期，需重新获取 challenge
- `LOCKED_BALANCE`：提现金额超过可用余额，拒绝提现
- `HEDGE_FAILED`：对冲失败，重试并记录人工处理状态
- `LIQUIDATION_TRIGGERED`：达到清算条件，执行强平
- `NETWORK_CONGESTION`：链路拥堵时，对冲任务进入队列重试

---

## 11. 验收标准

### 11.1 必验项

1. 用户可以通过 MetaMask 完成 SIWE 登录
2. 用户可以完成 USDC 充值，且余额按链上事件更新
3. 用户可以在 BTC 进行市价开多和开空
4. 用户可以查看仓位、未实现盈亏和清算价格
5. 用户可以平仓并完成盈亏结算
6. 系统可以生成并执行对冲任务
7. 用户可以提取可用余额

### 11.2 建议测试覆盖

- 单元测试：核心计算与业务规则
- 集成测试：API、数据库、事件监听
- 合约测试：Vault
- E2E：登录 -> 充值 -> 开仓 -> 对冲 -> 平仓 -> 提现

说明：

- 你提供的“80% 覆盖率”和“161 个用例”更适合作为项目管理指标，不建议直接写成产品硬性要求；本版仅保留测试类型与关键路径要求

---

## 12. 默认技术基线

以下内容来自你提供的 PRD，适合作为推荐实现栈，但不作为产品硬约束：

- Runtime：Node.js 20 LTS
- Language：TypeScript
- Frontend：Next.js + RainbowKit + Wagmi
- Backend：Node.js API
- Database：PostgreSQL
- ORM：Prisma
- Testing：Vitest + Playwright + Foundry

说明：

- 链上网络建议采用 EVM 测试网，例如 Arbitrum Sepolia，但若团队已有既定测试环境，可按实现方案调整

---

## 13. 里程碑建议

### Phase 1

- 鉴权
- 数据库
- 基础类型定义

### Phase 2

- Vault 合约
- Indexer
- 余额系统

### Phase 3

- 交易引擎
- 仓位与 PnL
- 清算检查

### Phase 4

- Hyperliquid 对冲
- 对冲重试与对账

### Phase 5

- 前端交易页
- 资产页
- 历史记录与状态反馈

### Phase 6

- 测试联调
- Demo 验收

---

## 14. 融合结论

本版 PRD 保留了两份文档中最有价值的部分：

- 保留产品版 PRD 的业务闭环、范围界定、验收口径和研发友好的结构
- 吸收工程版 PRD 的 SIWE、接口定义、性能目标、异常处理、数据精度和实现基线
- 删除或降级未经确认且容易误导研发的内容，如硬编码测试钱包、过早锁死的提现方案、任意数字型阈值、与产品目标弱相关的固定测试数量

这份文档可作为下一步拆解技术方案、接口文档和任务排期的基础版本。
