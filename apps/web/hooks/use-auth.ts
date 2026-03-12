// apps/web/hooks/use-auth.ts
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAccount, useSignMessage, useDisconnect } from 'wagmi'
import { api } from '@/lib/api'
import type { AuthState, User } from '@/types/api'

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
        setState((prev) => ({ ...prev, isLoading: true }))

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

  // 登录流程
  const login = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address || !chainId) {
      setState((prev) => ({
        ...prev,
        error: '请先连接钱包',
      }))
      return false
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      // 1. 获取 SIWE challenge
      const challengeResponse = await api.getAuthChallenge(address)

      if (!challengeResponse.success || !challengeResponse.data) {
        throw new Error(challengeResponse.error?.message || '获取认证挑战失败')
      }

      const { nonce } = challengeResponse.data

      // 2. 创建 SIWE 消息
      const domain = typeof window !== 'undefined' ? window.location.host : 'perpdex.com'
      const message = createSIWEMessage(domain, address, nonce, chainId)

      // 3. 签名消息
      const signature = await signMessageAsync({ message })

      // 4. 验证签名
      const verifyResponse = await api.verifySignature(message, signature)

      if (!verifyResponse.success || !verifyResponse.data) {
        throw new Error(verifyResponse.error?.message || '签名验证失败')
      }

      const { accessToken, user } = verifyResponse.data

      // 5. 保存 token
      api.setAccessToken(accessToken)

      setState({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败'
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      return false
    }
  }, [isConnected, address, chainId, signMessageAsync])

  // 退出登录
  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))

    try {
      await api.logout()
      await disconnectAsync()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      api.clearTokens()
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
    setState((prev) => ({ ...prev, error: null }))
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
