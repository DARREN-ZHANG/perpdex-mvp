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
