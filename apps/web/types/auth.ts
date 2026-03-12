// apps/web/types/auth.ts

import type { User } from './api'

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  error: string | null
}

export interface AuthContextType extends AuthState {
  // 连接钱包
  connect: () => Promise<void>
  // 断开连接
  disconnect: () => Promise<void>
  // 登录（签名 SIWE）
  login: () => Promise<boolean>
  // 退出登录
  logout: () => Promise<void>
  // 清除错误
  clearError: () => void
}

// SIWE 消息参数
export interface SIWEMessageParams {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: number
  nonce: string
  issuedAt: string
}
