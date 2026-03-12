// apps/web/lib/api.ts
import { API_CONFIG } from '@/config/constants'
import type {
  ApiResponse,
  ApiError,
  AuthChallenge,
  AuthTokens,
  User,
  RequestConfig,
  AccountBalance,
  Transaction,
  WithdrawPayload,
  PaginatedResponse,
} from '@/types/api'

class ApiClient {
  private baseUrl: string
  private timeout: number
  private defaultRetries: number

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL
    this.timeout = API_CONFIG.TIMEOUT
    this.defaultRetries = API_CONFIG.RETRY_ATTEMPTS
  }

  // 获取存储的 token
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  }

  // 设置 token
  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem('accessToken', token)
  }

  // 清除 token
  clearTokens(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  // 带超时的 fetch
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // 核心请求方法
  private async request<T>(
    endpoint: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      retries = this.defaultRetries,
      retryDelay = 1000,
      headers = {},
      ...fetchOptions
    } = options

    const url = `${this.baseUrl}${endpoint}`
    const token = this.getAccessToken()

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    // 合并自定义 headers
    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        defaultHeaders[key] = value
      }
    })

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          url,
          {
            ...fetchOptions,
            headers: defaultHeaders,
          },
          this.timeout
        )

        // 处理 401 未授权
        if (response.status === 401) {
          this.clearTokens()
          // 可以在这里触发重新登录
          return {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: '登录已过期，请重新登录',
            },
          }
        }

        // 解析响应
        const data: ApiResponse<T> = await response.json()

        if (!response.ok) {
          return {
            success: false,
            data: null,
            error: data.error || {
              code: 'UNKNOWN_ERROR',
              message: '请求失败',
            },
          }
        }

        return data
      } catch (error) {
        lastError = error as Error

        // 如果是最后一次尝试，抛出错误
        if (attempt === retries) {
          break
        }

        // 指数退避
        const delayMs = retryDelay * Math.pow(2, attempt)
        await this.delay(delayMs)
      }
    }

    // 所有重试都失败
    return {
      success: false,
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: lastError?.message || '网络请求失败，请检查网络连接',
      },
    }
  }

  // GET 请求
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' })
  }

  // POST 请求
  async post<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  // PUT 请求
  async put<T>(
    endpoint: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  // DELETE 请求
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' })
  }

  // ========== 认证相关 API ==========

  // 获取 SIWE 挑战
  async getAuthChallenge(address: string): Promise<ApiResponse<AuthChallenge>> {
    return this.post<AuthChallenge>('/api/auth/challenge', { address })
  }

  // 验证签名并登录
  async verifySignature(
    message: string,
    signature: string
  ): Promise<ApiResponse<AuthTokens & { user: User }>> {
    return this.post<AuthTokens & { user: User }>('/api/auth/verify', {
      message,
      signature,
    })
  }

  // 获取当前用户信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.get<User>('/api/auth/me')
  }

  // 退出登录
  async logout(): Promise<ApiResponse<void>> {
    const result = await this.post<void>('/api/auth/logout')
    this.clearTokens()
    return result
  }

  // ========== 资产相关 API ==========

  // 获取用户余额
  async getBalance(): Promise<ApiResponse<AccountBalance>> {
    return this.get<AccountBalance>('/api/user/balance')
  }

  // 获取交易历史
  async getTransactions(
    query?: { cursor?: string; limit?: number; type?: Transaction['type'] }
  ): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
    const params = new URLSearchParams()
    if (query?.cursor) params.append('cursor', query.cursor)
    if (query?.limit) params.append('limit', query.limit.toString())
    if (query?.type) params.append('type', query.type)

    const queryString = params.toString()
    return this.get<PaginatedResponse<Transaction>>(
      `/api/user/history${queryString ? `?${queryString}` : ''}`
    )
  }

  // 发起提现
  async withdraw(amount: string): Promise<ApiResponse<WithdrawPayload>> {
    return this.post<WithdrawPayload>('/api/user/withdraw', { amount })
  }
}

// 导出单例实例
export const api = new ApiClient()

// 导出类型
export type { ApiResponse, ApiError, AuthChallenge, AuthTokens, User, AccountBalance, Transaction, WithdrawPayload, PaginatedResponse }
