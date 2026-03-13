# PerpDex E2E 测试实施方案

> **目标**: 基于 `CORE-FLOW-TEST-CHECKLIST.md` 实现自动化 E2E 测试
> **工具**: Playwright + 自定义 Web3 Mock / 测试钱包
> **分层策略**: Mock E2E → API 集成 → 真实闭环

---

## 一、测试分层策略

由于 DApp 涉及钱包签名，采用三层渐进式测试策略：

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Real E2E (真实闭环)                                  │
│ - Playwright + 真实 Testnet 钱包                              │
│ - 覆盖: 充值→开仓→平仓→提现 完整链上流程                       │
│ - 频率: 每次发布前 / 每日一次                                  │
│ - 成本: 需要 Testnet ETH/USDC，执行慢                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: API 集成测试                                         │
│ - Supertest + Prisma Test DB                                 │
│ - 覆盖: TradeEngine、余额计算、数据库状态                      │
│ - 频率: 每次提交                                               │
│ - 成本: 快，无外部依赖                                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Mock E2E (UI 交互)                                   │
│ - Playwright + Mock Service Worker (MSW)                     │
│ - 覆盖: 前端 UI 流程、路由、状态管理                            │
│ - 频率: 每次提交                                               │
│ - 成本: 最快，完全隔离                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Layer 1: Mock E2E (UI 流程)

### 2.1 安装依赖

```bash
cd apps/web

# Playwright
pnpm add -D @playwright/test

# MSW (Mock Service Worker)
pnpm add -D msw@latest

# 测试工具
pnpm add -D @testing-library/react @testing-library/jest-dom
```

### 2.2 配置 Playwright

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 注入 Mock 钱包
        contextOptions: {
          bypassCSP: true,
        }
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

### 2.3 Mock 钱包方案

```typescript
// e2e/fixtures/mock-wallet.ts
import { Page } from '@playwright/test'

export interface MockWallet {
  address: string
  chainId: number
  isConnected: boolean
}

export async function injectMockWallet(page: Page, wallet: MockWallet) {
  await page.addInitScript((walletData) => {
    // Mock EIP-1193 Provider
    const mockProvider = {
      isMetaMask: true,
      _wallet: walletData,

      async request({ method, params }: { method: string; params?: any[] }) {
        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
            return [walletData.address]

          case 'eth_chainId':
            return `0x${walletData.chainId.toString(16)}`

          case 'eth_sign':
          case 'personal_sign': {
            // 返回模拟签名
            const message = params?.[0] || ''
            return `0x${'a'.repeat(130)}` // 模拟 65 字节签名
          }

          case 'eth_sendTransaction': {
            // 返回模拟交易哈希
            return `0x${'b'.repeat(64)}`
          }

          case 'eth_getBalance':
            return '0x2386f26fc10000' // 0.01 ETH

          default:
            throw new Error(`Method ${method} not mocked`)
        }
      },

      on: (event: string, handler: Function) => {
        // Mock event emitter
      },

      removeListener: (event: string, handler: Function) => {
        // Mock remove listener
      }
    }

    // 注入到 window.ethereum
    window.ethereum = mockProvider as any

    // 触发连接事件
    window.dispatchEvent(new Event('ethereum#initialized'))
  }, wallet)
}

// Mock 用户数据
export const MOCK_WALLET = {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  chainId: 421614, // Arbitrum Sepolia
  isConnected: true,
}

export const MOCK_USER = {
  id: 'user_test_001',
  walletAddress: MOCK_WALLET.address,
  availableBalance: '1000.00',
  lockedBalance: '0.00',
  equity: '1000.00',
}
```

### 2.4 MSW API Mock

```typescript
// e2e/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // 登录相关
  http.get('/api/auth/challenge', () => {
    return HttpResponse.json({
      data: {
        nonce: 'test_nonce_123',
        message: 'Sign in to PerpDex\nNonce: test_nonce_123',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
      error: null,
    })
  }),

  http.post('/api/auth/verify', () => {
    return HttpResponse.json({
      data: {
        accessToken: 'mock_jwt_token_' + Date.now(),
        user: {
          id: 'user_test_001',
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          createdAt: new Date().toISOString(),
        },
      },
      error: null,
    })
  }),

  http.get('/api/auth/session', () => {
    return HttpResponse.json({
      data: {
        authenticated: true,
        user: {
          id: 'user_test_001',
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        },
      },
      error: null,
    })
  }),

  // 余额相关
  http.get('/api/user/balance', () => {
    return HttpResponse.json({
      data: {
        userId: 'user_test_001',
        asset: 'USDC',
        availableBalance: '1000.00',
        lockedBalance: '0.00',
        equity: '1000.00',
        updatedAt: new Date().toISOString(),
      },
      error: null,
    })
  }),

  // 仓位相关
  http.get('/api/user/positions', () => {
    return HttpResponse.json({
      data: {
        items: [],
      },
      error: null,
    })
  }),

  // 下单
  http.post('/api/trade/order', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      data: {
        order: {
          id: 'order_' + Date.now(),
          symbol: body.symbol,
          side: body.side,
          type: 'MARKET',
          size: body.size,
          margin: body.margin,
          leverage: body.leverage,
          executedPrice: '65000.00',
          status: 'FILLED',
          createdAt: new Date().toISOString(),
        },
        position: {
          id: 'position_' + Date.now(),
          symbol: body.symbol,
          side: body.side,
          positionSize: body.size,
          entryPrice: '65000.00',
          markPrice: '65000.00',
          unrealizedPnl: '0',
          liquidationPrice: body.side === 'LONG' ? '58500.00' : '71500.00',
          margin: body.margin,
          status: 'OPEN',
          riskLevel: 'SAFE',
        },
        hedgeTaskId: 'hedge_' + Date.now(),
      },
      error: null,
    })
  }),

  // 平仓
  http.delete('/api/trade/positions/:id', () => {
    return HttpResponse.json({
      data: {
        order: {
          id: 'close_order_' + Date.now(),
          status: 'FILLED',
          realizedPnl: '50.00',
        },
        position: null,
        hedgeTaskId: 'hedge_close_' + Date.now(),
      },
      error: null,
    })
  }),

  // 历史记录
  http.get('/api/user/history', () => {
    return HttpResponse.json({
      data: {
        items: [
          {
            id: 'tx_001',
            type: 'DEPOSIT',
            amount: '1000.00',
            status: 'CONFIRMED',
            createdAt: new Date().toISOString(),
          },
        ],
        nextCursor: null,
      },
      error: null,
    })
  }),

  // 行情
  http.get('/api/markets/BTC/price', () => {
    return HttpResponse.json({
      data: {
        symbol: 'BTC',
        price: '65000.00',
        change24h: '2.5',
        volume24h: '1000000000',
        timestamp: Date.now(),
      },
      error: null,
    })
  }),
]
```

### 2.5 Page Object Model

```typescript
// e2e/pages/trading-page.ts
import { Page, Locator, expect } from '@playwright/test'

export class TradingPage {
  readonly page: Page

  // Market Stats
  readonly btcPrice: Locator
  readonly priceChange: Locator

  // Order Form
  readonly longButton: Locator
  readonly shortButton: Locator
  readonly marginInput: Locator
  readonly leverageSlider: Locator
  readonly submitOrderButton: Locator
  readonly availableBalance: Locator

  // Position Panel
  readonly positionList: Locator
  readonly noPositionsMessage: Locator

  constructor(page: Page) {
    this.page = page

    // Market Stats
    this.btcPrice = page.locator('[data-testid="btc-price"]').or(page.locator('text=BTC').first())

    // Order Form
    this.longButton = page.locator('button:has-text("开多")')
    this.shortButton = page.locator('button:has-text("开空")')
    this.marginInput = page.locator('input[type="number"]').first()
    this.leverageSlider = page.locator('[data-testid="leverage-slider"]').or(page.locator('input[type="range"]'))
    this.submitOrderButton = page.locator('button:has-text("开多")').last().or(page.locator('button:has-text("开空")').last())
    this.availableBalance = page.locator('text=可用:')

    // Position Panel
    this.positionList = page.locator('[data-testid="position-item"]')
    this.noPositionsMessage = page.locator('text=暂无仓位')
  }

  async goto() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  async connectWallet() {
    // 点击连接钱包
    const connectButton = this.page.locator('button:has-text("连接钱包")')
    await connectButton.click()

    // 等待连接完成
    await this.page.waitForSelector('text=0x74...', { timeout: 5000 })
  }

  async login() {
    // 连接钱包后自动触发登录流程
    await this.connectWallet()

    // 等待登录完成 (SIWE 签名在 Mock 中是自动的)
    await this.page.waitForTimeout(1000)
  }

  async switchToLong() {
    await this.longButton.first().click()
    await expect(this.longButton.first()).toHaveClass(/bg-pro-accent-green/)
  }

  async switchToShort() {
    await this.shortButton.first().click()
    await expect(this.shortButton.first()).toHaveClass(/bg-pro-accent-red/)
  }

  async setMargin(amount: string) {
    await this.marginInput.fill(amount)
  }

  async setLeverage(leverage: number) {
    // 通过键盘输入设置杠杆
    await this.leverageSlider.fill(leverage.toString())
  }

  async submitOrder() {
    await this.submitOrderButton.click()

    // 等待提交完成
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/trade/order') && resp.status() === 200
    )
  }

  async getPositionCount() {
    return await this.positionList.count()
  }

  async closePosition(index: number = 0) {
    const closeButton = this.positionList.nth(index).locator('button:has-text("平仓")')
    await closeButton.click()

    // 等待平仓完成
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/trade/positions') && resp.request().method() === 'DELETE'
    )
  }

  async expectOrderSuccessToast() {
    await expect(this.page.locator('text=开仓成功').or(this.page.locator('text=成功'))).toBeVisible({ timeout: 5000 })
  }
}
```

### 2.6 测试用例实现

```typescript
// e2e/specs/trading-flow.spec.ts
import { test, expect } from '@playwright/test'
import { TradingPage } from '../pages/trading-page'
import { injectMockWallet, MOCK_WALLET } from '../fixtures/mock-wallet'
import { setupServer } from 'msw/node'
import { handlers } from '../mocks/handlers'

const server = setupServer(...handlers)

test.beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
})

test.afterAll(() => {
  server.close()
})

test.beforeEach(async ({ page }) => {
  // 注入 Mock 钱包
  await injectMockWallet(page, MOCK_WALLET)
})

test.describe('交易核心流程', () => {
  test('未登录状态首页显示正常', async ({ page }) => {
    const tradingPage = new TradingPage(page)
    await tradingPage.goto()

    // 验证页面结构
    await expect(page.locator('text=连接钱包')).toBeVisible()
    await expect(page.locator('text=BTC')).toBeVisible()
    await expect(page.locator('button:has-text("开多")')).toBeVisible()
    await expect(page.locator('button:has-text("开空")')).toBeVisible()
  })

  test('SIWE 登录流程', async ({ page }) => {
    const tradingPage = new TradingPage(page)
    await tradingPage.goto()
    await tradingPage.login()

    // 验证登录成功
    await expect(page.locator('text=0x74')).toBeVisible()
  })

  test('开仓 - 市价开多', async ({ page }) => {
    const tradingPage = new TradingPage(page)
    await tradingPage.goto()
    await tradingPage.login()

    // 选择开多
    await tradingPage.switchToLong()

    // 设置保证金
    await tradingPage.setMargin('100')

    // 设置杠杆
    await tradingPage.setLeverage(10)

    // 验证订单估算显示
    await expect(page.locator('text=仓位大小')).toBeVisible()
    await expect(page.locator('text=开仓价格')).toBeVisible()
    await expect(page.locator('text=清算价格')).toBeVisible()

    // 提交订单
    await tradingPage.submitOrder()

    // 验证成功提示
    await tradingPage.expectOrderSuccessToast()

    // 验证仓位显示
    const positionCount = await tradingPage.getPositionCount()
    expect(positionCount).toBeGreaterThan(0)
  })

  test('平仓 - 市价平仓', async ({ page }) => {
    const tradingPage = new TradingPage(page)
    await tradingPage.goto()
    await tradingPage.login()

    // 先开仓
    await tradingPage.switchToLong()
    await tradingPage.setMargin('100')
    await tradingPage.submitOrder()
    await tradingPage.expectOrderSuccessToast()

    // 平仓
    await tradingPage.closePosition(0)

    // 验证平仓成功
    await expect(page.locator('text=平仓成功').or(page.locator('text=已平仓'))).toBeVisible({ timeout: 5000 })
  })

  test('余额不足时禁止下单', async ({ page }) => {
    const tradingPage = new TradingPage(page)
    await tradingPage.goto()
    await tradingPage.login()

    // 输入超过可用余额的保证金
    await tradingPage.setMargin('999999')

    // 验证提交按钮被禁用
    await expect(tradingPage.submitOrderButton).toBeDisabled()
  })

  test('切换多空方向', async ({ page }) => {
    const tradingPage = new TradingPage(page)
    await tradingPage.goto()
    await tradingPage.login()

    // 默认开多
    await tradingPage.switchToLong()
    await expect(page.locator('button:has-text("开多 BTC")')).toBeVisible()

    // 切换到开空
    await tradingPage.switchToShort()
    await expect(page.locator('button:has-text("开空 BTC")')).toBeVisible()
  })
})

test.describe('资产管理流程', () => {
  test('资产页显示余额', async ({ page }) => {
    await page.goto('/assets')
    await injectMockWallet(page, MOCK_WALLET)

    // 登录
    const connectButton = page.locator('button:has-text("连接钱包")')
    await connectButton.click()
    await page.waitForTimeout(1000)

    // 验证余额显示
    await expect(page.locator('text=1000.00')).toBeVisible()
    await expect(page.locator('text=可用余额')).toBeVisible()
    await expect(page.locator('text=已锁定')).toBeVisible()
  })

  test('历史记录页面', async ({ page }) => {
    await page.goto('/history')
    await injectMockWallet(page, MOCK_WALLET)

    // 登录
    const connectButton = page.locator('button:has-text("连接钱包")')
    await connectButton.click()
    await page.waitForTimeout(1000)

    // 验证历史记录列表
    await expect(page.locator('text=DEPOSIT').or(page.locator('text=充值'))).toBeVisible()
  })
})
```

---

## 三、Layer 2: API 集成测试

### 3.1 已有基础

后端已使用 Vitest，可以直接扩展集成测试：

```typescript
// apps/api/tests/integration/trade.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../src/app'
import { prisma } from '../../src/db/client'

describe('Trade API Integration', () => {
  let app: ReturnType<typeof buildApp>
  let authToken: string
  let userId: string

  beforeAll(async () => {
    app = buildApp()

    // 创建测试用户并获取 token
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xTestWallet123',
      }
    })
    userId = user.id

    // 创建账户并充值
    await prisma.account.create({
      data: {
        userId: user.id,
        asset: 'USDC',
        availableBalance: 1000000000n, // 1000 USDC
        lockedBalance: 0n,
        equity: 1000000000n,
      }
    })

    // 获取 JWT token
    // ... 调用登录接口
  })

  afterAll(async () => {
    // 清理测试数据
    await prisma.order.deleteMany({ where: { userId } })
    await prisma.position.deleteMany({ where: { userId } })
    await prisma.transaction.deleteMany({ where: { userId } })
    await prisma.account.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('should create market order and position', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/trade/order',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        symbol: 'BTC',
        side: 'LONG',
        size: '0.01538', // 100 USDC * 10x / 65000
        margin: '100000000', // 100 USDC (6 decimals)
        leverage: 10,
      },
    })

    expect(response.statusCode).toBe(200)

    const data = JSON.parse(response.body)
    expect(data.data.order.status).toBe('FILLED')
    expect(data.data.position).toBeDefined()
    expect(data.data.hedgeTaskId).toBeDefined()

    // 验证数据库状态
    const account = await prisma.account.findUnique({
      where: { userId_asset: { userId, asset: 'USDC' } }
    })

    expect(account?.availableBalance).toBe(900000000n) // 1000 - 100
    expect(account?.lockedBalance).toBe(100000000n) // 100 locked
  })

  it('should reject order with insufficient balance', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/trade/order',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        symbol: 'BTC',
        side: 'LONG',
        size: '1',
        margin: '2000000000', // 2000 USDC (超过可用)
        leverage: 10,
      },
    })

    expect(response.statusCode).toBe(400)
    const data = JSON.parse(response.body)
    expect(data.error.code).toBe('INSUFFICIENT_BALANCE')
  })
})
```

---

## 四、Layer 3: Real E2E (真实闭环)

### 4.1 测试钱包准备

```typescript
// e2e-real/fixtures/test-wallet.ts
import { Wallet } from 'ethers'

// 使用固定的测试钱包（需要提前在 Testnet 获取 ETH 和 USDC）
export const TEST_WALLET = {
  privateKey: process.env.TEST_WALLET_PRIVATE_KEY!, // 从环境变量读取
  address: '0x...',
}

// 使用 Playwright 的 browserContext 注入真实钱包
export async function injectRealWallet(page: Page, privateKey: string) {
  await page.addInitScript((key) => {
    const wallet = new Wallet(key)

    window.ethereum = {
      isMetaMask: true,

      async request({ method, params }: any) {
        switch (method) {
          case 'eth_requestAccounts':
            return [wallet.address]

          case 'personal_sign': {
            const message = params?.[0] || ''
            return await wallet.signMessage(message)
          }

          case 'eth_sendTransaction': {
            // 这里需要连接到真实的 provider
            const tx = params?.[0]
            const provider = new JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc')
            const connectedWallet = wallet.connect(provider)
            const response = await connectedWallet.sendTransaction(tx)
            return response.hash
          }

          default:
            throw new Error(`Method ${method} not implemented`)
        }
      },
    }
  }, privateKey)
}
```

### 4.2 真实 E2E 测试

```typescript
// e2e-real/specs/full-loop.spec.ts
import { test, expect } from '@playwright/test'
import { injectRealWallet, TEST_WALLET } from '../fixtures/test-wallet'
import { TradingPage } from '../../e2e/pages/trading-page'

test.describe.skip('真实闭环测试 (仅在 Testnet 执行)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.TEST_WALLET_PRIVATE_KEY, '需要 TEST_WALLET_PRIVATE_KEY')
    test.skip(process.env.NODE_ENV === 'production', '禁止在生产环境执行')

    await injectRealWallet(page, TEST_WALLET.privateKey)
  })

  test('完整闭环: 充值→开仓→平仓', async ({ page }) => {
    const tradingPage = new TradingPage(page)

    // 1. 登录
    await tradingPage.goto()
    await tradingPage.login()

    // 2. 充值 (真实链上操作)
    // ... 调用合约 approve + deposit

    // 3. 等待 Indexer 入账 (轮询余额)
    await page.waitForFunction(async () => {
      const response = await fetch('/api/user/balance')
      const data = await response.json()
      return parseFloat(data.data.availableBalance) > 0
    }, { timeout: 60000 })

    // 4. 开仓
    await tradingPage.switchToLong()
    await tradingPage.setMargin('10') // 小额测试
    await tradingPage.submitOrder()

    // 等待链上确认和索引
    await page.waitForTimeout(5000)

    // 5. 验证仓位
    const positions = await tradingPage.getPositionCount()
    expect(positions).toBe(1)

    // 6. 平仓
    await tradingPage.closePosition(0)

    // 等待链上确认
    await page.waitForTimeout(5000)

    // 7. 验证平仓成功
    await expect(page.locator('text=已平仓')).toBeVisible()
  })
})
```

---

## 五、测试执行策略

### 5.1 命令配置

```json
// apps/web/package.json
{
  "scripts": {
    "test:e2e:mock": "playwright test e2e/specs --project=chromium",
    "test:e2e:mock:ui": "playwright test e2e/specs --ui",
    "test:e2e:real": "playwright test e2e-real/specs --project=chromium",
    "test:e2e:report": "playwright show-report playwright-report"
  }
}
```

### 5.2 CI/CD 配置

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  mock-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter @perpdex/web exec playwright install --with-deps chromium

      - name: Run Mock E2E Tests
        run: pnpm --filter @perpdex/web test:e2e:mock
        env:
          CI: true

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-mock
          path: apps/web/playwright-report/
          retention-days: 7

  real-e2e:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' # 只在 main 分支执行
    environment: testnet # 需要审批
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter @perpdex/web exec playwright install --with-deps chromium

      - name: Run Real E2E Tests
        run: pnpm --filter @perpdex/web test:e2e:real
        env:
          TEST_WALLET_PRIVATE_KEY: ${{ secrets.TEST_WALLET_PRIVATE_KEY }}
          CI: true
```

---

## 六、测试数据管理

### 6.1 数据库隔离

```typescript
// apps/api/tests/setup.ts
import { prisma } from '../src/db/client'

// 每个测试前清理数据
export async function cleanupTestData() {
  await prisma.$transaction([
    prisma.hedgeOrder.deleteMany(),
    prisma.order.deleteMany(),
    prisma.position.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

// 创建测试用户
export async function createTestUser(walletAddress: string) {
  return prisma.user.create({
    data: {
      walletAddress,
      accounts: {
        create: {
          asset: 'USDC',
          availableBalance: 1000000000n,
          lockedBalance: 0n,
          equity: 1000000000n,
        }
      }
    },
    include: { accounts: true }
  })
}
```

---

## 七、实施优先级

### Phase 1: Mock E2E (本周)
- [ ] 安装 Playwright + MSW
- [ ] 配置 Mock 钱包
- [ ] 实现核心 POM
- [ ] 覆盖登录、开仓、平仓流程

### Phase 2: API 集成 (下周)
- [ ] 完善 Vitest 集成测试
- [ ] 覆盖 TradeEngine 核心逻辑
- [ ] 覆盖余额计算边界情况

### Phase 3: Real E2E (发布前)
- [ ] 配置 Testnet 测试钱包
- [ ] 实现真实链上测试
- [ ] 配置 CI/CD 自动化

---

## 八、风险与对策

| 风险 | 对策 |
|------|------|
| Web3 钱包难以自动化 | 使用 Mock Provider 分层测试 |
| Testnet 不稳定 | 重试机制 + 本地分叉网络 |
| 测试代币不足 | 监控余额，低于阈值告警 |
| 测试执行慢 | 并行执行 + 缓存 + 选择性执行 |
| 状态污染 | 每个测试独立数据库事务 |

---

这套方案可以让你在 **没有真实钱包** 的情况下快速验证前端流程，同时保留 **真实闭环测试** 的能力用于发布前的最终验证。
