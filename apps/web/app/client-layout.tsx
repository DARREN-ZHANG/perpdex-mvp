// apps/web/app/client-layout.tsx
'use client'

import type { ReactNode } from 'react'
import { Web3Provider } from '@/config/wagmi'
import { Header } from '@/components/layout/header'
import { Providers } from './providers'

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Web3Provider>
        <Header />
        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </Web3Provider>
    </Providers>
  )
}
