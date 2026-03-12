// apps/web/components/wallet/connect-button.tsx
'use client'

import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useAuth } from '@/hooks/use-auth'
import { useEffect, useState } from 'react'

// 缩短地址显示
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function ConnectButton() {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { isAuthenticated, isLoading, login, logout, error, clearError } = useAuth()
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // 连接钱包后提示登录
  useEffect(() => {
    if (isConnected && !isAuthenticated && !isLoading) {
      setShowLoginPrompt(true)
    } else {
      setShowLoginPrompt(false)
    }
  }, [isConnected, isAuthenticated, isLoading])

  // 处理登录
  const handleLogin = async () => {
    clearError()
    const success = await login()
    if (success) {
      setShowLoginPrompt(false)
    }
  }

  // 未连接钱包 - 显示连接按钮
  if (!isConnected) {
    return (
      <button
        onClick={() => open()}
        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
      >
        连接钱包
      </button>
    )
  }

  // 已连接钱包但未登录 - 显示登录按钮
  if (isConnected && !isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        {showLoginPrompt && (
          <span className="text-sm text-yellow-400">需要登录以继续</span>
        )}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              登录中...
            </>
          ) : (
            '登录'
          )}
        </button>
        <button
          onClick={() => open()}
          className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
        >
          {shortenAddress(address || '')}
        </button>
        {error && (
          <span className="text-sm text-red-400">{error}</span>
        )}
      </div>
    )
  }

  // 已登录 - 显示地址和登出按钮
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">
        {shortenAddress(address || '')}
      </span>
      <button
        onClick={logout}
        disabled={isLoading}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium rounded-lg transition-colors"
      >
        {isLoading ? '退出中...' : '退出'}
      </button>
    </div>
  )
}
