'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useAccount, useDisconnect, useSignMessage } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, AUTH_TOKEN_CHANGE_EVENT } from '@/lib/api'
import type { AuthState, User } from '@/types/api'

const AUTH_SCOPED_QUERY_KEYS = [['balance'], ['transactions'], ['positions'], ['order-history']] as const

type AuthStoreSnapshot = AuthState

const defaultAuthState: AuthStoreSnapshot = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null,
}

const listeners = new Set<() => void>()

let authStore: AuthStoreSnapshot = defaultAuthState
let authHydrationPromise: Promise<void> | null = null
let hydratedAuthKey: string | null = null

function emitAuthChange() {
  listeners.forEach((listener) => listener())
}

function setAuthStore(nextState: AuthStoreSnapshot | ((prev: AuthStoreSnapshot) => AuthStoreSnapshot)) {
  authStore = typeof nextState === 'function' ? nextState(authStore) : nextState
  emitAuthChange()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return authStore
}

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(localStorage.getItem('accessToken'))
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

function getHydrationKey(address?: string | null): string | null {
  const token = getAccessToken()
  if (!token || !address) {
    return null
  }

  return `${address}:${token}`
}

function clearAuthState(options?: { resetAutoLogin?: boolean }) {
  globalIsLoggingIn = false
  hydratedAuthKey = null
  authHydrationPromise = null
  if (options?.resetAutoLogin) {
    globalAutoLoginTriggered = false
    globalLoginAttemptAddress = null
  }
  setAuthStore(defaultAuthState)
}

function syncAuthFailure(options?: { resetAutoLogin?: boolean }) {
  api.clearTokens()
  clearAuthState(options)
}

// 防止多个组件同时调用登录导致重复签名请求
let globalIsLoggingIn = false
let globalAutoLoginTriggered = false
let globalLoginAttemptAddress: string | null = null

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

class LoginError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'LoginError'
  }
}

async function ensureAuthHydrated(address?: string | null) {
  const hydrationKey = getHydrationKey(address)

  if (!hydrationKey) {
    return
  }

  if (
    hydratedAuthKey === hydrationKey &&
    authStore.isAuthenticated &&
    authStore.user?.address.toLowerCase() === address?.toLowerCase()
  ) {
    return
  }

  if (authHydrationPromise) {
    return authHydrationPromise
  }

  setAuthStore((prev) => ({ ...prev, isLoading: true, error: null }))

  authHydrationPromise = (async () => {
    try {
      const response = await api.getCurrentUser()

      if (response.success && response.data) {
        hydratedAuthKey = hydrationKey
        setAuthStore({
          isAuthenticated: true,
          isLoading: false,
          user: response.data,
          error: null,
        })
        return
      }

      syncAuthFailure()
    } catch {
      syncAuthFailure()
    } finally {
      authHydrationPromise = null
    }
  })()

  return authHydrationPromise
}

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const queryClient = useQueryClient()
  const { address, isConnected, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnectAsync } = useDisconnect()
  const hasEverConnectedRef = useRef(false)

  useEffect(() => {
    const handleTokenChange = () => {
      if (hasAccessToken()) {
        return
      }

      clearAuthState()
      AUTH_SCOPED_QUERY_KEYS.forEach((queryKey) => {
        queryClient.removeQueries({ queryKey: [...queryKey] })
      })
    }

    window.addEventListener(AUTH_TOKEN_CHANGE_EVENT, handleTokenChange)
    return () => window.removeEventListener(AUTH_TOKEN_CHANGE_EVENT, handleTokenChange)
  }, [queryClient])

  useEffect(() => {
    if (isConnected && address) {
      hasEverConnectedRef.current = true
      return
    }

    if (!hasEverConnectedRef.current) {
      return
    }

    if (!state.isAuthenticated && !hasAccessToken()) {
      return
    }

    syncAuthFailure({ resetAutoLogin: true })
    AUTH_SCOPED_QUERY_KEYS.forEach((queryKey) => {
      queryClient.removeQueries({ queryKey: [...queryKey] })
    })
  }, [address, isConnected, queryClient, state.isAuthenticated])

  useEffect(() => {
    const checkAuth = async () => {
      if (!hasAccessToken() || !isConnected || !address) {
        return
      }

      await ensureAuthHydrated(address)
    }

    void checkAuth()
  }, [isConnected, address])

  useEffect(() => {
    const autoLogin = async () => {
      if (globalAutoLoginTriggered || globalIsLoggingIn) return

      if (isConnected && address && chainId && !state.isAuthenticated && !state.isLoading && !hasAccessToken()) {
        globalAutoLoginTriggered = true
        globalIsLoggingIn = true
        globalLoginAttemptAddress = address
        await login(true)
      }
    }

    void autoLogin()
  }, [address, chainId, isConnected, state.isAuthenticated, state.isLoading])

  useEffect(() => {
    if (address !== globalLoginAttemptAddress) {
      globalLoginAttemptAddress = null
      globalAutoLoginTriggered = false
    }
  }, [address])

  const login = useCallback(async (skipLoggingCheck = false): Promise<boolean> => {
    if (!skipLoggingCheck && globalIsLoggingIn) {
      return false
    }

    if (!isConnected || !address || !chainId) {
      setAuthStore((prev) => ({
        ...prev,
        error: '请先连接钱包',
      }))
      return false
    }

    globalIsLoggingIn = true

    setAuthStore({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null,
    })

    try {
      const challengeResponse = await api.getAuthChallenge(address)

      if (!challengeResponse.success || !challengeResponse.data) {
        throw new LoginError(
          challengeResponse.error?.message || '获取认证挑战失败',
          'CHALLENGE_FAILED'
        )
      }

      const { nonce } = challengeResponse.data
      const domain = typeof window !== 'undefined' ? window.location.host : 'perpdex.com'
      const message = createSIWEMessage(domain, address, nonce, chainId)

      let signature: string
      try {
        signature = await signMessageAsync({ message })
      } catch {
        throw new LoginError('用户取消了签名', 'USER_REJECTED')
      }

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

      api.setAccessToken(accessToken)
      hydratedAuthKey = `${address}:${accessToken}`
      authHydrationPromise = null

      setAuthStore({
        isAuthenticated: true,
        isLoading: false,
        user,
        error: null,
      })

      AUTH_SCOPED_QUERY_KEYS.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] })
      })

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

      syncAuthFailure()
      AUTH_SCOPED_QUERY_KEYS.forEach((queryKey) => {
        queryClient.removeQueries({ queryKey: [...queryKey] })
      })

      if (!(error instanceof LoginError && error.code === 'USER_REJECTED')) {
        toast.error('登录失败', {
          description: errorMessage,
          duration: 5000,
        })
      }

      setAuthStore({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      })

      return false
    } finally {
      globalIsLoggingIn = false
    }
  }, [address, chainId, isConnected, queryClient, signMessageAsync])

  const logout = useCallback(async () => {
    setAuthStore((prev) => ({ ...prev, isLoading: true }))

    try {
      await api.logout()
      await disconnectAsync()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      syncAuthFailure({ resetAutoLogin: true })
      AUTH_SCOPED_QUERY_KEYS.forEach((queryKey) => {
        queryClient.removeQueries({ queryKey: [...queryKey] })
      })
    }
  }, [disconnectAsync, queryClient])

  const clearError = useCallback(() => {
    setAuthStore((prev) => ({ ...prev, error: null }))
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

export type { AuthState, User }
