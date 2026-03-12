// apps/web/config/wagmi.tsx
'use client'

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { arbitrumSepolia } from '@reown/appkit/networks'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

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
  networks: [arbitrumSepolia],
  projectId,
  ssr: true,
})

// 导出配置
export const config = wagmiAdapter.wagmiConfig

// 创建 AppKit (这会自动注册 Provider)
createAppKit({
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
    socials: ['google', 'apple', 'x', 'github', 'discord'] as const,
    email: true,
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
