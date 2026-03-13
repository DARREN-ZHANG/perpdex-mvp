// apps/web/types/api.ts

// 通用 API 响应格式
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

export interface ApiMeta {
  page?: number
  limit?: number
  total?: number
  hasMore?: boolean
}

// 认证相关类型
export interface AuthChallenge {
  message: string
  nonce: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface User {
  id: string
  address: string
  createdAt: string
  updatedAt: string
}

// 请求配置
export interface RequestConfig extends RequestInit {
  retries?: number
  retryDelay?: number
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  error: string | null
}

// API 错误类型
export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

// 资产相关类型
export interface AccountBalance {
  userId: string
  asset: 'USDC'
  availableBalance: string
  lockedBalance: string
  equity: string
  updatedAt: string
}

// 交易记录类型
export type TransactionType = 'DEPOSIT' | 'WITHDRAW' | 'MARGIN_LOCK' | 'MARGIN_RELEASE' | 'REALIZED_PNL' | 'FEE' | 'LIQUIDATION'
export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REVERTED'

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  eventName?: 'DEPOSIT' | 'WITHDRAW' | null
  txHash?: string | null
  logIndex?: number | null
  amount: string
  status: TransactionStatus
  idempotencyKey?: string
  createdAt: string
  updatedAt: string
  confirmedAt?: string | null
}

export interface OrderHistoryItem {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  action: 'OPEN' | 'CLOSE'
  size: string
  margin: string
  leverage: number
  status: 'PENDING' | 'FILLED' | 'FAILED' | 'CANCELED'
  executedPrice?: string
  failureMessage?: string
  createdAt: string
}

// 提现请求
export interface WithdrawRequest {
  amount: string
}

export interface WithdrawPayload {
  transactionId: string
  txHash?: string
  status: TransactionStatus
}

// 分页查询参数
export interface PaginationQuery {
  cursor?: string
  limit?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  nextCursor?: string
  hasMore: boolean
}
