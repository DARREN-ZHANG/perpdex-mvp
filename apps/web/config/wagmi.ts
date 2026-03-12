// apps/web/config/wagmi.ts
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arbitrumSepolia } from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// 获取项目 ID
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not defined')
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
  networks: [arbitrumSepolia],
  projectId,
  ssr: true,
})

// 创建 AppKit
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [arbitrumSepolia],
  projectId,
  defaultNetwork: arbitrumSepolia,
  metadata: {
    name: 'PerpDex',
    description: 'Perpetual DEX MVP',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://perpdex.com',
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  features: {
    analytics: true,
    socials: ['google', 'apple', 'email', 'x', 'github', 'discord'],
    email: true,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#22c55e',
  },
})

// 导出配置
export const config = wagmiAdapter.wagmiConfig

// Context Provider 组件
export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
