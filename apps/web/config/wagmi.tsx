// apps/web/config/wagmi.tsx
'use client'

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arbitrumSepolia } from '@reown/appkit/networks'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// 本地 Anvil 链配置
const localhost = {
  id: 31337,
  name: 'Localhost 31337',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
} as const

// 获取当前链 ID（优先使用环境变量）
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '421614')
const isLocalChain = chainId === 31337

// 根据环境选择网络
const networks = isLocalChain ? [localhost] : [arbitrumSepolia]
const defaultNetwork = isLocalChain ? localhost : arbitrumSepolia

// 获取项目 ID
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'demo_project_id'

if (!projectId || projectId === 'demo_project_id') {
  console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not defined, using demo value')
}

// 创建 QueryClient
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000,
    },
  },
})

// 创建 Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
})

// 导出配置
export const config = wagmiAdapter.wagmiConfig

// 创建 AppKit (这会自动注册 Provider)
// 注意：本地链模式下，某些 AppKit 功能可能受限
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  defaultNetwork,
  metadata: {
    name: 'PerpDex',
    description: 'Perpetual DEX MVP',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://perpdex.com',
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  features: {
    analytics: !isLocalChain, // 本地链禁用分析
    socials: isLocalChain ? [] : ['google', 'apple', 'x', 'github', 'discord'] as const,
    email: !isLocalChain,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#22c55e',
  },
})

// Context Provider 组件
export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
