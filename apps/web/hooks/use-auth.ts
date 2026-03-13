// apps/web/hooks/use-auth.ts
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useSignMessage, useDisconnect } from 'wagmi'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { AuthState, User } from '@/types/api'

// ========== 模块级别状态（所有组件共享）==========
// 防止多个组件同时调用登录导致重复签名请求
let globalIsLoggingIn = false
let globalAutoLoginTriggered = false
let globalLoginAttemptAddress: string | null = null

// 创建 SIWE 消息
function createSIWEMessage(
  domain: string,
  address: string,
  nonce: string,
  chainId: number
): string {
  const issuedAt = new Date().toISOString()

  return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to PerpDex

URI: ${typeof window !== 'undefined' ? window.location.origin : 'https://perpdex.com'}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}`
}

// 登录错误类型
class LoginError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'LoginError'
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null,
  })

  const { address, isConnected, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnectAsync } = useDisconnect()

  // 检查本地存储的 token 并恢复登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

      if (token && isConnected && address) {
        setState((prev: AuthState) => ({ ...prev, isLoading: true }))

        try {
          const response = await api.getCurrentUser()

          if (response.success && response.data) {
            setState({
              isAuthenticated: true,
              isLoading: false,
              user: response.data,
              error: null,
            })
          } else {
            // Token 无效，清除
            api.clearTokens()
            setState({
              isAuthenticated: false,
              isLoading: false,
              user: null,
              error: null,
            })
          }
        } catch {
          api.clearTokens()
          setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: null,
          })
        }
      }
    }

    checkAuth()
  }, [isConnected, address])

  // 连接钱包后自动触发登录流程
  useEffect(() => {
    const autoLogin = async () => {
      // 只有当钱包已连接、有地址、有链ID、且未认证、且没有token时才自动登录
      const hasToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

      // 防止重复登录：使用模块级别变量确保所有组件共享同一状态
      if (globalAutoLoginTriggered) return
      if (globalIsLoggingIn) return

      if (isConnected && address && chainId && !state.isAuthenticated && !state.isLoading && !hasToken) {
        // 立即设置标志，防止状态变化导致的重复调用
        globalAutoLoginTriggered = true
        globalIsLoggingIn = true
        globalLoginAttemptAddress = address
        await login(true) // 跳过重复检查，因为标志已经设置
      }
    }

    autoLogin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, chainId])

  // 当地址变化时，重置自动登录触发标志
  useEffect(() => {
    if (address !== globalLoginAttemptAddress) {
      globalLoginAttemptAddress = null
      globalAutoLoginTriggered = false
    }
  }, [address])

  // 登录流程 - 作为完整的事务处理
  const login = useCallback(async (skipLoggingCheck = false): Promise<boolean> => {
    // 防止重复登录（如果调用者已经设置了标志，则跳过检查）
    if (!skipLoggingCheck && globalIsLoggingIn) {
      return false
    }

    if (!isConnected || !address || !chainId) {
      setState((prev: AuthState) => ({
        ...prev,
        error: '请先连接钱包',
      }))
      return false
    }

    // 标记开始登录（如果还没设置）
    globalIsLoggingIn = true

    // 重置状态为未登录，确保登录是原子操作
    setState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null,
    })

    try {
      // 1. 获取 SIWE challenge
      const challengeResponse = await api.getAuthChallenge(address)

      if (!challengeResponse.success || !challengeResponse.data) {
        throw new LoginError(
          challengeResponse.error?.message || '获取认证挑战失败',
          'CHALLENGE_FAILED'
        )
      }

      const { nonce } = challengeResponse.data

      // 2. 创建 SIWE 消息
      const domain = typeof window !== 'undefined' ? window.location.host : 'perpdex.com'
      const message = createSIWEMessage(domain, address, nonce, chainId)

      // 3. 签名消息
      let signature: string
      try {
        signature = await signMessageAsync({ message })
      } catch {
        throw new LoginError('用户取消了签名', 'USER_REJECTED')
      }

      // 4. 验证签名
      const verifyResponse = await api.verifySignature(
        message,
        signature,
        address,
        chainId,
        nonce
      )

      if (!verifyResponse.success || !verifyResponse.data) {
        throw new LoginError(
          verifyResponse.error?.message || '签名验证失败',
          'VERIFY_FAILED'
        )
      }

      const { accessToken, user } = verifyResponse.data

      // 5. 保存 token
      api.setAccessToken(accessToken)

      // 只有所有步骤都成功，才设置为已登录
      setState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      })

      // 显示登录成功提示
      toast.success('登录成功', {
        description: '欢迎回来！',
        duration: 3000,
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof LoginError
        ? error.message
        : error instanceof Error
          ? error.message
          : '登录失败'

      // 确保清理状态 - 登录失败时必须保持未登录状态
      api.clearTokens()
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      })

      // 只在非用户取消的情况下显示 toast
      if (!(error instanceof LoginError && error.code === 'USER_REJECTED')) {
        toast.error('登录失败', {
          description: errorMessage,
          duration: 5000,
        })
      }

      return false
    } finally {
      // 重置登录标志
      globalIsLoggingIn = false
    }
  }, [isConnected, address, chainId, signMessageAsync])

  // 退出登录
  const logout = useCallback(async () => {
    setState((prev: AuthState) => ({ ...prev, isLoading: true }))

    try {
      await api.logout()
      await disconnectAsync()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      api.clearTokens()
      globalLoginAttemptAddress = null
      globalAutoLoginTriggered = false
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      })
    }
  }, [disconnectAsync])

  // 清除错误
  const clearError = useCallback(() => {
    setState((prev: AuthState) => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    address,
    isConnected,
    login,
    logout,
    clearError,
  }
}

// 导出类型
export type { AuthState }
